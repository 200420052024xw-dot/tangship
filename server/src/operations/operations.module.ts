import { Module } from '@nestjs/common';
import { PublicContentController, AdminOperationsController } from './operations.controller';
import { OperationsService } from './operations.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { StorageModule } from '../storage/storage.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [SupabaseModule, StorageModule, AuthModule],
  controllers: [PublicContentController, AdminOperationsController],
  providers: [OperationsService],
})
export class OperationsModule {}
