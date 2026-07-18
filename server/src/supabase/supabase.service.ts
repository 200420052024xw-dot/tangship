import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '../storage/database/supabase-client';

@Injectable()
export class SupabaseService {
  /** 获取 Supabase 客户端（使用 service_role_key，绕过 RLS） */
  getClient() {
    return getSupabaseClient();
  }
}
