import { randomUUID } from 'node:crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { hashPassword } from '../auth/auth';

export async function seedSupabase(supabase: SupabaseService) {
  const client = supabase.getClient();
  const now = new Date().toISOString();

  // 1. Seed the initial admin from server-side environment variables.
  const adminUsername = process.env.INIT_ADMIN_USERNAME?.trim();
  const adminPassword = process.env.INIT_ADMIN_PASSWORD;
  const defaultAdmins = adminUsername && adminPassword
    ? [{ username: adminUsername, password: adminPassword, role: 'super_admin' }]
    : [];
  for (const a of defaultAdmins) {
    const { data: existing } = await client.from('admin_users').select('id').eq('username', a.username).maybeSingle();
    if (!existing) {
      await client.from('admin_users').insert({
        id: randomUUID(), username: a.username, password_hash: hashPassword(a.password),
        role: a.role, status: 'active', created_at: now, updated_at: now,
      });
      console.log(`[Seed] Admin user created (${a.username})`);
    }
  }

  // 2. Seed vehicle catalog
  const { count: vehicleCount } = await client.from('vehicle_catalog').select('*', { count: 'exact', head: true });
  if (!vehicleCount) {
    const vehicles = [
      { id: 'z2', name: 'Z2 智能配送车', category: 'standard', description: '小巧灵活，适合城市短途配送', supported_modes: ['single'], payload_kg: 200, volume_m3: 1.2, max_range_km: 40, max_speed_kmh: 25, temperature_range: '常温', sort_order: 1 },
      { id: 'z5-2026', name: 'Z5(2026) 厢式货车', category: 'standard', description: '2026款厢式货车，城市配送主力', supported_modes: ['single', 'monthly'], payload_kg: 500, volume_m3: 3, max_range_km: 80, max_speed_kmh: 30, temperature_range: '常温', sort_order: 2 },
      { id: 'l5', name: 'L5 智能物流车', category: 'logistics', description: '智能物流运输，中长途首选', supported_modes: ['single', 'monthly'], payload_kg: 1000, volume_m3: 5, max_range_km: 150, max_speed_kmh: 40, temperature_range: '常温', sort_order: 3 },
      { id: 'l5-max', name: 'L5Max 智能物流车', category: 'logistics', description: '增强版智能物流车，更大载重', supported_modes: ['single', 'monthly'], payload_kg: 1500, volume_m3: 8, max_range_km: 120, max_speed_kmh: 40, temperature_range: '常温', sort_order: 4 },
      { id: 'z8', name: 'Z8 常温配送车', category: 'standard', description: '大容量常温配送车', supported_modes: ['single', 'monthly'], payload_kg: 800, volume_m3: 6, max_range_km: 60, max_speed_kmh: 30, temperature_range: '常温', sort_order: 5 },
      { id: 'z8-max', name: 'Z8Max 常温配送车', category: 'standard', description: '增强版常温配送车', supported_modes: ['single', 'monthly'], payload_kg: 1200, volume_m3: 10, max_range_km: 50, max_speed_kmh: 30, temperature_range: '常温', sort_order: 6 },
      { id: 'z5-c', name: 'Z5-C 冷藏配送车', category: 'cold_chain', description: '冷链运输，保障货物品质', supported_modes: ['single', 'monthly'], payload_kg: 400, volume_m3: 2.5, max_range_km: 60, max_speed_kmh: 30, temperature_range: '-18°C~8°C', sort_order: 7 },
      { id: 'z8-max-c', name: 'Z8Max 冷藏配送车', category: 'cold_chain', description: '大容量冷链配送车', supported_modes: ['single', 'monthly'], payload_kg: 1000, volume_m3: 6, max_range_km: 50, max_speed_kmh: 30, temperature_range: '-18°C~8°C', sort_order: 8 },
      { id: 'z5-multi', name: 'Z5 多格货柜车', category: 'standard', description: '多温区多格配送，一车多单', supported_modes: ['single'], payload_kg: 600, volume_m3: 4, max_range_km: 60, max_speed_kmh: 30, temperature_range: '多温区', sort_order: 9 },
      { id: 'z8-chassis', name: 'Z8 二类底盘', category: 'chassis', description: '底盘产品，可按需改装', supported_modes: ['rental', 'purchase'], payload_kg: 2000, volume_m3: 0, max_range_km: 100, max_speed_kmh: 50, temperature_range: 'N/A', sort_order: 10 },
      { id: 'z5-security', name: 'Z5 空地安防车', category: 'special', description: '空地一体安防巡逻', supported_modes: ['monthly', 'rental'], payload_kg: 300, volume_m3: 1.5, max_range_km: 80, max_speed_kmh: 30, temperature_range: 'N/A', sort_order: 11 },
      { id: 'yokee', name: 'Yokee 观光车', category: 'special', description: '景区观光，低速安全', supported_modes: ['rental', 'purchase'], payload_kg: 800, volume_m3: 0, max_range_km: 60, max_speed_kmh: 20, temperature_range: 'N/A', sort_order: 12 },
      { id: 'l4-kit', name: 'L4 自动驾驶套件', category: 'kit', description: '可安装于现有车辆', supported_modes: ['purchase'], payload_kg: 50, volume_m3: 0.2, max_range_km: 0, max_speed_kmh: 0, temperature_range: 'N/A', sort_order: 13 },
    ];
    for (const v of vehicles) {
      await client.from('vehicle_catalog').insert({ ...v, status: 'active', created_at: now, updated_at: now });
    }
    console.log(`[Seed] ${vehicles.length} vehicles seeded`);
  }

  // 3. Seed banners
  const { count: bannerCount } = await client.from('content_banners').select('*', { count: 'exact', head: true });
  if (!bannerCount) {
    await client.from('content_banners').insert([
      { id: randomUUID(), title: '按趟配送', subtitle: '随叫随到，快速送达', sort_order: 1, status: 'active', created_at: now, updated_at: now },
      { id: randomUUID(), title: '企业包月', subtitle: '长期合作，优惠多多', sort_order: 2, status: 'active', created_at: now, updated_at: now },
      { id: randomUUID(), title: '冷链配送', subtitle: '全程冷链，品质保障', sort_order: 3, status: 'active', created_at: now, updated_at: now },
    ]);
    console.log('[Seed] 3 banners seeded');
  }
}
