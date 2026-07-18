import { Module } from '@nestjs/common';
import { AddressesController } from './addresses.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [SupabaseModule, AuthModule],
  controllers: [AddressesController],
})
export class AddressesModule {}
