import { Global, Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { AdminDataService } from './admin-data.service';

@Global()
@Module({
  imports: [SupabaseModule],
  providers: [AdminDataService],
  exports: [AdminDataService],
})
export class AdminDataModule {}
