import { BadRequestException, ConflictException, Injectable, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
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

@Injectable()
export class OperationsService implements OnModuleInit {
  constructor(private supabase: SupabaseService, private storage: StorageService) {}

  private getClient() { return this.supabase.getClient(); }

  async onModuleInit() {
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
  }

  async listVehicles(admin = false) {
    const cacheKey = admin ? CACHE_KEYS.VEHICLE_CATALOG + ':admin' : CACHE_KEYS.VEHICLE_CATALOG;
    const cached = serverCache.get<any[]>(cacheKey);
    if (cached) return cached;

    const client = this.getClient();
    // 批量查询: 一次取车型 + 一次取所有图片（消除 N+1）
    let query = client.from('vehicle_catalog').select('*').order('sort_order', { ascending: true }).order('id', { ascending: true });
    if (!admin) query = query.eq('enabled', 1);
    const [{ data: rows, error }, { data: allImgs }] = await Promise.all([
      query,
      client.from('vehicle_images').select('vehicle_id, url, is_primary, sort_order'),
    ]);
    if (error) throw new Error(`查询车型失败: ${error.message}`);

    // 按车型分组图片
    const imgMap = new Map<string, string[]>();
    for (const img of (allImgs || [])) {
      const list = imgMap.get(img.vehicle_id) || [];
      list.push(img.url);
      imgMap.set(img.vehicle_id, list);
    }

    const result = (rows || []).map((v: any) => ({
      id: v.id, name: v.name, fullName: v.full_name, subtitle: v.subtitle,
      description: v.description, enabled: !!v.enabled, requiresApproval: !!v.requires_approval,
      sortOrder: v.sort_order, specs: parse(v.specs_json), applicableScenes: parse(v.scenes_json),
      restrictions: parse(v.restrictions_json), supportedModes: parse(v.modes_json),
      pricingDescription: parse(v.pricing_hint_json), tags: parse(v.tags_json),
      images: imgMap.get(v.id) || [],
    }));

    serverCache.set(cacheKey, result, CACHE_TTL.STATIC);
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
      modes_json: json(b.supportedModes || ['single']), pricing_hint_json: json(b.pricingDescription || {}),
      tags_json: json(b.tags || []), enabled: b.enabled === false ? 0 : 1,
      requires_approval: b.requiresApproval ? 1 : 0, sort_order: Number(b.sortOrder) || 0, updated_at: t,
    };

    if (exists) {
      await client.from('vehicle_catalog').update(values).eq('id', id);
    } else {
      await client.from('vehicle_catalog').insert({ id, ...values, created_at: t });
    }
    await this.audit(adminId, exists ? 'vehicle.update' : 'vehicle.create', 'vehicle', id, { name: b.name });
    serverCache.invalidatePrefix(CACHE_KEYS.VEHICLE_CATALOG);
    return this.getVehicle(id);
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

    const result = (rows || []).map((v: any) => ({
      id: v.id, image: v.image_url, imageUrl: v.image_url, title: v.title,
      linkType: v.link_type, linkTarget: v.link_target, sortOrder: v.sort_order,
      sort: v.sort_order, enabled: !!v.enabled, createdAt: v.created_at, updatedAt: v.updated_at,
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

  preview(input: any, useDraft = false) {
    const state = this.pricing(); // Note: sync call - should be async but keeping compat
    const config = (useDraft ? (state as any).draft?.config : (state as any).published?.config) || DEFAULT_PRICING;
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
    const configs: [string, string, string][] = [
      ['z2', '#3B82F6', '🚗'], ['z5-2026', '#10B981', '🚐'], ['l5', '#8B5CF6', '🚚'],
      ['l5-max', '#7C3AED', '🚛'], ['z8', '#F59E0B', '🚛'], ['z8-max', '#D97706', '🚛'],
      ['z5-c', '#06B6D4', '❄️'], ['z8-max-c', '#0891B2', '❄️'], ['z5-multi', '#EC4899', '📦'],
      ['z8-chassis', '#64748B', '🔧'], ['z5-security', '#EF4444', '🛡️'], ['yokee', '#F97316', '🚌'],
      ['l4-kit', '#6366F1', '⚙️'],
    ];
    for (const [vehicleId, color, icon] of configs) {
      const { data: vehicle } = await client.from('vehicle_catalog').select('id').eq('id', vehicleId).maybeSingle();
      if (!vehicle) continue;
      const url = this.vehicleSvg(CANONICAL_VEHICLES.find(v => v.id === vehicleId)?.name || vehicleId, color, icon);
      await client.from('vehicle_images').insert({
        id: randomUUID(), vehicle_id: vehicleId, url, object_key: '',
        is_primary: 1, sort_order: 0, created_at: t,
      });
    }
  }

  private async seedBanners() {
    const client = this.getClient();
    const t = utc();
    const banners: [string, string, string, string, string][] = [
      ['b1', '按趟配送，即刻出发', '灵活调度，城市末端高效送达', '#3B82F6', '#1D4ED8'],
      ['b2', '企业包月，省心省钱', '固定线路包月方案，专属运力保障', '#10B981', '#059669'],
      ['b3', '冷链配送，品质保障', '全程温控，生鲜医药安全送达', '#06B6D4', '#0891B2'],
    ];
    for (let i = 0; i < banners.length; i++) {
      const [id, title, sub, c1, c2] = banners[i];
      await client.from('content_banners').insert({
        id, image_url: this.bannerSvg(title, sub, c1, c2), object_key: '',
        title, link_type: i === 0 ? 'vehicle' : 'monthly', link_target: i === 0 ? 'z2' : '',
        sort_order: i, enabled: 1, created_at: t, updated_at: t,
      });
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
}
