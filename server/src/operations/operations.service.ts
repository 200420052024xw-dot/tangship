import { BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { StorageService } from '../storage/storage.service';
import { CANONICAL_VEHICLES } from './vehicle-catalog.seed';
import { serverCache, CACHE_TTL, CACHE_KEYS } from '../common/server-cache';

export const DEFAULT_PRICING = {
  baseDistanceMeters: 3000, baseFeeCents: 2500, distanceFeePerKmCents: 400,
  vehicleFeesCents: { 'z2': 0, 'z5-2026': 500, 'l5': 300, 'l5-max': 400, 'z8': 800, 'z8-max': 1000, 'z5-c': 1200, 'z8-max-c': 1800, 'z5-multi': 700 },
  coldChainFeeCents: 1500, overweightFeePerKgCents: 50, overweightThresholdKg: 300,
  nightFeeCents: 1000, nightStartHour: 22, nightEndHour: 6,
  remoteAreaFeeCents: 2000, remoteAreas: [], defaultQuoteValidityHours: 24,
};

const json = (v: any) => JSON.stringify(v);
const parse = (v: string) => JSON.parse(v);
const utc = () => new Date().toISOString();
type VehicleServiceMode = 'single' | 'monthly' | 'rental';
const syncedVehicleId = (id: string, mode: VehicleServiceMode) => { const baseId = id.replace(/-(monthly|rental)$/i, ''); return mode === 'single' ? baseId : `${baseId}-${mode}`; };
const normalizeSyncModes = (value: unknown): VehicleServiceMode[] => Array.isArray(value) ? [...new Set(value.filter((mode): mode is VehicleServiceMode => mode === 'single' || mode === 'monthly' || mode === 'rental'))] : [];

/**
 * 真实车型图片 TOS Key 映射
 * 这些图片已上传到 TOS 对象存储，用于替代 SVG 假图
 */
const REAL_VEHICLE_IMAGE_KEYS: Record<string, string> = {
  'z5-2026': 'vehicles/z5-2026/Z5_8bb2d95a.png',
  'z2': 'vehicles/z2/Z5lite_86f5074a.png',
  'l5-max': 'vehicles/l5-max/Z5pro_589a0566.png',
  'z5-c': 'vehicles/z5-c/Z5proLeng_Cang_Che_42d2ca0b.png',
  'z5-multi': 'vehicles/z5-multi/Z5Huo_Ju_Che_4fccfbb0.png',
  'z8': 'vehicles/z8/Z8_2b624379.png',
  'z8-max': 'vehicles/z8-max/Z8Xiang_Shi_Che_38d2b381.png',
  'z8-max-c': 'vehicles/z8-max-c/Z8_Leng_Cang_Che_d07d8608.png',
};

@Injectable()
export class OperationsService implements OnModuleInit {
  constructor(private supabase: SupabaseService, private storage: StorageService) {}

  private getClient() { return this.supabase.getClient(); }

  async onModuleInit() {
    if (process.env.ADMIN_DATA_BACKEND === 'sqlite') return;
    const client = this.getClient();
    const t = utc();

    // Seed vehicle catalog if empty
    const { data: existingVehicles } = await client.from('vehicle_catalog').select('id').limit(1).maybeSingle();
    if (!existingVehicles) {
      for (const [sort, item] of CANONICAL_VEHICLES.entries()) {
        const v: any = item;
        const { error } = await client.from('vehicle_catalog').insert({
          id: v.id, name: v.name, full_name: v.fullName, subtitle: v.subtitle,
          description: v.description, specs_json: json(v.specs), scenes_json: json(v.applicableScenes),
          restrictions_json: json(v.restrictions), modes_json: json(v.supportedModes),
          service_mode: v.serviceMode || 'single',
          pricing_hint_json: json(v.pricingDescription), tags_json: json(v.tags),
          enabled: v.enabled ? 1 : 0, requires_approval: v.requiresApproval ? 1 : 0,
          sort_order: sort, created_at: t, updated_at: t,
        });
        if (error) console.error(`Seed vehicle ${v.id} failed:`, error.message);
      }
      await this.seedVehicleImages();
      await this.seedBanners();
    } else {
      // Update incomplete vehicles
      for (const [sort, item] of CANONICAL_VEHICLES.entries()) {
        const v: any = item;
        await client.from('vehicle_catalog').update({
          name: v.name, full_name: v.fullName, subtitle: v.subtitle,
          description: v.description, specs_json: json(v.specs), scenes_json: json(v.applicableScenes),
          restrictions_json: json(v.restrictions), modes_json: json(v.supportedModes),
          pricing_hint_json: json(v.pricingDescription), tags_json: json(v.tags),
          requires_approval: v.requiresApproval ? 1 : 0, sort_order: sort, updated_at: t,
        }).eq('id', v.id).eq('subtitle', '').eq('restrictions_json', '[]').eq('tags_json', '[]');
      }
      // Seed images/banners if missing
      const { data: existingImages } = await client.from('vehicle_images').select('id').limit(1).maybeSingle();
      if (!existingImages) await this.seedVehicleImages();
      const { data: existingBanners } = await client.from('content_banners').select('id').limit(1).maybeSingle();
      if (!existingBanners) await this.seedBanners();
    }
    // 将数据库中残留的 SVG 假图替换为 TOS 真实图片
    await this.replaceSvgImagesWithReal();
    // 确保 rental 车型也出现在按趟配送中
    await this.ensureRentalVehiclesInSingleMode();
    // 更新轮播图为车型真实图片
    await this.updateBannersToRealImages();
    // 禁用没有真实图片的车型
    await this.disableNoImageVehicles();
  }

  async listVehicles(admin = false, serviceMode?: string) {
    const cacheKey = (admin ? CACHE_KEYS.VEHICLE_CATALOG + ':admin' : CACHE_KEYS.VEHICLE_CATALOG) + (serviceMode ? `:${serviceMode}` : '');
    const cached = admin ? undefined : serverCache.get<any[]>(cacheKey);
    if (cached) return cached;

    const client = this.getClient();
    // 批量查询: 一次取车型 + 一次取所有图片（消除 N+1）
    let query = client.from('vehicle_catalog').select('*').order('sort_order', { ascending: true }).order('id', { ascending: true });
    if (!admin) query = query.eq('enabled', 1);
    if (serviceMode) query = query.eq('service_mode', serviceMode);
    const [{ data: rows, error }, { data: allImgs }, { data: activeOrders }] = await Promise.all([
      query,
      client.from('vehicle_images').select('id, vehicle_id, url, object_key, is_primary, sort_order').order('is_primary', { ascending: false }).order('sort_order', { ascending: true }).order('id', { ascending: true }),
      admin ? client.from('orders').select('vehicle_id,reserved_vehicle_count').in('status', ['pending_payment', 'paid', 'dispatching', 'delivering']) : Promise.resolve({ data: [] }),
    ]);
    if (error) throw new Error(`查询车型失败: ${error.message}`);

    // 按车型分组图片，对有 TOS key 的图片动态生成签名 URL
    const imgMap = new Map<string, string[]>();
    const imageItemMap = new Map<string, Array<{ id: string; url: string; objectKey: string; isPrimary: boolean; sortOrder: number }>>();
    for (const img of (allImgs || [])) {
      const list = imgMap.get(img.vehicle_id) || [];
      let url = img.url;
      // 如果有 TOS object_key，动态生成签名 URL（避免签名过期）
      if (img.object_key && img.object_key.length > 0) {
        try {
          url = await this.storage.getSignedUrl(img.object_key, 86400); // 24 小时有效期
        } catch {
          // 签名失败时 fallback 到数据库中存储的 URL
        }
      }
      list.push(url);
      imgMap.set(img.vehicle_id, list);
      const items = imageItemMap.get(img.vehicle_id) || [];
      items.push({ id: img.id, url, objectKey: img.object_key || '', isPrimary: !!img.is_primary, sortOrder: Number(img.sort_order) || 0 });
      imageItemMap.set(img.vehicle_id, items);
    }

    const reservedByVehicle = new Map<string, number>();
    for (const order of activeOrders || []) reservedByVehicle.set(order.vehicle_id, (reservedByVehicle.get(order.vehicle_id) || 0) + Number(order.reserved_vehicle_count || 0));
    const result = (rows || []).map((v: any) => {
      const totalCount = Math.max(0, Number(v.total_count) || 0), reservedCount = reservedByVehicle.get(v.id) || 0;
      return {
        id: v.id, name: v.name, fullName: v.full_name, subtitle: v.subtitle,
        description: v.description, enabled: !!v.enabled, requiresApproval: !!v.requires_approval,
        sortOrder: v.sort_order, specs: parse(v.specs_json), applicableScenes: parse(v.scenes_json),
        restrictions: parse(v.restrictions_json), supportedModes: parse(v.modes_json),
        serviceMode: v.service_mode || 'single',
        pricingDescription: parse(v.pricing_hint_json), tags: parse(v.tags_json),
        ...(admin ? { totalCount, reservedCount, availableCount: totalCount - reservedCount, imageItems: imageItemMap.get(v.id) || [] } : {}),
        images: imgMap.get(v.id) || [],
      };
    });

    if (!admin) serverCache.set(cacheKey, result, CACHE_TTL.STATIC);
    return result;
  }

  async getVehicle(id: string) {
    // 从缓存列表中查找，避免重新查询
    const all = await this.listVehicles(true);
    return (all as any[]).find(v => v.id === id);
  }

  async saveVehicle(adminId: string, id: string, b: any) {
    if (!id || !b.name || !b.fullName) throw new BadRequestException('车型名称不能为空');
    const client = this.getClient();
    const t = utc();
    const { data: exists } = await client.from('vehicle_catalog').select('id').eq('id', id).maybeSingle();

    const values = {
      name: b.name, full_name: b.fullName, subtitle: b.subtitle || '',
      description: b.description || '', specs_json: json(b.specs || {}),
      scenes_json: json(b.applicableScenes || []), restrictions_json: json(b.restrictions || []),
      modes_json: json(b.supportedModes || ['single']), service_mode: b.serviceMode || 'single',
      pricing_hint_json: json(b.pricingDescription || {}),
      tags_json: json(b.tags || []), enabled: b.enabled === false ? 0 : 1,
      requires_approval: b.requiresApproval ? 1 : 0, sort_order: Number(b.sortOrder) || 0,
      total_count: Math.max(0, Math.floor(Number(b.totalCount) || 0)), updated_at: t,
    };

    if (exists) {
      const { error } = await client.from('vehicle_catalog').update(values).eq('id', id);
      if (error) throw new BadRequestException(`保存车型失败: ${error.message}`);
    } else {
      const { error } = await client.from('vehicle_catalog').insert({ id, ...values, created_at: t });
      if (error) throw new BadRequestException(`新增车型失败: ${error.message}`);
    }

    const syncModes = normalizeSyncModes(b.syncModes).filter(mode => mode !== (b.serviceMode || 'single'));
    if (syncModes.length) {
      const { data: sourceImages, error: sourceImageError } = await client.from('vehicle_images').select('url,object_key,is_primary,sort_order').eq('vehicle_id', id);
      if (sourceImageError) throw new BadRequestException(`读取车型图片失败: ${sourceImageError.message}`);
      for (const mode of syncModes) {
        const targetId = syncedVehicleId(id, mode);
        const targetValues = { ...values, service_mode: mode, modes_json: json([mode]) };
        const { error: vehicleError } = await client.from('vehicle_catalog').upsert({ id: targetId, ...targetValues, created_at: t }, { onConflict: 'id' });
        if (vehicleError) throw new BadRequestException(`同步${mode}车型失败: ${vehicleError.message}`);
        const { error: deleteImageError } = await client.from('vehicle_images').delete().eq('vehicle_id', targetId);
        if (deleteImageError) throw new BadRequestException(`清理目标车型图片失败: ${deleteImageError.message}`);
        if (sourceImages?.length) {
          const copies = sourceImages.map(image => ({ id: randomUUID(), vehicle_id: targetId, url: image.url, object_key: image.object_key || '', is_primary: image.is_primary ? 1 : 0, sort_order: Number(image.sort_order) || 0, created_at: t }));
          const { error: imageError } = await client.from('vehicle_images').insert(copies);
          if (imageError) throw new BadRequestException(`同步车型图片失败: ${imageError.message}`);
        }
      }
    }
    await this.audit(adminId, exists ? 'vehicle.update' : 'vehicle.create', 'vehicle', id, { name: b.name, syncModes });
    serverCache.invalidatePrefix(CACHE_KEYS.VEHICLE_CATALOG);
    return this.getVehicle(id);
  }

  async deleteVehicle(adminId: string, id: string) {
    const client = this.getClient();
    const { data: referenced } = await client.from('orders').select('id').eq('vehicle_id', id).limit(1).maybeSingle();
    if (referenced) throw new ConflictException('该车型已被订单引用，不能删除；可以将其下架');
    const { data: images } = await client.from('vehicle_images').select('object_key').eq('vehicle_id', id);
    const { error: imageError } = await client.from('vehicle_images').delete().eq('vehicle_id', id);
    if (imageError) throw new BadRequestException(`删除车型图片记录失败: ${imageError.message}`);
    const { error } = await client.from('vehicle_catalog').delete().eq('id', id);
    if (error) throw new BadRequestException(`删除车型失败: ${error.message}`);
    for (const image of images || []) {
      if (!image.object_key) continue;
      const { data: shared } = await client.from('vehicle_images').select('id').eq('object_key', image.object_key).limit(1).maybeSingle();
      if (!shared) await this.storage.deleteFile(image.object_key).catch(() => undefined);
    }
    await this.audit(adminId, 'vehicle.delete', 'vehicle', id, {});
    serverCache.invalidatePrefix(CACHE_KEYS.VEHICLE_CATALOG);
  }

  async listBanners(admin = false) {
    const cacheKey = admin ? CACHE_KEYS.BANNERS + ':admin' : CACHE_KEYS.BANNERS;
    const cached = serverCache.get<any[]>(cacheKey);
    if (cached) return cached;

    const client = this.getClient();
    let query = client.from('content_banners').select('*').order('sort_order', { ascending: true }).order('id', { ascending: true });
    if (!admin) query = query.eq('enabled', 1);
    const { data: rows, error } = await query;
    if (error) throw new Error(`查询轮播图失败: ${error.message}`);

    const result = await Promise.all((rows || []).map(async (v: any) => {
      let imageUrl = v.image_url;
      // 如果有 TOS object_key，动态生成签名 URL（避免签名过期）
      if (v.object_key && v.object_key.length > 0) {
        try { imageUrl = await this.storage.getSignedUrl(v.object_key, 86400); } catch {}
      }
      return {
        id: v.id, image: imageUrl, imageUrl, title: v.title,
        linkType: v.link_type, linkTarget: v.link_target, sortOrder: v.sort_order,
        sort: v.sort_order, enabled: !!v.enabled, createdAt: v.created_at, updatedAt: v.updated_at,
      };
    }));

    serverCache.set(cacheKey, result, CACHE_TTL.STATIC);
    return result;
  }

  async saveBanner(adminId: string, id: string, b: any) {
    if (!b.imageUrl || !b.title || !['vehicle', 'monthly', 'service', 'activity'].includes(b.linkType))
      throw new BadRequestException('轮播图信息不完整');
    const client = this.getClient();
    if (b.linkType === 'vehicle') {
      const { data: v } = await client.from('vehicle_catalog').select('id').eq('id', b.linkTarget).maybeSingle();
      if (!v) throw new BadRequestException('跳转车型不存在');
    }

    const t = utc();
    const { data: old } = await client.from('content_banners').select('object_key').eq('id', id).maybeSingle();
    const key = b.objectKey || old?.object_key || '';

    const { error } = await client.from('content_banners').upsert({
      id, image_url: b.imageUrl, object_key: key, title: b.title,
      link_type: b.linkType, link_target: b.linkTarget || '',
      sort_order: Number(b.sortOrder) || 0, enabled: b.enabled === false ? 0 : 1,
      updated_at: t, created_at: t,
    });
    if (error) throw new Error(`保存轮播图失败: ${error.message}`);
    await this.audit(adminId, old ? 'banner.update' : 'banner.create', 'banner', id, { title: b.title });
    const banners = await this.listBanners(true);
    return banners.find((v: any) => v.id === id);
  }

  async pricing() {
    const client = this.getClient();
    const { data: draft } = await client.from('pricing_rule_versions').select('*').eq('status', 'draft').order('version', { ascending: false }).limit(1).maybeSingle();
    const { data: published } = await client.from('pricing_rule_versions').select('*').eq('status', 'published').order('version', { ascending: false }).limit(1).maybeSingle();
    return {
      draft: draft ? { ...draft, config: parse(draft.config_json) } : null,
      published: published ? { ...published, config: parse(published.config_json) } : null,
      defaults: DEFAULT_PRICING,
    };
  }

  async saveDraft(adminId: string, config: any, expectedVersion?: number) {
    this.validatePricing(config);
    const client = this.getClient();
    const t = utc();
    const { data: current } = await client.from('pricing_rule_versions').select('*').eq('status', 'draft').order('version', { ascending: false }).limit(1).maybeSingle();

    if (current) {
      if (expectedVersion !== undefined && current.version !== expectedVersion)
        throw new ConflictException('计费草稿已被其他管理员修改');
      await client.from('pricing_rule_versions').update({ config_json: json(config), updated_at: t }).eq('id', current.id);
      await this.audit(adminId, 'pricing.draft.update', 'pricing', current.id, { version: current.version });
    } else {
      const { data: maxRow } = await client.from('pricing_rule_versions').select('version').order('version', { ascending: false }).limit(1).maybeSingle();
      const version = (maxRow?.version || 0) + 1;
      const id = randomUUID();
      await client.from('pricing_rule_versions').insert({
        id, version, status: 'draft', config_json: json(config),
        created_by: adminId, created_at: t, updated_at: t,
      });
      await this.audit(adminId, 'pricing.draft.create', 'pricing', id, { version });
    }
    return this.pricing();
  }

  async publish(adminId: string, expectedVersion: number) {
    const client = this.getClient();
    const { data: draft } = await client.from('pricing_rule_versions').select('*').eq('status', 'draft').order('version', { ascending: false }).limit(1).maybeSingle();
    if (!draft || draft.version !== expectedVersion) throw new ConflictException('计费草稿已变化，请刷新');
    const t = utc();
    await client.from('pricing_rule_versions').update({ status: 'archived' }).eq('status', 'published');
    await client.from('pricing_rule_versions').update({ status: 'published', published_by: adminId, published_at: t, updated_at: t }).eq('id', draft.id).eq('status', 'draft');
    await this.audit(adminId, 'pricing.publish', 'pricing', draft.id, { version: draft.version });
    return this.pricing();
  }

  async preview(input: any, useDraft = false) {
    const state = await this.pricing();
    const config = (useDraft ? state.draft?.config : state.published?.config) || DEFAULT_PRICING;
    return this.calculate(config, input);
  }

  calculate(c: any, input: any) {
    const distance = Math.max(0, Number(input.distanceMeters) || 0);
    const weight = Math.max(0, Number(input.weightKg) || 0);
    const extraDistance = Math.max(0, distance - c.baseDistanceMeters);
    const distanceFee = Math.round(extraDistance / 1000 * c.distanceFeePerKmCents);
    const vehicleFee = Number(c.vehicleFeesCents?.[input.vehicleId] || 0);
    const cold = input.coldChain ? c.coldChainFeeCents : 0;
    const over = Math.round(Math.max(0, weight - c.overweightThresholdKg) * c.overweightFeePerKgCents);
    const night = input.night ? c.nightFeeCents : 0;
    const remote = input.remote ? c.remoteAreaFeeCents : 0;
    const total = c.baseFeeCents + distanceFee + vehicleFee + cold + over + night + remote;
    return {
      ruleVersion: null, baseFeeCents: c.baseFeeCents, distanceFeeCents: distanceFee,
      vehicleFeeCents: vehicleFee, serviceFeeCents: cold + over + night + remote,
      discountCents: 0, totalCents: total, distanceMeters: distance,
      breakdown: { coldChainFeeCents: cold, overweightFeeCents: over, nightFeeCents: night, remoteAreaFeeCents: remote },
      expiresAt: new Date(Date.now() + c.defaultQuoteValidityHours * 3600000).toISOString(),
    };
  }

  async upload(adminId: string, file: any, prefix: string) {
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype) || file.size > 5 * 1024 * 1024)
      throw new BadRequestException('仅支持 5MB 内 JPG、PNG、WebP 图片');
    const ext = file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpg';
    const key = `admin/${prefix}/${randomUUID()}.${ext}`;
    const result = await this.storage.uploadFile({ fileContent: file.buffer, fileName: key, contentType: file.mimetype });
    const url = (result as any)?.fileKey || (result as any)?.url || key;
    await this.audit(adminId, 'asset.upload', 'asset', key, { mime: file.mimetype, size: file.size });
    return { url, objectKey: key };
  }

  async addVehicleImage(adminId: string, vehicleId: string, asset: any) {
    const vehicle = await this.getVehicle(vehicleId);
    if (!vehicle) throw new BadRequestException('车型不存在');
    const client = this.getClient();
    const t = utc();
    if (asset.isPrimary) await client.from('vehicle_images').update({ is_primary: 0 }).eq('vehicle_id', vehicleId);
    await client.from('vehicle_images').insert({
      id: randomUUID(), vehicle_id: vehicleId, url: asset.url,
      object_key: asset.objectKey || '', is_primary: asset.isPrimary ? 1 : 0,
      sort_order: Number(asset.sortOrder) || 0, created_at: t,
    });
    await this.audit(adminId, 'vehicle.image.add', 'vehicle', vehicleId, {});
    return this.getVehicle(vehicleId);
  }

  async deleteVehicleImage(adminId: string, vehicleId: string, imageId: string) {
    const client = this.getClient();
    const { data: image, error: findError } = await client.from('vehicle_images').select('id,object_key,is_primary').eq('id', imageId).eq('vehicle_id', vehicleId).maybeSingle();
    if (findError) throw new BadRequestException(`读取车型图片失败: ${findError.message}`);
    if (!image) throw new NotFoundException('车型图片不存在');
    const { error: deleteError } = await client.from('vehicle_images').delete().eq('id', imageId).eq('vehicle_id', vehicleId);
    if (deleteError) throw new BadRequestException(`删除车型图片失败: ${deleteError.message}`);
    if (image.is_primary) {
      const { data: next } = await client.from('vehicle_images').select('id').eq('vehicle_id', vehicleId).order('sort_order', { ascending: true }).order('id', { ascending: true }).limit(1).maybeSingle();
      if (next) await client.from('vehicle_images').update({ is_primary: 1 }).eq('id', next.id);
    }
    if (image.object_key) {
      const { data: shared } = await client.from('vehicle_images').select('id').eq('object_key', image.object_key).limit(1).maybeSingle();
      if (!shared) await this.storage.deleteFile(image.object_key).catch(() => undefined);
    }
    await this.audit(adminId, 'vehicle.image.delete', 'vehicle', vehicleId, { imageId });
    serverCache.invalidatePrefix(CACHE_KEYS.VEHICLE_CATALOG);
    return this.getVehicle(vehicleId);
  }

  private vehicleSvg(name: string, color: string, icon: string) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="260" viewBox="0 0 400 260"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${color}"/><stop offset="100%" stop-color="${color}dd"/></linearGradient></defs><rect width="400" height="260" rx="16" fill="url(#bg)"/><text x="200" y="100" text-anchor="middle" font-size="48" font-weight="bold" fill="white" font-family="system-ui,sans-serif">${icon}</text><text x="200" y="160" text-anchor="middle" font-size="22" font-weight="600" fill="whitecc" font-family="system-ui,sans-serif">${name}</text><text x="200" y="195" text-anchor="middle" font-size="14" fill="white99" font-family="system-ui,sans-serif">九识智能 · 无人配送</text></svg>`;
    return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
  }

  private bannerSvg(title: string, subtitle: string, color1: string, color2: string) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="750" height="300" viewBox="0 0 750 300"><defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${color1}"/><stop offset="100%" stop-color="${color2}"/></linearGradient></defs><rect width="750" height="300" rx="20" fill="url(#b)"/><text x="375" y="130" text-anchor="middle" font-size="36" font-weight="bold" fill="white" font-family="system-ui,sans-serif">${title}</text><text x="375" y="185" text-anchor="middle" font-size="18" fill="whitecc" font-family="system-ui,sans-serif">${subtitle}</text></svg>`;
    return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
  }

  private async seedVehicleImages() {
    const client = this.getClient();
    const t = utc();
    // SVG 假图 fallback 配置（仅用于无真实图片的车型）
    const svgFallbacks: [string, string, string][] = [
      ['l5', '#8B5CF6', '🚚'],
      ['z8-chassis', '#64748B', '🔧'], ['z5-security', '#EF4444', '🛡️'], ['yokee', '#F97316', '🚌'],
      ['l4-kit', '#6366F1', '⚙️'],
    ];
    // 先处理有真实 TOS 图片的车型
    for (const [vehicleId, tosKey] of Object.entries(REAL_VEHICLE_IMAGE_KEYS)) {
      const { data: vehicle } = await client.from('vehicle_catalog').select('id').eq('id', vehicleId).maybeSingle();
      if (!vehicle) continue;
      try {
        const url = await this.storage.getSignedUrl(tosKey, 31536000); // 1 年有效期
        await client.from('vehicle_images').insert({
          id: randomUUID(), vehicle_id: vehicleId, url, object_key: tosKey,
          is_primary: 1, sort_order: 0, created_at: t,
        });
      } catch (e) {
        console.error(`Seed real image for ${vehicleId} failed, falling back to SVG:`, e.message);
        const name = CANONICAL_VEHICLES.find(v => v.id === vehicleId)?.name || vehicleId;
        const color = vehicleId.startsWith('z5') ? '#10B981' : vehicleId.startsWith('z8') ? '#F59E0B' : '#3B82F6';
        await client.from('vehicle_images').insert({
          id: randomUUID(), vehicle_id: vehicleId, url: this.vehicleSvg(name, color, '🚐'), object_key: '',
          is_primary: 1, sort_order: 0, created_at: t,
        });
      }
    }
    // 再处理无真实图片的车型（使用 SVG 假图）
    for (const [vehicleId, color, icon] of svgFallbacks) {
      const { data: vehicle } = await client.from('vehicle_catalog').select('id').eq('id', vehicleId).maybeSingle();
      if (!vehicle) continue;
      const url = this.vehicleSvg(CANONICAL_VEHICLES.find(v => v.id === vehicleId)?.name || vehicleId, color, icon);
      await client.from('vehicle_images').insert({
        id: randomUUID(), vehicle_id: vehicleId, url, object_key: '',
        is_primary: 1, sort_order: 0, created_at: t,
      });
    }
  }

  /** 将数据库中残留的假图（SVG / 通用占位图）替换为 TOS 真实图片，并为缺少图片的车型补录 */
  private async replaceSvgImagesWithReal() {
    const client = this.getClient();
    const PLACEHOLDER_PATTERN = /coze_storage_|data:image\/svg\+xml/i;
    const { data: allImages } = await client.from('vehicle_images').select('id, vehicle_id, url, object_key, is_primary');
    if (!allImages) return;

    // 1. 替换已有假图记录（包括月租车型如 z5-2026-monthly → z5-2026）
    for (const img of allImages) {
      const isFake = !img.url || PLACEHOLDER_PATTERN.test(img.url) || !img.object_key;
      if (!isFake) continue; // 已有真实图片，跳过
      const baseVehicleId = img.vehicle_id.replace(/-monthly$/, '');
      const tosKey = REAL_VEHICLE_IMAGE_KEYS[baseVehicleId] || REAL_VEHICLE_IMAGE_KEYS[img.vehicle_id];
      if (!tosKey) continue; // 无真实图片的车型保留假图

      try {
        const url = await this.storage.getSignedUrl(tosKey, 31536000);
        await client.from('vehicle_images').update({ url, object_key: tosKey }).eq('id', img.id);
        console.log(`[VehicleImage] Replaced fake image for ${img.vehicle_id} with TOS real image`);
      } catch (e) {
        console.error(`[VehicleImage] Failed to replace for ${img.vehicle_id}:`, e.message);
      }
    }

    // 2. 为有真实图片但缺少记录的车型补录（含月租变体）
    const vehiclesWithImages = new Set(allImages.map(i => i.vehicle_id));
    const t = utc();
    for (const [baseId, tosKey] of Object.entries(REAL_VEHICLE_IMAGE_KEYS)) {
      // 检查 base 和 -monthly 变体
      for (const vehicleId of [baseId, `${baseId}-monthly`]) {
        if (vehiclesWithImages.has(vehicleId)) continue;
        const { data: vehicle } = await client.from('vehicle_catalog').select('id').eq('id', vehicleId).maybeSingle();
        if (!vehicle) continue;
        try {
          const url = await this.storage.getSignedUrl(tosKey, 31536000);
          await client.from('vehicle_images').insert({
            id: randomUUID(), vehicle_id: vehicleId, url, object_key: tosKey,
            is_primary: 1, sort_order: 0, created_at: t,
          });
          console.log(`[VehicleImage] Created real image for ${vehicleId}`);
        } catch (e) {
          console.error(`[VehicleImage] Failed to create for ${vehicleId}:`, e.message);
        }
      }
    }
  }

  private async seedBanners() {
    const client = this.getClient();
    const t = utc();
    // 轮播图使用车型真实 TOS 图片，不再用 SVG 文字占位
    const banners: { id: string; title: string; linkType: string; linkTarget: string; vehicleId: string }[] = [
      { id: 'b1', title: 'Z5(2026) 厢式货车 — 按趟即刻出发', linkType: 'vehicle', linkTarget: 'z5-2026', vehicleId: 'z5-2026' },
      { id: 'b2', title: 'Z8Max 冷藏配送 — 全程温控保障', linkType: 'vehicle', linkTarget: 'z8-max-c', vehicleId: 'z8-max-c' },
      { id: 'b3', title: 'Z5 多格货柜 — 企业包月专线', linkType: 'monthly', linkTarget: '', vehicleId: 'z5-multi' },
    ];
    for (let i = 0; i < banners.length; i++) {
      const { id, title, linkType, linkTarget, vehicleId } = banners[i];
      let imageUrl = '';
      let objectKey = '';
      // 从 vehicle_images 获取该车型的 TOS 真实图片
      const tosKey = REAL_VEHICLE_IMAGE_KEYS[vehicleId];
      if (tosKey) {
        objectKey = tosKey;
        try { imageUrl = await this.storage.getSignedUrl(tosKey, 31536000); } catch {}
      }
      if (!imageUrl) {
        // fallback: 从数据库取已有图片
        const { data: img } = await client.from('vehicle_images').select('url,object_key').eq('vehicle_id', vehicleId).eq('is_primary', 1).maybeSingle();
        if (img) { imageUrl = img.url; objectKey = img.object_key || ''; }
      }
      await client.from('content_banners').insert({
        id, image_url: imageUrl, object_key: objectKey,
        title, link_type: linkType, link_target: linkTarget,
        sort_order: i, enabled: 1, created_at: t, updated_at: t,
      });
    }
  }

  /** 确保 rental 车型也出现在按趟配送(single)模式中 */
  private async ensureRentalVehiclesInSingleMode() {
    const RENTAL_IDS = ['z8-chassis', 'z5-security', 'yokee', 'l4-kit'];
    try {
      const client = this.getClient();
      for (const vid of RENTAL_IDS) {
        const { data: row } = await client.from('vehicle_catalog').select('id,service_mode,modes_json').eq('id', vid).maybeSingle();
        if (!row) continue;
        const modes: string[] = Array.isArray(row.modes_json) ? row.modes_json : JSON.parse(row.modes_json || '[]');
        if (modes.includes('single') && row.service_mode === 'single') continue; // already updated
        const newModes = [...new Set([...modes, 'single', 'monthly'])];
        await client.from('vehicle_catalog').update({
          service_mode: 'single',
          modes_json: JSON.stringify(newModes),
          updated_at: new Date().toISOString(),
        }).eq('id', vid);
        console.log(`[VehicleMode] Updated ${vid}: service_mode=single, modes=${newModes.join(',')}`);
      }
    } catch (e) {
      console.error('[VehicleMode] Failed to update rental vehicles:', e?.message || e);
    }
  }

  /** 禁用没有真实图片的车型 */
  private async disableNoImageVehicles() {
    const DISABLE_IDS = ['l5', 'z8-chassis', 'z5-security', 'yokee', 'l4-kit', 'l5-monthly'];
    try {
      const client = this.getClient();
      for (const vid of DISABLE_IDS) {
        const { data: row } = await client.from('vehicle_catalog').select('id,enabled').eq('id', vid).maybeSingle();
        if (!row || !row.enabled) continue;
        await client.from('vehicle_catalog').update({ enabled: false, updated_at: new Date().toISOString() }).eq('id', vid);
        console.log(`[VehicleDisable] Disabled no-image vehicle: ${vid}`);
      }
    } catch (e) {
      console.error('[VehicleDisable] Failed:', e?.message || e);
    }
  }

  /** 更新轮播图为车型真实 TOS 图片 */
  private async updateBannersToRealImages() {
    try {
      const client = this.getClient();
      const bannerConfigs = [
        { id: 'b1', title: 'Z5(2026) 厢式货车 — 按趟即刻出发', vehicleId: 'z5-2026', linkType: 'vehicle', linkTarget: 'z5-2026' },
        { id: 'b2', title: 'Z8Max 冷藏配送 — 全程温控保障', vehicleId: 'z8-max-c', linkType: 'vehicle', linkTarget: 'z8-max-c' },
        { id: 'b3', title: 'Z5 多格货柜 — 企业包月专线', vehicleId: 'z5-multi', linkType: 'monthly', linkTarget: '' },
      ];
      for (const cfg of bannerConfigs) {
        const { data: existing } = await client.from('content_banners').select('id,image_url').eq('id', cfg.id).maybeSingle();
        const tosKey = REAL_VEHICLE_IMAGE_KEYS[cfg.vehicleId];
        let imageUrl = '';
        let objectKey = tosKey || '';
        if (tosKey) {
          try { imageUrl = await this.storage.getSignedUrl(tosKey, 31536000); } catch {}
        }
        if (!imageUrl) {
          const { data: img } = await client.from('vehicle_images').select('url,object_key').eq('vehicle_id', cfg.vehicleId).eq('is_primary', 1).maybeSingle();
          if (img) { imageUrl = img.url; objectKey = img.object_key || ''; }
        }
        if (!imageUrl) continue;
        if (existing) {
          // 如果已有记录但图片不是车型真实图片，则更新
          const isOldSvg = (existing.image_url || '').includes('svg+xml') || (existing.image_url || '').includes('bannerSvg');
          if (isOldSvg || !existing.image_url) {
            await client.from('content_banners').update({
              image_url: imageUrl, object_key: objectKey, title: cfg.title,
              link_type: cfg.linkType, link_target: cfg.linkTarget,
              updated_at: new Date().toISOString(),
            }).eq('id', cfg.id);
            console.log(`[Banner] Updated ${cfg.id} with real vehicle image`);
          }
        } else {
          // 不存在则插入
          await client.from('content_banners').insert({
            id: cfg.id, image_url: imageUrl, object_key: objectKey, title: cfg.title,
            link_type: cfg.linkType, link_target: cfg.linkTarget,
            sort_order: cfg.id === 'b1' ? 0 : cfg.id === 'b2' ? 1 : 2,
            enabled: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          });
          console.log(`[Banner] Created ${cfg.id} with real vehicle image`);
        }
      }
    } catch (e) {
      console.error('[Banner] Failed to update banners:', e?.message || e);
    }
  }

  private validatePricing(c: any) {
    const fields = ['baseDistanceMeters', 'baseFeeCents', 'distanceFeePerKmCents', 'coldChainFeeCents', 'overweightFeePerKgCents', 'overweightThresholdKg', 'nightFeeCents', 'remoteAreaFeeCents', 'defaultQuoteValidityHours'];
    if (fields.some(k => !Number.isFinite(Number(c[k])) || Number(c[k]) < 0)) throw new BadRequestException('计费规则必须为非负数');
    if (c.nightStartHour < 0 || c.nightStartHour > 23 || c.nightEndHour < 0 || c.nightEndHour > 23) throw new BadRequestException('夜间时段无效');
  }

  private async audit(adminId: string, action: string, type: string, id: string, detail: any) {
    await this.getClient().from('audit_logs').insert({
      id: randomUUID(), admin_user_id: adminId, action, target_type: type,
      target_id: id, detail: json(detail), created_at: utc(),
    });
  }

  // ─── Inquiries ───
  async getInquiryStats() {
    const client = this.getClient();
    const { data, error } = await client.from('inquiries').select('status');
    if (error) throw new Error(`查询咨询统计失败: ${error.message}`);
    const stats = { pending: 0, contacted: 0, closed: 0 };
    (data || []).forEach((r: any) => {
      if (r.status === 'pending') stats.pending++;
      else if (r.status === 'contacted') stats.contacted++;
      else if (r.status === 'closed') stats.closed++;
    });
    return stats;
  }

  async submitInquiry(data: any) {
    if (!data.type || !['monthly', 'rental'].includes(data.type))
      throw new BadRequestException('咨询类型无效');
    if (!data.contactName || !data.phone)
      throw new BadRequestException('姓名和电话为必填');
    if (data.type === 'monthly' && (!data.senderAddress || !data.receiverAddress))
      throw new BadRequestException('包月专线需填写收发货地址');

    const client = this.getClient();
    const t = utc();
    const id = randomUUID();
    const values: any = {
      id, type: data.type, contact_name: data.contactName, phone: data.phone,
      company_name: data.companyName || null, vehicle_id: data.vehicleId || null,
      consult_content: data.consultContent || null,
      status: 'pending', created_at: t, updated_at: t,
    };
    if (data.type === 'monthly') {
      values.sender_address = json(data.senderAddress || {});
      values.receiver_address = json(data.receiverAddress || {});
      values.cargo_type = data.cargoType || null;
      values.delivery_cycle = data.deliveryCycle || null;
      values.monthly_trips = data.monthlyTrips || null;
    }
    const { error } = await client.from('inquiries').insert(values);
    if (error) throw new Error(`提交咨询失败: ${error.message}`);
    return { id };
  }

  async listInquiries(page = 1, pageSize = 20, type?: string, status?: string) {
    const client = this.getClient();
    let query = client.from('inquiries').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (type) query = query.eq('type', type);
    if (status) query = query.eq('status', status);

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data: rows, error, count } = await query;
    if (error) throw new Error(`查询咨询失败: ${error.message}`);

    return {
      items: (rows || []).map((r: any) => ({
        id: r.id, type: r.type, vehicleId: r.vehicle_id,
        senderAddress: r.sender_address ? parse(r.sender_address) : null,
        receiverAddress: r.receiver_address ? parse(r.receiver_address) : null,
        cargoType: r.cargo_type, deliveryCycle: r.delivery_cycle,
        monthlyTrips: r.monthly_trips, contactName: r.contact_name,
        phone: r.phone, companyName: r.company_name,
        consultContent: r.consult_content, status: r.status, note: r.note,
        createdAt: r.created_at, updatedAt: r.updated_at,
      })),
      total: count || 0, page, totalPages: Math.ceil((count || 0) / pageSize),
    };
  }

  async updateInquiry(adminId: string, id: string, data: any) {
    const client = this.getClient();
    const t = utc();
    const values: any = { updated_at: t };
    if (data.status) values.status = data.status;
    if (data.note !== undefined) values.note = data.note;
    const { error } = await client.from('inquiries').update(values).eq('id', id);
    if (error) throw new Error(`更新咨询失败: ${error.message}`);
    await this.audit(adminId, 'inquiry.update', 'inquiry', id, data);
    return { success: true };
  }

  // ─── Contact Settings ───
  async getContactSettings() {
    const cacheKey = 'content:contact';
    const cached = serverCache.get<any>(cacheKey);
    if (cached) return cached;

    const client = this.getClient();
    const { data, error } = await client.from('contact_settings').select('*').limit(1).maybeSingle();
    if (error) throw new Error(`查询联系方式失败: ${error.message}`);
    if (!data) {
      // Seed default
      const t = utc();
      const id = randomUUID();
      await client.from('contact_settings').insert({
        id, phone: '400-888-9999', wechat: 'tangxs_official',
        email: 'service@tangxs.com', work_time: '工作日 9:00-18:00',
        extra_text: '我们将尽快与您联系，请保持电话畅通', updated_at: t,
      });
      const { data: newData } = await client.from('contact_settings').select('*').eq('id', id).maybeSingle();
      const result = newData ? { phone: newData.phone, wechat: newData.wechat, email: newData.email, workTime: newData.work_time, extraText: newData.extra_text } : null;
      serverCache.set(cacheKey, result, CACHE_TTL.STATIC);
      return result;
    }
    const result = { phone: data.phone, wechat: data.wechat, email: data.email, workTime: data.work_time, extraText: data.extra_text };
    serverCache.set(cacheKey, result, CACHE_TTL.STATIC);
    return result;
  }

  async saveContactSettings(adminId: string, data: any) {
    const client = this.getClient();
    const t = utc();
    const { data: existing } = await client.from('contact_settings').select('id').limit(1).maybeSingle();
    const values = {
      phone: data.phone || '', wechat: data.wechat || '',
      email: data.email || '', work_time: data.workTime || '工作日 9:00-18:00',
      extra_text: data.extraText || '', updated_at: t,
    };
    if (existing) {
      await client.from('contact_settings').update(values).eq('id', existing.id);
    } else {
      await client.from('contact_settings').insert({ id: randomUUID(), ...values });
    }
    await this.audit(adminId, 'contact.update', 'contact', existing?.id || 'new', data);
    serverCache.invalidate('content:contact');
    return this.getContactSettings();
  }
}
