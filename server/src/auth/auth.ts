import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { SupabaseService } from '../supabase/supabase.service';

export const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
};

export const verifyPassword = (password: string, stored: string) => {
  const [salt, key] = String(stored || '').split(':');
  if (!salt || !key) return false;
  const expected = Buffer.from(key, 'hex');
  if (expected.length !== 64) return false;
  return timingSafeEqual(expected, scryptSync(password, salt, 64));
};

export const bearer = (h?: string) => (h?.startsWith('Bearer ') ? h.slice(7) : '');
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class UserAuthGuard implements CanActivate {
  constructor(private supabase: SupabaseService) {}

  async canActivate(c: ExecutionContext) {
    const req = c.switchToHttp().getRequest();
    const client = this.supabase.getClient();

    // Dev auth fallback
    if (!bearer(req.headers.authorization) && process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_AUTH === 'true') {
      const openid = String(req.headers['x-dev-user'] || 'dev-user');
      const now = new Date().toISOString();
      let { data: u } = await client.from('users').select('id').eq('openid', openid).maybeSingle();
      if (!u) {
        const id = randomUUID();
        const { error } = await client.from('users').insert({ id, openid, nickname: openid, status: 'active', created_at: now, updated_at: now });
        if (error) throw new UnauthorizedException('创建用户失败');
        u = { id };
      }
      req.user = { id: u.id };
      return true;
    }

    const token = bearer(req.headers.authorization);
    if (!token) throw new UnauthorizedException('用户未登录');

    const tokenHash = hashToken(token);
    const now = new Date().toISOString();
    const { data: session } = await client
      .from('user_sessions')
      .select('user_id')
      .eq('token_hash', tokenHash)
      .is('revoked_at', null)
      .gt('expires_at', now)
      .maybeSingle();

    if (!session) throw new UnauthorizedException('用户未登录或会话已过期');
    req.user = { id: session.user_id };
    return true;
  }
}

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private supabase: SupabaseService) {}

  async canActivate(c: ExecutionContext) {
    const req = c.switchToHttp().getRequest();
    const cookie = String(req.headers.cookie || '').split(';').map((v: string) => v.trim()).find((v: string) => v.startsWith('admin_session='));
    const token = cookie ? decodeURIComponent(cookie.slice(14)) : bearer(req.headers.authorization);
    if (!token) throw new UnauthorizedException('管理员未登录');

    const client = this.supabase.getClient();
    const now = new Date().toISOString();
    const { data: row } = await client
      .from('admin_sessions')
      .select('admin_user_id')
      .eq('token_hash', hashToken(token))
      .is('revoked_at', null)
      .gt('expires_at', now)
      .maybeSingle();

    if (!row) throw new UnauthorizedException('管理员未登录或会话已过期');

    // Get admin user info
    const { data: adminUser } = await client
      .from('admin_users')
      .select('id, username, role, status')
      .eq('id', row.admin_user_id)
      .maybeSingle();

    if (!adminUser || adminUser.status !== 'active') throw new UnauthorizedException('管理员已停用');
    req.admin = { id: adminUser.id, username: adminUser.username, role: adminUser.role };
    return true;
  }
}

export async function issueSession(supabase: SupabaseService, userId: string, hours = 24) {
  const token = randomBytes(32).toString('base64url');
  const now = new Date();
  const expires = new Date(now.getTime() + hours * 3600000);
  const client = supabase.getClient();
  const { error } = await client.from('user_sessions').insert({
    id: randomUUID(), user_id: userId, token_hash: hashToken(token),
    expires_at: expires.toISOString(), created_at: now.toISOString(),
  });
  if (error) throw new Error(`创建会话失败: ${error.message}`);
  return { token, expiresAt: expires.toISOString() };
}

export async function issueAdminSession(supabase: SupabaseService, adminId: string, hours = 12) {
  const token = randomBytes(32).toString('base64url');
  const now = new Date();
  const expires = new Date(now.getTime() + hours * 3600000);
  const client = supabase.getClient();
  const { error } = await client.from('admin_sessions').insert({
    id: randomUUID(), admin_user_id: adminId, token_hash: hashToken(token),
    expires_at: expires.toISOString(), created_at: now.toISOString(),
  });
  if (error) throw new Error(`创建管理员会话失败: ${error.message}`);
  return { token, expiresAt: expires.toISOString() };
}
