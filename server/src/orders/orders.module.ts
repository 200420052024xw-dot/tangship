/**
 * 订单模块
 * 处理散单、包月咨询单、租购咨询单
 */
import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { UserAuthGuard } from '../auth/auth';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, UserAuthGuard],
  exports: [OrdersService],
})
export class OrdersModule {}
