import { Controller, Get, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ConfigService } from './config.service';
import { PricingConfig, CustomerServiceConfig } from './config.types';

/**
 * 配置控制器
 * ⚠️ 开发阶段原型接口 - 当前使用内存数据，无鉴权，POST 接口不可作为生产接口开放
 * TODO: 接入数据库、添加鉴权、添加管理员权限校验
 */
@Controller('config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  /**
   * 获取计价配置
   */
  @Get('pricing')
  async getPricingConfig(): Promise<{ code: number; msg: string; data: PricingConfig }> {
    console.log('[GET /api/config/pricing]');
    
    const config = await this.configService.getPricingConfig();
    return { code: 200, msg: '查询成功', data: config };
  }

  /**
   * 更新计价配置
   */
  @Post('pricing')
  @HttpCode(HttpStatus.OK)
  async updatePricingConfig(
    @Body() body: Partial<PricingConfig>
  ): Promise<{ code: number; msg: string; data: PricingConfig }> {
    console.log('[POST /api/config/pricing]', body);
    
    const config = await this.configService.updatePricingConfig(body);
    return { code: 200, msg: '配置更新成功', data: config };
  }

  /**
   * 重置计价配置
   */
  @Post('pricing/reset')
  @HttpCode(HttpStatus.OK)
  async resetPricingConfig(): Promise<{ code: number; msg: string; data: PricingConfig }> {
    console.log('[POST /api/config/pricing/reset]');
    
    const config = await this.configService.resetPricingConfig();
    return { code: 200, msg: '配置已重置为默认值', data: config };
  }

  /**
   * 获取客服联系方式配置
   */
  @Get('customer-service')
  async getCustomerServiceConfig(): Promise<{ code: number; msg: string; data: CustomerServiceConfig }> {
    console.log('[GET /api/config/customer-service]');
    
    const config = await this.configService.getCustomerServiceConfig();
    return { code: 200, msg: '查询成功', data: config };
  }

  /**
   * 更新客服联系方式配置
   */
  @Post('customer-service')
  @HttpCode(HttpStatus.OK)
  async updateCustomerServiceConfig(
    @Body() body: Partial<CustomerServiceConfig>
  ): Promise<{ code: number; msg: string; data: CustomerServiceConfig }> {
    console.log('[POST /api/config/customer-service]', body);
    
    const config = await this.configService.updateCustomerServiceConfig(body);
    return { code: 200, msg: '配置更新成功', data: config };
  }
}