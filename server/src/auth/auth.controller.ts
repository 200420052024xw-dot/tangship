import { Body, Controller, Get, HttpCode, Patch, Post, Req, UnauthorizedException, UseGuards, Res } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { UserAuthGuard, bearer, issueSession } from './auth';

@Controller('auth')
export class AuthController {
  constructor(private readonly supabase: SupabaseService) {}

  @Post('dev-login')
  @HttpCode(200)
  async devLogin() {
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_DEV_AUTH !== 'true') throw new UnauthorizedException('开发身份未启用');
    const client = this.supabase.getClient();
    const openid = 'mini-program-dev-user';
    const now = new Date().toISOString();

    let { data: user } = await client.from('users').select('id, openid, nickname, avatar_url, status').eq('openid', openid).maybeSingle();
    if (!user) {
      const id = randomUUID();
      const { error } = await client.from('users').insert({ id, openid, nickname: '开发用户', status: 'active', created_at: now, updated_at: now });
      if (error) throw new Error(`创建用户失败: ${error.message}`);
      user = { id, openid, nickname: '开发用户', avatar_url: null, status: 'active' };
    }

    const session = await issueSession(this.supabase, user.id);
    const adminAccess = await this.hasAdminAccess(user.id);
    return { code: 200, msg: 'success', data: { user, adminAccess, ...session } };
  }

  @Post('wechat-login')
  @HttpCode(200)
  async wechatLogin(@Body() body: { code?: string }) {
    const code = String(body.code || '').trim();
    const appId = process.env.WECHAT_APP_ID;
    const secret = process.env.WECHAT_APP_SECRET;
    if (!code || !appId || !secret) throw new UnauthorizedException('微信登录配置不完整');

    const params = new URLSearchParams({ appid: appId, secret, js_code: code, grant_type: 'authorization_code' });
    const response = await fetch(`https://api.weixin.qq.com/sns/jscode2session?${params}`);
    const result = await response.json() as { openid?: string; errcode?: number };
    if (!response.ok || !result.openid || result.errcode) throw new UnauthorizedException('微信登录失败');

    const client = this.supabase.getClient();
    const now = new Date().toISOString();
    let { data: user } = await client.from('users').select('id, openid, nickname, avatar_url, status').eq('openid', result.openid).maybeSingle();
    if (!user) {
      const id = randomUUID();
      const { error } = await client.from('users').insert({ id, openid: result.openid, nickname: '微信用户', status: 'active', created_at: now, updated_at: now });
      if (error) throw new Error(`创建用户失败: ${error.message}`);
      user = { id, openid: result.openid, nickname: '微信用户', avatar_url: null, status: 'active' };
    } else {
      await client.from('users').update({ updated_at: now }).eq('id', user.id);
    }

    if (user.status !== 'active') throw new UnauthorizedException('用户已停用');
    const session = await issueSession(this.supabase, user.id);
    const adminAccess = await this.hasAdminAccess(user.id);
    return { code: 200, msg: 'success', data: { user, adminAccess, ...session } };
  }

  @Get('me')
  @UseGuards(UserAuthGuard)
  async me(@Req() request: any) {
    const client = this.supabase.getClient();
    const { data: user, error } = await client.from('users').select('id, openid, nickname, avatar_url, status, created_at').eq('id', request.user.id).maybeSingle();
    if (error || !user) throw new UnauthorizedException('用户不存在');
    const adminAccess = await this.hasAdminAccess(request.user.id);
    return { code: 200, msg: 'success', data: { ...user, adminAccess } };
  }

  @Patch('me')
  @HttpCode(200)
  @UseGuards(UserAuthGuard)
  async updateMe(@Req() request: any, @Body() body: { nickname?: string }) {
    const client = this.supabase.getClient();
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (body.nickname !== undefined) {
      const nick = String(body.nickname).trim();
      if (!nick || nick.length > 32) throw new UnauthorizedException('昵称长度1-32');
      updates.nickname = nick;
    }
    const { data: user, error } = await client.from('users').update(updates).eq('id', request.user.id).select('id, openid, nickname, avatar_url, status').maybeSingle();
    if (error || !user) throw new UnauthorizedException('更新失败');
    const adminAccess = await this.hasAdminAccess(request.user.id);
    return { code: 200, msg: 'success', data: { ...user, adminAccess } };
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(UserAuthGuard)
  async logout(@Req() request: any) {
    const token = bearer(request.headers.authorization);
    if (token) {
      const client = this.supabase.getClient();
      await client.from('user_sessions').update({ revoked_at: new Date().toISOString() }).eq('token_hash', createHash('sha256').update(token).digest('hex'));
    }
    return { code: 200, msg: '已退出', data: null };
  }

  private async hasAdminAccess(userId: string) {
    const client = this.supabase.getClient();
    const { data } = await client
      .from('admin_wechat_bindings')
      .select('id')
      .eq('user_id', userId)
      .is('revoked_at', null)
      .maybeSingle();
    return Boolean(data);
  }
}
