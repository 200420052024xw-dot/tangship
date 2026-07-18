import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { UserAuthGuard, AdminAuthGuard } from './auth';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [AuthController],
  providers: [UserAuthGuard, AdminAuthGuard],
  exports: [UserAuthGuard, AdminAuthGuard],
})
export class AuthModule {}
