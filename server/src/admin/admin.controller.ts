import { BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, HttpCode, HttpException, Param, Patch, Post, Query, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common'
import type { Request, Response } from 'express'
import { randomUUID } from 'node:crypto'
import { DatabaseService } from '../database/database.service'
import { AdminAuthGuard, UserAuthGuard, bearer, issueAdminSession, verifyPassword } from '../auth/auth'
import { SqliteRepositories, hashToken } from '../database/sqlite.repositories'
import { OrdersService } from '../orders/orders.service'
import { AdminOrdersService } from './admin-orders.service'

const attempts = new Map<string, { count: number; reset: number }>()
const roles = new Set(['super_admin', 'operator', 'finance'])
class TooManyRequestsException extends HttpException { constructor() { super('登录尝试过多，请稍后再试', 429) } }
const cookieToken = (req: Request) => String(req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith('admin_session='))?.slice(14) || '')

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private db: DatabaseService, private repos: SqliteRepositories) {}

  @Post('login') @HttpCode(200)
  login(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: { username: string; password: string }) {
    const key = req.ip || 'unknown', now = Date.now(), state = attempts.get(key)
    if (state && state.reset > now && state.count >= 5) throw new TooManyRequestsException()
    if (!state || state.reset <= now) attempts.set(key, { count: 1, reset: now + 15 * 60_000 }); else state.count++
    const admin = this.repos.admin.findByUsername(String(body.username || '').slice(0, 100)) as any
    if (!admin || !verifyPassword(String(body.password || ''), admin.password_hash)) throw new UnauthorizedException('用户名或密码错误')
    attempts.delete(key)
    const session = issueAdminSession(this.db, admin.id), production = process.env.NODE_ENV === 'production'
    res.cookie('admin_session', session.token, { httpOnly: true, secure: production, sameSite: production ? 'none' : 'lax', maxAge: 12 * 60 * 60_000, path: '/api/admin' })
    return { code: 200, msg: 'success', data: { admin: { id: admin.id, username: admin.username, role: admin.role }, expiresAt: session.expiresAt } }
  }

  @Post('wechat-session') @HttpCode(200) @UseGuards(UserAuthGuard)
  wechatSession(@Req() req: any) {
    const admin = this.db.db.prepare("SELECT a.id,a.username,a.role FROM admin_wechat_bindings b JOIN admin_users a ON a.id=b.admin_user_id WHERE b.user_id=? AND b.revoked_at IS NULL AND a.status='active'").get(req.user.id) as any
    if (!admin) throw new ForbiddenException('该微信尚未获得管理员权限')
    return { code: 200, msg: 'success', data: { admin, ...issueAdminSession(this.db, admin.id) } }
  }

  @Post('logout') @HttpCode(200)
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = cookieToken(req) || bearer(req.headers.authorization)
    if (token) this.db.db.prepare('UPDATE admin_sessions SET revoked_at=? WHERE token_hash=?').run(new Date().toISOString(), hashToken(token))
    res.clearCookie('admin_session', { path: '/api/admin' })
    return { code: 200, msg: '已退出', data: null }
  }

  @Get('me') @UseGuards(AdminAuthGuard)
  me(@Req() req: any) { return { code: 200, msg: 'success', data: req.admin } }
}

@Controller('admin') @UseGuards(AdminAuthGuard)
export class AdminController {
  constructor(private query: AdminOrdersService, private orders: OrdersService, private db: DatabaseService) {}
  @Get('dashboard') dashboard() { return { code: 200, msg: 'success', data: this.query.dashboard() } }
  @Get('orders') list(@Query() query: any) { return { code: 200, msg: 'success', data: this.query.list(query) } }
  @Get('orders/:id') detail(@Req() req: any, @Param('id') id: string) { return { code: 200, msg: 'success', data: this.query.detail(id, req.admin.role) } }
  @Post('orders/:id/review') @HttpCode(200)
  review(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    if (!['super_admin', 'operator'].includes(req.admin.role)) throw new ForbiddenException('当前角色无审核权限')
    if (String(body.internalNote || '').length > 1000 || String(body.userNote || '').length > 500) throw new BadRequestException('备注长度超限')
    return { code: 200, msg: '审核完成', data: this.orders.reviewWithNotes(req.admin.id, id, body) }
  }
  @Get('reviews') reviews(@Query() query: any) { return { code: 200, msg: 'success', data: this.query.reviews(query) } }

  @Get('wechat-users')
  wechatUsers(@Req() req: any, @Query() query: any) {
    this.superOnly(req)
    const page = Math.max(1, Number(query.page) || 1), pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 20)), keyword = String(query.keyword || '').slice(0, 80)
    const where = keyword ? 'WHERE u.nickname LIKE ? OR u.id LIKE ?' : '', args = keyword ? [`%${keyword}%`, `%${keyword}%`] : []
    const total = (this.db.db.prepare(`SELECT count(*) n FROM users u ${where}`).get(...args) as any).n
    const items = (this.db.db.prepare(`SELECT u.id,u.nickname,u.openid,u.status,u.created_at createdAt,u.updated_at lastLoginAt,b.id bindingId,a.username,a.role,a.status adminStatus FROM users u LEFT JOIN admin_wechat_bindings b ON b.user_id=u.id AND b.revoked_at IS NULL LEFT JOIN admin_users a ON a.id=b.admin_user_id ${where} ORDER BY u.updated_at DESC LIMIT ? OFFSET ?`).all(...args, pageSize, (page - 1) * pageSize) as any[]).map(v => ({ ...v, openid: this.maskOpenid(v.openid) }))
    return { code: 200, msg: 'success', data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) } }
  }

  @Post('wechat-bindings') @HttpCode(200)
  createBinding(@Req() req: any, @Body() body: { userId?: string; role?: string }) {
    this.superOnly(req); const userId = String(body.userId || ''), role = String(body.role || '')
    if (!roles.has(role)) throw new BadRequestException('管理员角色无效')
    const user = this.db.db.prepare("SELECT id,nickname FROM users WHERE id=? AND status='active'").get(userId) as any
    if (!user) throw new BadRequestException('用户不存在或已停用')
    const now = new Date().toISOString(), adminId = randomUUID(), bindingId = randomUUID(), username = `wx_${userId.replaceAll('-', '').slice(0, 16)}`
    try { this.db.db.transaction(() => {
      this.db.db.prepare('INSERT INTO admin_users(id,username,password_hash,role,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(adminId, username, '!wechat-only!', role, 'active', now, now)
      this.db.db.prepare('INSERT INTO admin_wechat_bindings(id,admin_user_id,user_id,granted_by,created_at,updated_at,revoked_at) VALUES(?,?,?,?,?,?,NULL)').run(bindingId, adminId, userId, req.admin.id, now, now)
      this.audit(req.admin.id, 'admin_wechat.grant', bindingId, { userId, role })
    })() } catch { throw new ConflictException('该微信用户已经绑定管理员身份') }
    return { code: 200, msg: '授权成功', data: { id: bindingId, userId, role } }
  }

  @Patch('wechat-bindings/:id') @HttpCode(200)
  updateBinding(@Req() req: any, @Param('id') id: string, @Body() body: { role?: string; status?: string }) {
    this.superOnly(req); const role = String(body.role || ''), status = String(body.status || 'active')
    if (!roles.has(role) || !['active', 'disabled'].includes(status)) throw new BadRequestException('角色或状态无效')
    const binding = this.db.db.prepare('SELECT admin_user_id adminId FROM admin_wechat_bindings WHERE id=? AND revoked_at IS NULL').get(id) as any
    if (!binding) throw new BadRequestException('绑定不存在')
    this.preventLastSuperAdmin(binding.adminId, role, status)
    const now = new Date().toISOString(); this.db.db.transaction(() => {
      this.db.db.prepare('UPDATE admin_users SET role=?,status=?,updated_at=? WHERE id=?').run(role, status, now, binding.adminId)
      this.db.db.prepare('UPDATE admin_sessions SET revoked_at=? WHERE admin_user_id=? AND revoked_at IS NULL').run(now, binding.adminId)
      this.db.db.prepare('UPDATE admin_wechat_bindings SET updated_at=? WHERE id=?').run(now, id)
      this.audit(req.admin.id, 'admin_wechat.update', id, { role, status })
    })()
    return { code: 200, msg: '管理员权限已更新', data: null }
  }

  @Delete('wechat-bindings/:id') @HttpCode(200)
  revokeBinding(@Req() req: any, @Param('id') id: string) {
    this.superOnly(req); const binding = this.db.db.prepare('SELECT admin_user_id adminId FROM admin_wechat_bindings WHERE id=? AND revoked_at IS NULL').get(id) as any
    if (!binding) throw new BadRequestException('绑定不存在')
    this.preventLastSuperAdmin(binding.adminId, 'finance', 'disabled')
    const now = new Date().toISOString(); this.db.db.transaction(() => {
      this.db.db.prepare('UPDATE admin_wechat_bindings SET revoked_at=?,updated_at=? WHERE id=?').run(now, now, id)
      this.db.db.prepare("UPDATE admin_users SET status='disabled',updated_at=? WHERE id=?").run(now, binding.adminId)
      this.db.db.prepare('UPDATE admin_sessions SET revoked_at=? WHERE admin_user_id=? AND revoked_at IS NULL').run(now, binding.adminId)
      this.audit(req.admin.id, 'admin_wechat.revoke', id, {})
    })()
    return { code: 200, msg: '微信管理员权限已撤销', data: null }
  }

  private superOnly(req: any) { if (req.admin.role !== 'super_admin') throw new ForbiddenException('仅超级管理员可执行此操作') }
  private maskOpenid(value?: string) { return value ? `${value.slice(0, 5)}***${value.slice(-4)}` : '' }
  private audit(adminId: string, action: string, resourceId: string, detail: object) { this.db.db.prepare('INSERT INTO audit_logs VALUES(?,?,?,?,?,?,?)').run(randomUUID(), adminId, action, 'admin_wechat_binding', resourceId, JSON.stringify(detail), new Date().toISOString()) }
  private preventLastSuperAdmin(adminId: string, nextRole: string, nextStatus: string) {
    const current = this.db.db.prepare('SELECT role,status FROM admin_users WHERE id=?').get(adminId) as any
    if (current?.role === 'super_admin' && current.status === 'active' && (nextRole !== 'super_admin' || nextStatus !== 'active')) {
      const count = (this.db.db.prepare("SELECT count(*) n FROM admin_users WHERE role='super_admin' AND status='active'").get() as any).n
      if (count <= 1) throw new ConflictException('不能停用最后一个超级管理员')
    }
  }
}
