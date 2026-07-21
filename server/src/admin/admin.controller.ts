import { BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, HttpCode, HttpException, HttpStatus, Param, Patch, Post, Put, Query, Req, Res, ServiceUnavailableException, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { AdminAuthGuard, UserAuthGuard, bearer } from '../auth/auth';
import { OrdersService } from '../orders/orders.service';
import { AdminOrdersService } from './admin-orders.service';
import { AdminDataService } from '../admin-data/admin-data.service';

const attempts = new Map<string, { count: number; reset: number }>();
const roles = new Set(['super_admin', 'operator']);
const cookieToken = (request: Request) => String(request.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith('admin_session='))?.slice(14) || '';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminData: AdminDataService, private readonly supabase: SupabaseService) {}

  @Post('login')
  @HttpCode(200)
  async login(@Req() request: Request, @Res({ passthrough: true }) response: Response, @Body() body: { username: string; password: string }) {
    const key = request.ip || 'unknown', timestamp = Date.now(), state = attempts.get(key);
    if (state && state.reset > timestamp && state.count >= 10) throw new HttpException('登录尝试过多，请 15 分钟后再试', HttpStatus.TOO_MANY_REQUESTS);
    if (!state || state.reset <= timestamp) attempts.set(key, { count: 1, reset: timestamp + 15 * 60_000 });
    else attempts.set(key, { ...state, count: state.count + 1 });
    const admin = await this.adminData.authenticate(String(body.username || '').slice(0, 100), String(body.password || ''));
    attempts.delete(key);
    const session = await this.adminData.createAdminSession(admin.id);
    const production = process.env.NODE_ENV === 'production';
    response.cookie('admin_session', session.token, { httpOnly: true, secure: production, sameSite: production ? 'none' : 'lax', maxAge: 12 * 60 * 60_000, path: '/api/admin' });
    return { code: 200, msg: 'success', data: { admin, expiresAt: session.expiresAt } };
  }

  @Post('wechat-session')
  @HttpCode(200)
  @UseGuards(UserAuthGuard)
  async wechatSession(@Req() request: any) {
    if (this.adminData.isSqlite) throw new ServiceUnavailableException('本地 SQLite 模式不支持微信管理员会话，请使用演示账号登录');
    const client = this.supabase.getClient();
    const { data: binding } = await client.from('admin_wechat_bindings').select('admin_user_id').eq('user_id', request.user.id).is('revoked_at', null).maybeSingle();
    if (!binding) throw new ForbiddenException('该微信用户尚未获得管理员权限');
    const { data: admin } = await client.from('admin_users').select('id,username,role').eq('id', binding.admin_user_id).eq('status', 'active').maybeSingle();
    if (!admin) throw new ForbiddenException('管理员账号已停用');
    const session = await this.adminData.createAdminSession(admin.id);
    return { code: 200, msg: 'success', data: { admin, token: session.token, expiresAt: session.expiresAt } };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const token = cookieToken(request) || bearer(request.headers.authorization);
    if (token) await this.adminData.revokeAdminSession(token);
    response.clearCookie('admin_session', { path: '/api/admin' });
    return { code: 200, msg: '已退出', data: null };
  }

  @Get('me')
  @UseGuards(AdminAuthGuard)
  me(@Req() request: any) { return { code: 200, msg: 'success', data: request.admin }; }
}

@Controller('admin')
@UseGuards(AdminAuthGuard)
export class AdminController {
  constructor(
    private readonly query: AdminOrdersService,
    private readonly orders: OrdersService,
    private readonly supabase: SupabaseService,
    private readonly adminData: AdminDataService,
  ) {}

  @Get('runtime') runtime() { return { code: 200, msg: 'success', data: this.adminData.runtime() }; }
  @Get('dashboard') async dashboard() { return { code: 200, msg: 'success', data: this.adminData.isSqlite ? this.adminData.dashboard() : await this.query.dashboard() }; }
  @Get('orders') async list(@Query() query: any) { return { code: 200, msg: 'success', data: this.adminData.isSqlite ? this.adminData.listOrders(query) : await this.query.list(query) }; }
  @Get('orders/:id') async detail(@Req() request: any, @Param('id') id: string) { return { code: 200, msg: 'success', data: this.adminData.isSqlite ? this.adminData.orderDetail(id, request.admin.role) : await this.query.detail(id, request.admin.role) }; }

  @Post('orders/:id/review')
  @HttpCode(200)
  async review(@Req() request: any, @Param('id') id: string, @Body() body: any) {
    if (!['super_admin', 'operator'].includes(request.admin.role)) throw new ForbiddenException('当前角色无审核权限');
    if (String(body.internalNote || '').length > 1000 || String(body.userNote || '').length > 500) throw new BadRequestException('备注长度超限');
    const data = this.adminData.isSqlite ? this.adminData.reviewOrder(request.admin.id, id, body) : await this.orders.reviewWithNotes(request.admin.id, id, body);
    return { code: 200, msg: '审核完成', data };
  }

  @Post('orders/:id/status')
  @HttpCode(200)
  async transitionOrder(@Req() request: any, @Param('id') id: string, @Body() body: any) {
    if (!['super_admin', 'operator'].includes(request.admin.role)) throw new ForbiddenException('当前角色无订单履约权限');
    const data = this.adminData.isSqlite ? this.adminData.transitionOrder(request.admin.id, id, body) : await this.query.transitionOrder(request.admin.id, id, body);
    return { code: 200, msg: '订单状态已更新', data };
  }

  @Get('reviews') async reviews(@Query() query: any) { return { code: 200, msg: 'success', data: this.adminData.isSqlite ? this.adminData.reviews(query) : await this.query.reviews(query) }; }

  @Get('notifications')
  async notifications(@Req() request: any, @Query() query: any) {
    const data = this.adminData.isSqlite ? this.adminData.listNotifications(request.admin.id, query) : await this.query.listNotifications(request.admin.id, query);
    return { code: 200, msg: 'success', data };
  }

  @Put('notifications/read-all')
  @HttpCode(200)
  async readAllNotifications(@Req() request: any) {
    if (this.adminData.isSqlite) this.adminData.markAllNotificationsRead(request.admin.id); else await this.query.markAllNotificationsRead(request.admin.id);
    return { code: 200, msg: '全部通知已读', data: null };
  }

  @Put('notifications/:id/read')
  @HttpCode(200)
  async readNotification(@Req() request: any, @Param('id') id: string) {
    if (this.adminData.isSqlite) this.adminData.markNotificationRead(request.admin.id, id); else await this.query.markNotificationRead(request.admin.id, id);
    return { code: 200, msg: '通知已读', data: null };
  }

  @Get('wechat-users')
  async wechatUsers(@Req() request: any, @Query() query: any) {
    this.superOnly(request);
    if (this.adminData.isSqlite) return { code: 200, msg: 'success', data: this.adminData.listWechatUsers(query) };
    const page = Math.max(1, Number(query.page) || 1), pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 20));
    const client = this.supabase.getClient(), keyword = String(query.keyword || '').slice(0, 80);
    let usersQuery = client.from('users').select('id,nickname,openid,status,created_at,updated_at', { count: 'exact' });
    if (keyword) usersQuery = usersQuery.or(`nickname.ilike.%${keyword}%,id.ilike.%${keyword}%`);
    const { data: users, count } = await usersQuery.order('updated_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
    const ids = (users || []).map((user: any) => user.id);
    const { data: bindings } = ids.length ? await client.from('admin_wechat_bindings').select('id,user_id,admin_user_id').in('user_id', ids).is('revoked_at', null) : { data: [] as any[] };
    const adminIds = (bindings || []).map((binding: any) => binding.admin_user_id);
    const { data: admins } = adminIds.length ? await client.from('admin_users').select('id,role,status').in('id', adminIds) : { data: [] as any[] };
    const bindingByUser = new Map((bindings || []).map((binding: any) => [binding.user_id, binding]));
    const adminById = new Map((admins || []).map((admin: any) => [admin.id, admin]));
    const items = (users || []).map((user: any) => { const binding: any = bindingByUser.get(user.id), admin: any = binding ? adminById.get(binding.admin_user_id) : null; return { ...user, openid: this.maskOpenid(user.openid), lastLoginAt: user.updated_at, bindingId: binding?.id, role: admin?.role, adminStatus: admin?.status }; });
    return { code: 200, msg: 'success', data: { items, total: count || 0, page, pageSize, totalPages: Math.ceil((count || 0) / pageSize) } };
  }

  @Post('wechat-bindings')
  @HttpCode(200)
  async createBinding(@Req() request: any, @Body() body: { userId?: string; role?: string }) {
    this.superOnly(request); const userId = String(body.userId || ''), role = String(body.role || '');
    if (this.adminData.isSqlite) this.adminData.createBinding(request.admin.id, userId, role);
    else {
      if (!roles.has(role)) throw new BadRequestException('管理员角色无效');
      const client = this.supabase.getClient();
      const { data: user } = await client.from('users').select('id').eq('id', userId).eq('status', 'active').maybeSingle();
      if (!user) throw new BadRequestException('用户不存在或已停用');
      const username = `wx_${userId.slice(0, 20)}`, timestamp = new Date().toISOString();
      const { data: existingAdmin } = await client.from('admin_users').select('id').eq('username', username).maybeSingle();
      const adminId = existingAdmin?.id || randomUUID();
      const { error: adminError } = existingAdmin
        ? await client.from('admin_users').update({ role, status: 'active', updated_at: timestamp }).eq('id', adminId)
        : await client.from('admin_users').insert({ id: adminId, username, password_hash: '', role, status: 'active', created_at: timestamp, updated_at: timestamp });
      if (adminError) throw new ConflictException(`创建或更新管理员失败: ${adminError.message}`);
      const { data: previousBinding } = await client.from('admin_wechat_bindings').select('id').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      const { error } = previousBinding
        ? await client.from('admin_wechat_bindings').update({ admin_user_id: adminId, granted_by: request.admin.id, revoked_at: null, updated_at: timestamp }).eq('id', previousBinding.id)
        : await client.from('admin_wechat_bindings').insert({ id: randomUUID(), admin_user_id: adminId, user_id: userId, granted_by: request.admin.id, created_at: timestamp, updated_at: timestamp });
      if (error) throw new ConflictException(`绑定失败: ${error.message}`);
    }
    return { code: 200, msg: '绑定成功', data: null };
  }

  @Patch('wechat-bindings/:id')
  @HttpCode(200)
  async updateBinding(@Req() request: any, @Param('id') id: string, @Body() body: { role: string; status?: string }) {
    this.superOnly(request);
    if (this.adminData.isSqlite) this.adminData.updateBinding(id, body.role, body.status);
    else {
      if (!roles.has(body.role) || !['active','disabled'].includes(body.status || 'active')) throw new BadRequestException('角色或状态无效');
      const client = this.supabase.getClient(), { data: binding } = await client.from('admin_wechat_bindings').select('admin_user_id').eq('id', id).is('revoked_at', null).maybeSingle();
      if (!binding) throw new BadRequestException('授权不存在');
      const { error } = await client.from('admin_users').update({ role: body.role, status: body.status || 'active', updated_at: new Date().toISOString() }).eq('id', binding.admin_user_id);
      if (error) throw new BadRequestException('更新授权失败');
    }
    return { code: 200, msg: '授权已更新', data: null };
  }

  @Delete('wechat-bindings/:id')
  @HttpCode(200)
  async revokeBinding(@Req() request: any, @Param('id') id: string) {
    this.superOnly(request);
    if (this.adminData.isSqlite) this.adminData.revokeBinding(id);
    else {
      const { error } = await this.supabase.getClient().from('admin_wechat_bindings').update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw new BadRequestException('撤销失败');
    }
    return { code: 200, msg: '已撤销', data: null };
  }

  private superOnly(request: any) { if (request.admin.role !== 'super_admin') throw new ForbiddenException('仅超级管理员可执行'); }
  private maskOpenid(openid: string) { return openid ? `${openid.slice(0, 6)}***${openid.slice(-4)}` : null; }
}
