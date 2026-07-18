import { Injectable } from '@nestjs/common';

/**
 * 车辆规格信息
 */
export interface VehicleSpecs {
  cargoVolume: string;
  maxLoad: string;
  maxRange: string;
  speed: string;
  chargeTime: string;
  temperatureRange?: string;
}

/**
 * 车辆价格信息
 */
export interface VehiclePrice {
  base?: number;
  monthly?: number;
  rental?: number;
  purchase?: number | string; // 允许为数字或字符串（如"咨询客服"）
}

/**
 * 车辆完整信息
 */
export interface Vehicle {
  id: string;
  name: string;
  fullName: string;
  category: 'logistics' | 'rental' | 'special';
  description: string;
  specs: VehicleSpecs;
  scenarios: string[];
  price?: VehiclePrice;
}

/**
 * 车辆服务
 * 提供九识全系车辆数据查询
 */
@Injectable()
export class VehiclesService {
  // 九识全系车辆数据（与前端保持一致）
  private vehicles: Vehicle[] = [
    // 物流配送车型
    {
      id: 'z2',
      name: 'Z2',
      fullName: 'Z2 城市配送无人车',
      category: 'logistics',
      description: '紧凑型城市配送无人车，适合短距离高频配送场景',
      specs: {
        cargoVolume: '2m³',
        maxLoad: '200kg',
        maxRange: '50km',
        speed: '15km/h',
        chargeTime: '2小时快充',
      },
      scenarios: ['城市配送', '社区配送', '商超配送'],
      price: { base: 25, monthly: 800 },
    },
    {
      id: 'z5-2026',
      name: 'Z5(2026)',
      fullName: 'Z5(2026) 增强版厢货无人车',
      category: 'logistics',
      description: '中型厢货无人车，2026款增强版，载货能力更强',
      specs: {
        cargoVolume: '5m³',
        maxLoad: '500kg',
        maxRange: '80km',
        speed: '20km/h',
        chargeTime: '3小时快充',
      },
      scenarios: ['城市配送', '园区配送', '批发市场'],
      price: { base: 35, monthly: 1200 },
    },
    {
      id: 'l5',
      name: 'L5',
      fullName: 'L5 轻型配送无人车',
      category: 'logistics',
      description: '轻型配送无人车，灵活性高，适合多点配送',
      specs: {
        cargoVolume: '4m³',
        maxLoad: '300kg',
        maxRange: '60km',
        speed: '18km/h',
        chargeTime: '2.5小时快充',
      },
      scenarios: ['城市配送', '生鲜配送', '快递配送'],
      price: { base: 30, monthly: 1000 },
    },
    {
      id: 'l5-max',
      name: 'L5 Max',
      fullName: 'L5 Max 大容量配送无人车',
      category: 'logistics',
      description: 'L5增强版，容量更大，续航更久',
      specs: {
        cargoVolume: '5m³',
        maxLoad: '400kg',
        maxRange: '70km',
        speed: '18km/h',
        chargeTime: '2.5小时快充',
      },
      scenarios: ['城市配送', '生鲜配送', '园区配送'],
      price: { base: 32, monthly: 1100 },
    },
    {
      id: 'z8',
      name: 'Z8',
      fullName: 'Z8 常温厢货无人车',
      category: 'logistics',
      description: '大型厢货无人车，适合中长途配送',
      specs: {
        cargoVolume: '8m³',
        maxLoad: '800kg',
        maxRange: '100km',
        speed: '25km/h',
        chargeTime: '4小时快充',
      },
      scenarios: ['城市配送', '干线转运', '批发配送'],
      price: { base: 45, monthly: 1500 },
    },
    {
      id: 'z8-max',
      name: 'Z8 Max',
      fullName: 'Z8 Max 常温厢货无人车',
      category: 'logistics',
      description: 'Z8增强版，最大载货量，适合大批量配送',
      specs: {
        cargoVolume: '10m³',
        maxLoad: '1000kg',
        maxRange: '120km',
        speed: '25km/h',
        chargeTime: '4小时快充',
      },
      scenarios: ['城市配送', '干线转运', '批发配送'],
      price: { base: 50, monthly: 1800 },
    },
    {
      id: 'z5-c',
      name: 'Z5-C',
      fullName: 'Z5-C 冷藏配送无人车',
      category: 'logistics',
      description: '中型冷藏无人车，精准温控，适合生鲜冷链',
      specs: {
        cargoVolume: '4m³',
        maxLoad: '400kg',
        maxRange: '80km',
        speed: '20km/h',
        chargeTime: '3小时快充',
        temperatureRange: '-20℃~12℃',
      },
      scenarios: ['生鲜配送', '冷链运输', '药品配送'],
      price: { base: 40, monthly: 1500 },
    },
    {
      id: 'z8-max-c',
      name: 'Z8Max冷藏',
      fullName: 'Z8 Max 冷藏配送无人车',
      category: 'logistics',
      description: '大型冷藏无人车，大容量温控配送',
      specs: {
        cargoVolume: '8m³',
        maxLoad: '800kg',
        maxRange: '100km',
        speed: '25km/h',
        chargeTime: '4小时快充',
        temperatureRange: '-20℃~12℃',
      },
      scenarios: ['生鲜配送', '冷链运输', '药品配送'],
      price: { base: 55, monthly: 2000 },
    },
    {
      id: 'z5-multi',
      name: 'Z5多格货柜',
      fullName: 'Z5 多格货柜配送无人车',
      category: 'logistics',
      description: '多格货柜设计，适合多品类分区配送',
      specs: {
        cargoVolume: '5m³(分4格)',
        maxLoad: '400kg',
        maxRange: '80km',
        speed: '20km/h',
        chargeTime: '3小时快充',
      },
      scenarios: ['生鲜配送', '商超配送', '多点配送'],
      price: { base: 38, monthly: 1300 },
    },
    // 租车购车额外车型
    {
      id: 'z8-chassis',
      name: 'Z8二类底盘',
      fullName: 'Z8 二类底盘无人车平台',
      category: 'special',
      description: '无人车二类底盘，可定制上装',
      specs: {
        cargoVolume: '定制',
        maxLoad: '1500kg',
        maxRange: '120km',
        speed: '30km/h',
        chargeTime: '4小时快充',
      },
      scenarios: ['定制改装', '物流平台', '特种设备'],
      price: { purchase: '咨询客服' },
    },
    {
      id: 'z5-security',
      name: 'Z5安防车',
      fullName: 'Z5 空地安防无人车',
      category: 'special',
      description: '安防巡逻无人车，支持空地联动',
      specs: {
        cargoVolume: '安防设备',
        maxLoad: '200kg',
        maxRange: '60km',
        speed: '25km/h',
        chargeTime: '2.5小时快充',
      },
      scenarios: ['园区安防', '巡逻监控', '应急响应'],
      price: { rental: 3000, purchase: '咨询客服' },
    },
    {
      id: 'yokee',
      name: 'Yokee观光车',
      fullName: 'Yokee 智能观光无人车',
      category: 'rental',
      description: '智能观光无人车，适合景区园区',
      specs: {
        cargoVolume: '8座',
        maxLoad: '800kg',
        maxRange: '80km',
        speed: '20km/h',
        chargeTime: '3小时快充',
      },
      scenarios: ['景区观光', '园区摆渡', '展会导览'],
      price: { rental: 5000, purchase: '咨询客服' },
    },
    {
      id: 'l4-kit',
      name: 'L4套件',
      fullName: 'L4 自动驾驶套件',
      category: 'special',
      description: 'L4级自动驾驶改装套件，支持车辆智能化升级',
      specs: {
        cargoVolume: '套件',
        maxLoad: '适配多种车型',
        maxRange: '取决于原车',
        speed: '取决于原车',
        chargeTime: '取决于原车',
      },
      scenarios: ['车辆改装', '智能升级', '自动驾驶'],
      price: { purchase: '咨询客服' },
    },
  ];

  /**
   * 获取所有车辆
   */
  async findAll(): Promise<Vehicle[]> {
    return this.vehicles;
  }

  /**
   * 获取物流配送车型（用于下单页）
   */
  async findLogistics(): Promise<Vehicle[]> {
    return this.vehicles.filter(v => v.category === 'logistics');
  }

  /**
   * 获取租车购车车型（用于租购页）
   */
  async findRental(): Promise<Vehicle[]> {
    return this.vehicles.filter(v => v.category === 'rental');
  }

  /**
   * 获取单个车辆详情
   */
  async findOne(id: string): Promise<Vehicle | null> {
    return this.vehicles.find(v => v.id === id) || null;
  }
}