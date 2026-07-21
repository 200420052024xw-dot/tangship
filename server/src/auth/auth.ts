import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { AdminDataService } from '../admin-data/admin-data.service';
import { hashToken } from './security';
export { hashPassword, hashToken, verifyPassword } from './security';

export const bearer = (header?: string) => header?.startsWith('Bearer ') ? header.slice(7) : '';

@Injectable()
export class UserAuthGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const client = this.supabase.getClient();
    if (!bearer(request.headers.authorization) && process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_AUTH === 'true') {
      const openid = String(request.headers['x-dev-user'] || 'dev-user');
      const timestamp = new Date().toISOString();
      let { data: user } = await client.from('users').select('id').eq('openid', openid).maybeSingle();
      if (!user) {
        const id = randomUUID();
        const { error } = await client.from('users').insert({ id, openid, nickname: openid, status: 'active', created_at: timestamp, updated_at: timestamp });
        if (error) throw new UnauthorizedException('创建用户失败');
        user = { id };
      }
      request.user = { id: user.id };
      return true;
    }

    const token = bearer(request.headers.authorization);
    if (!token) throw new UnauthorizedException('用户未登录');
    const { data: session } = await client.from('user_sessions').select('user_id').eq('token_hash', hashToken(token)).is('revoked_at', null).gt('expires_at', new Date().toISOString()).maybeSingle();
    if (!session) throw new UnauthorizedException('用户未登录或会话已过期');
    request.user = { id: session.user_id };
    return true;
  }
}

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly adminData: AdminDataService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const cookie = String(request.headers.cookie || '').split(';').map((value: string) => value.trim()).find((value: string) => value.startsWith('admin_session='));
    const token = cookie ? decodeURIComponent(cookie.slice(14)) : bearer(request.headers.authorization);
    if (!token) throw new UnauthorizedException('管理员未登录');
    const admin = await this.adminData.adminFromSession(token);
    if (!admin) throw new UnauthorizedException('管理员未登录或会话已过期');
    request.admin = admin;
    return true;
  }
}

export async function issueSession(supabase: SupabaseService, userId: string, hours = 24) {
  const token = randomBytes(32).toString('base64url');
  const createdAt = new Date();
  const expires = new Date(createdAt.getTime() + hours * 3600000);
  const { error } = await supabase.getClient().from('user_sessions').insert({ id: randomUUID(), user_id: userId, token_hash: hashToken(token), expires_at: expires.toISOString(), created_at: createdAt.toISOString() });
  if (error) throw new Error(`创建会话失败: ${error.message}`);
  return { token, expiresAt: expires.toISOString() };
}

export async function issueAdminSession(adminData: AdminDataService, adminId: string, hours = 12) {
  return adminData.createAdminSession(adminId, hours);
}
