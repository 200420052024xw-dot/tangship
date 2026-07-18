import { Controller, Get, Param } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { Vehicle } from './vehicles.service';

/**
 * 车辆控制器
 * ⚠️ 开发阶段原型接口 - 当前使用内存数据，无鉴权
 * TODO: 接入数据库、添加鉴权
 */
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  /**
   * 获取所有车辆
   */
  @Get()
  async findAll(): Promise<{ code: number; msg: string; data: Vehicle[] }> {
    console.log('[GET /api/vehicles]');
    
    const vehicles = await this.vehiclesService.findAll();
    return { code: 200, msg: '查询成功', data: vehicles };
  }

  /**
   * 获取物流配送车型
   */
  @Get('logistics')
  async findLogistics(): Promise<{ code: number; msg: string; data: Vehicle[] }> {
    console.log('[GET /api/vehicles/logistics]');
    
    const vehicles = await this.vehiclesService.findLogistics();
    return { code: 200, msg: '查询成功', data: vehicles };
  }

  /**
   * 获取租车购车车型
   */
  @Get('rental')
  async findRental(): Promise<{ code: number; msg: string; data: Vehicle[] }> {
    console.log('[GET /api/vehicles/rental]');
    
    const vehicles = await this.vehiclesService.findRental();
    return { code: 200, msg: '查询成功', data: vehicles };
  }

  /**
   * 获取单个车辆详情
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<{ code: number; msg: string; data: Vehicle | null }> {
    console.log('[GET /api/vehicles/:id]', { id });
    
    const vehicle = await this.vehiclesService.findOne(id);
    if (!vehicle) {
      return { code: 404, msg: '车辆不存在', data: null };
    }
    return { code: 200, msg: '查询成功', data: vehicle };
  }
}