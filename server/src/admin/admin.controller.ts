import { BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, HttpCode, HttpException, HttpStatus, Param, Patch, Post, Query, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common'
import type { Request, Response } from 'express'
import { randomUUID } from 'node:crypto'
import { SupabaseService } from '../supabase/supabase.service'
import { AdminAuthGuard, UserAuthGuard, bearer, hashToken, verifyPassword } from '../auth/auth'
import { OrdersService } from '../orders/orders.service'
import { AdminOrdersService } from './admin-orders.service'

const attempts = new Map<string, { count: number; reset: number }>()
const roles = new Set(['super_admin', 'operator', 'finance'])
class TooManyRequestsException extends HttpException { constructor() { super('登录尝试过多，请稍后再试', 429) } }
const cookieToken = (req: Request) => String(req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith('admin_session='))?.slice(14) || '')

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private supabase: SupabaseService) {}

  @Post('login') @HttpCode(200)
  async login(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: { username: string; password: string }) {
    const key = req.ip || 'unknown', now = Date.now(), state = attempts.get(key)
    if (state && state.reset > now && state.count >= 10) throw new HttpException('登录尝试过多，请15分钟后再试', HttpStatus.TOO_MANY_REQUESTS)
    if (!state || state.reset <= now) attempts.set(key, { count: 1, reset: now + 15 * 60_000 })

    const client = this.supabase.getClient();
    const { data: admin, error } = await client.from('admin_users').select('*').eq('username', String(body.username || '').slice(0, 100)).maybeSingle();
    if (error || !admin || !verifyPassword(String(body.password || ''), admin.password_hash)) throw new UnauthorizedException('用户名或密码错误')
    attempts.delete(key)

    // Create session
    const token = randomUUID();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 12 * 60 * 60_000).toISOString();
    await client.from('admin_sessions').insert({ id: randomUUID(), admin_user_id: admin.id, token_hash: tokenHash, expires_at: expiresAt, created_at: new Date().toISOString() });

    const production = process.env.NODE_ENV === 'production';
    res.cookie('admin_session', token, { httpOnly: true, secure: production, sameSite: production ? 'none' : 'lax', maxAge: 12 * 60 * 60_000, path: '/api/admin' });
    return { code: 200, msg: 'success', data: { admin: { id: admin.id, username: admin.username, role: admin.role }, expiresAt } }
  }

  @Post('wechat-session') @HttpCode(200) @UseGuards(UserAuthGuard)
  async wechatSession(@Req() req: any) {
    const client = this.supabase.getClient();
    const { data: binding } = await client.from('admin_wechat_bindings').select('admin_user_id').eq('user_id', req.user.id).is('revoked_at', null).maybeSingle();
    if (!binding) throw new ForbiddenException('该微信尚未获得管理员权限');
    const { data: admin } = await client.from('admin_users').select('id, username, role').eq('id', binding.admin_user_id).eq('status', 'active').maybeSingle();
    if (!admin) throw new ForbiddenException('管理员账号已停用');

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 12 * 60 * 60_000).toISOString();
    await client.from('admin_sessions').insert({ id: randomUUID(), admin_user_id: admin.id, token_hash: hashToken(token), expires_at: expiresAt, created_at: new Date().toISOString() });
    return { code: 200, msg: 'success', data: { admin, token, expiresAt } }
  }

  @Post('logout') @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = cookieToken(req) || bearer(req.headers.authorization);
    if (token) {
      const client = this.supabase.getClient();
      await client.from('admin_sessions').update({ revoked_at: new Date().toISOString() }).eq('token_hash', token);
    }
    res.clearCookie('admin_session', { path: '/api/admin' });
    return { code: 200, msg: '已退出', data: null }
  }

  @Get('me') @UseGuards(AdminAuthGuard)
  me(@Req() req: any) { return { code: 200, msg: 'success', data: req.admin } }
}

@Controller('admin') @UseGuards(AdminAuthGuard)
export class AdminController {
  constructor(private query: AdminOrdersService, private orders: OrdersService, private supabase: SupabaseService) {}

  @Get('dashboard') async dashboard() { return { code: 200, msg: 'success', data: await this.query.dashboard() } }
  @Get('orders') async list(@Query() query: any) { return { code: 200, msg: 'success', data: await this.query.list(query) } }
  @Get('orders/:id') async detail(@Req() req: any, @Param('id') id: string) { return { code: 200, msg: 'success', data: await this.query.detail(id, req.admin.role) } }

  @Post('orders/:id/review') @HttpCode(200)
  async review(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    if (!['super_admin', 'operator'].includes(req.admin.role)) throw new ForbiddenException('当前角色无审核权限')
    if (String(body.internalNote || '').length > 1000 || String(body.userNote || '').length > 500) throw new BadRequestException('备注长度超限')
    return { code: 200, msg: '审核完成', data: await this.orders.reviewWithNotes(req.admin.id, id, body) }
  }

  @Get('reviews') async reviews(@Query() query: any) { return { code: 200, msg: 'success', data: await this.query.reviews(query) } }

  @Get('wechat-users')
  async wechatUsers(@Req() req: any, @Query() query: any) {
    this.superOnly(req);
    const page = Math.max(1, Number(query.page) || 1), pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 20));
    const client = this.supabase.getClient();
    let q = client.from('users').select('id, nickname, openid, status, created_at, updated_at', { count: 'exact' });
    const keyword = String(query.keyword || '').slice(0, 80);
    if (keyword) q = q.or(`nickname.ilike.%${keyword}%,id.ilike.%${keyword}%`);
    const { data: items, count: total } = await q.order('updated_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
    return { code: 200, msg: 'success', data: { items: (items || []).map((v: any) => ({ ...v, openid: this.maskOpenid(v.openid), lastLoginAt: v.updated_at })), total: total || 0, page, pageSize, totalPages: Math.ceil((total || 0) / pageSize) } }
  }

  @Post('wechat-bindings') @HttpCode(200)
  async createBinding(@Req() req: any, @Body() body: { userId?: string; role?: string }) {
    this.superOnly(req); const userId = String(body.userId || ''), role = String(body.role || '');
    if (!roles.has(role)) throw new BadRequestException('管理员角色无效');
    const client = this.supabase.getClient();
    const { data: user } = await client.from('users').select('id, nickname').eq('id', userId).eq('status', 'active').maybeSingle();
    if (!user) throw new BadRequestException('用户不存在或已停用');
    const { data: existing } = await client.from('admin_users').select('id').eq('username', `wx_${userId.slice(0, 20)}`).maybeSingle();
    let adminId: string;
    if (existing) { adminId = existing.id; } else {
      adminId = randomUUID();
      const { error } = await client.from('admin_users').insert({ id: adminId, username: `wx_${userId.slice(0, 20)}`, password_hash: '', role, status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      if (error) throw new ConflictException('创建管理员失败: ' + error.message);
    }
    const { error: bindErr } = await client.from('admin_wechat_bindings').insert({ id: randomUUID(), admin_user_id: adminId, user_id: userId, created_at: new Date().toISOString() });
    if (bindErr) throw new ConflictException('绑定失败: ' + bindErr.message);
    return { code: 200, msg: '绑定成功', data: null }
  }

  @Delete('wechat-bindings/:id') @HttpCode(200)
  async revokeBinding(@Req() req: any, @Param('id') id: string) {
    this.superOnly(req);
    const client = this.supabase.getClient();
    const { error } = await client.from('admin_wechat_bindings').update({ revoked_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new BadRequestException('撤销失败');
    return { code: 200, msg: '已撤销', data: null }
  }

  @Get('operations/inquiries') async listInquiries() {
    const client = this.supabase.getClient();
    const { data, error } = await client.from('inquiries').select('*').order('created_at', { ascending: false });
    if (error) throw new BadRequestException('查询咨询记录失败');
    return { code: 200, msg: 'success', data }
  }

  @Patch('operations/inquiries/:id/status') @HttpCode(200)
  async updateInquiryStatus(@Param('id') id: string, @Body() body: { status: string; note?: string }) {
    const valid = ['contacted', 'closed'];
    if (!valid.includes(body.status)) throw new BadRequestException('状态无效');
    const client = this.supabase.getClient();
    const { error } = await client.from('inquiries').update({ status: body.status, note: body.note || null, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new BadRequestException('更新失败');
    return { code: 200, msg: '已更新', data: null }
  }

  @Get('operations/contact') async getContact() {
    const client = this.supabase.getClient();
    const { data, error } = await client.from('contact_settings').select('*').limit(1);
    if (error) throw new BadRequestException('查询联系方式失败');
    return { code: 200, msg: 'success', data: data || [] }
  }

  @Patch('operations/contact') @HttpCode(200)
  async updateContact(@Body() body: { phone?: string; wechat?: string; email?: string; workTime?: string; extraText?: string }) {
    const client = this.supabase.getClient();
    const { data: existing } = await client.from('contact_settings').select('id').limit(1).maybeSingle();
    if (existing) {
      const { error } = await client.from('contact_settings').update({ ...body, updated_at: new Date().toISOString() }).eq('id', existing.id);
      if (error) throw new BadRequestException('更新联系方式失败');
    } else {
      const { error } = await client.from('contact_settings').insert({ id: randomUUID(), phone: body.phone || '', wechat: body.wechat || '', email: body.email || '', workTime: body.workTime || '', extraText: body.extraText || '', updated_at: new Date().toISOString() });
      if (error) throw new BadRequestException('创建联系方式失败');
    }
    return { code: 200, msg: '已保存', data: null }
  }

  private superOnly(req: any) { if (req.admin.role !== 'super_admin') throw new ForbiddenException('仅超级管理员可执行') }
  private maskOpenid(openid: string) { return openid ? openid.slice(0, 6) + '***' + openid.slice(-4) : null }
}
