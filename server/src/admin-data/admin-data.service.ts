import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { hashToken, verifyPassword } from '../auth/security';

type AdminIdentity = { id: string; username: string; role: string };

const now = () => new Date().toISOString();

@Injectable()
export class AdminDataService {
  constructor(private readonly supabase: SupabaseService) {}

  async authenticate(username: string, password: string): Promise<AdminIdentity> {
    const { data: row, error } = await this.supabase
      .getClient()
      .from('admin_users')
      .select('*')
      .eq('username', username)
      .maybeSingle();

    if (error || !row || row.status !== 'active' || !verifyPassword(password, row.password_hash)) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    return { id: row.id, username: row.username, role: row.role };
  }

  async createAdminSession(adminId: string, hours = 12) {
    const token = randomBytes(32).toString('base64url');
    const createdAt = now();
    const expiresAt = new Date(Date.now() + hours * 3_600_000).toISOString();
    const values = {
      id: randomUUID(),
      admin_user_id: adminId,
      token_hash: hashToken(token),
      expires_at: expiresAt,
      created_at: createdAt,
    };
    const { error } = await this.supabase.getClient().from('admin_sessions').insert(values);
    if (error) throw new Error(`创建管理员会话失败: ${error.message}`);
    return { token, expiresAt };
  }

  async revokeAdminSession(token: string) {
    await this.supabase
      .getClient()
      .from('admin_sessions')
      .update({ revoked_at: now() })
      .eq('token_hash', hashToken(token));
  }

  async adminFromSession(token: string): Promise<AdminIdentity | null> {
    const client = this.supabase.getClient();
    const { data: session } = await client
      .from('admin_sessions')
      .select('admin_user_id')
      .eq('token_hash', hashToken(token))
      .is('revoked_at', null)
      .gt('expires_at', now())
      .maybeSingle();
    if (!session) return null;

    const { data: row } = await client
      .from('admin_users')
      .select('id,username,role,status')
      .eq('id', session.admin_user_id)
      .maybeSingle();

    return row?.status === 'active'
      ? { id: row.id, username: row.username, role: row.role }
      : null;
  }
}
