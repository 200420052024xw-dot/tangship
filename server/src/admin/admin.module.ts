import { Module } from '@nestjs/common';
import { AdminAuthController, AdminController } from './admin.controller';
import { AdminOrdersService } from './admin-orders.service';
import { OrdersModule } from '../orders/orders.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [OrdersModule, SupabaseModule],
  controllers: [AdminAuthController, AdminController],
  providers: [AdminOrdersService],
  exports: [AdminOrdersService],
})
export class AdminModule {}
