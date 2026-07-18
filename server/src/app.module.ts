import { Module } from '@nestjs/common';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { OrdersModule } from '@/orders/orders.module';
import { ConfigModule } from '@/config/config.module';
import { VehiclesModule } from '@/vehicles/vehicles.module';
import { DatabaseModule } from '@/database/database.module';
import { AdminModule } from '@/admin/admin.module';
import { AddressesModule } from '@/addresses/addresses.module';
import { OperationsModule } from '@/operations/operations.module';
import { AuthModule } from '@/auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule, OrdersModule, AdminModule, AddressesModule, OperationsModule, ConfigModule, VehiclesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
