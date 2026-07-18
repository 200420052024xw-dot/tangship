import { Injectable } from '@nestjs/common';
import { PricingConfig, CustomerServiceConfig } from './config.types';

/**
 * 配置服务
 * 处理计价配置、客服联系方式配置等
 */
@Injectable()
export class ConfigService {
  // 计价配置
  private pricingConfig: PricingConfig = {
    baseDistance: 3000,
    basePrice: 25,
    pricePerKm: 4,
    vehiclePriceMultiplier: {
      'z2': 1.0,
      'z5-2026': 1.2,
      'l5': 1.1,
      'l5-max': 1.15,
      'z8': 1.3,
      'z8-max': 1.4,
      'z5-c': 1.35,
      'z8-max-c': 1.5,
      'z5-multi': 1.25,
    },
    coldChainFee: 15,
    overweightFee: 0.5,
    overweightThreshold: 300,
    nightFee: 10,
    nightStartHour: 22,
    nightEndHour: 6,
    remoteAreaFee: 20,
    remoteAreas: ['古冶区', '开平区', '丰南区', '曹妃甸区'],
  };

  // 客服联系方式配置
  private customerServiceConfig: CustomerServiceConfig = {
    phone: '400-888-8888',
    wechat: 'tangxiaoshi_service',
    workTime: '周一至周日 8:00-20:00',
  };

  /**
   * 获取计价配置
   */
  async getPricingConfig(): Promise<PricingConfig> {
    return this.pricingConfig;
  }

  /**
   * 更新计价配置
   */
  async updatePricingConfig(config: Partial<PricingConfig>): Promise<PricingConfig> {
    this.pricingConfig = { ...this.pricingConfig, ...config };
    return this.pricingConfig;
  }

  /**
   * 重置计价配置为默认值
   */
  async resetPricingConfig(): Promise<PricingConfig> {
    this.pricingConfig = {
      baseDistance: 3000,
      basePrice: 25,
      pricePerKm: 4,
      vehiclePriceMultiplier: {
        'z2': 1.0,
        'z5-2026': 1.2,
        'l5': 1.1,
        'l5-max': 1.15,
        'z8': 1.3,
        'z8-max': 1.4,
        'z5-c': 1.35,
        'z8-max-c': 1.5,
        'z5-multi': 1.25,
      },
      coldChainFee: 15,
      overweightFee: 0.5,
      overweightThreshold: 300,
      nightFee: 10,
      nightStartHour: 22,
      nightEndHour: 6,
      remoteAreaFee: 20,
      remoteAreas: ['古冶区', '开平区', '丰南区', '曹妃甸区'],
    };
    return this.pricingConfig;
  }

  /**
   * 获取客服联系方式配置
   */
  async getCustomerServiceConfig(): Promise<CustomerServiceConfig> {
    return this.customerServiceConfig;
  }

  /**
   * 更新客服联系方式配置
   */
  async updateCustomerServiceConfig(config: Partial<CustomerServiceConfig>): Promise<CustomerServiceConfig> {
    this.customerServiceConfig = { ...this.customerServiceConfig, ...config };
    return this.customerServiceConfig;
  }
}