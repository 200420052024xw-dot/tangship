/**
 * 配置模块
 * 处理计价配置、客服联系方式配置等
 */
import { Module } from '@nestjs/common';
import { ConfigController } from './config.controller';
import { ConfigService } from './config.service';

@Module({
  controllers: [ConfigController],
  providers: [ConfigService],
})
export class ConfigModule {}