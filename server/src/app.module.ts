import { Module } from '@nestjs/common';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { OrdersModule } from '@/orders/orders.module';
import { SupabaseModule } from '@/supabase/supabase.module';
import { StorageModule } from '@/storage/storage.module';
import { AdminModule } from '@/admin/admin.module';
import { AddressesModule } from '@/addresses/addresses.module';
import { OperationsModule } from '@/operations/operations.module';
import { AuthModule } from '@/auth/auth.module';

@Module({
  imports: [SupabaseModule, StorageModule, AuthModule, OrdersModule, AdminModule, AddressesModule, OperationsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
