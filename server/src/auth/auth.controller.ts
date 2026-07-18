import { Body, Controller, Get, HttpCode, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common'
import { createHash, randomUUID } from 'node:crypto'
import { DatabaseService } from '../database/database.service'
import { UserAuthGuard, bearer, issueSession } from './auth'

@Controller('auth')
export class AuthController {
  constructor(private readonly database: DatabaseService) {}

  @Post('dev-login')
  @HttpCode(200)
  devLogin() {
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_DEV_AUTH !== 'true') throw new UnauthorizedException('开发身份未启用')
    const openid = 'mini-program-dev-user'
    const now = new Date().toISOString()
    let user = this.database.db.prepare('SELECT id,openid,nickname,avatar_url avatarUrl,status FROM users WHERE openid=?').get(openid) as any
    if (!user) {
      const id = randomUUID()
      this.database.db.prepare('INSERT INTO users(id,openid,nickname,status,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(id, openid, '开发用户', 'active', now, now)
      user = { id, openid, nickname: '开发用户', avatarUrl: null, status: 'active' }
    }
    return { code: 200, msg: 'success', data: { user, adminAccess: this.hasAdminAccess(user.id), ...issueSession(this.database, user.id) } }
  }

  @Post('wechat-login')
  @HttpCode(200)
  async wechatLogin(@Body() body: { code?: string }) {
    const code = String(body.code || '').trim(), appId = process.env.WECHAT_APP_ID, secret = process.env.WECHAT_APP_SECRET
    if (!code || !appId || !secret) throw new UnauthorizedException('微信登录配置不完整')
    const params = new URLSearchParams({ appid: appId, secret, js_code: code, grant_type: 'authorization_code' })
    const response = await fetch(`https://api.weixin.qq.com/sns/jscode2session?${params}`)
    const result = await response.json() as { openid?: string; errcode?: number }
    if (!response.ok || !result.openid || result.errcode) throw new UnauthorizedException('微信登录失败')
    const now = new Date().toISOString()
    let user = this.database.db.prepare('SELECT id,openid,nickname,avatar_url avatarUrl,status FROM users WHERE openid=?').get(result.openid) as any
    if (!user) {
      const id = randomUUID()
      this.database.db.prepare('INSERT INTO users(id,openid,nickname,status,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(id, result.openid, '微信用户', 'active', now, now)
      user = { id, openid: result.openid, nickname: '微信用户', avatarUrl: null, status: 'active' }
    } else this.database.db.prepare('UPDATE users SET updated_at=? WHERE id=?').run(now, user.id)
    if (user.status !== 'active') throw new UnauthorizedException('用户已停用')
    return { code: 200, msg: 'success', data: { user, adminAccess: this.hasAdminAccess(user.id), ...issueSession(this.database, user.id) } }
  }

  @Get('me')
  @UseGuards(UserAuthGuard)
  me(@Req() request: any) {
    const user = this.database.db.prepare('SELECT id,openid,nickname,avatar_url avatarUrl,status,created_at createdAt FROM users WHERE id=?').get(request.user.id) as any
    return { code: 200, msg: 'success', data: { ...user, adminAccess: this.hasAdminAccess(request.user.id) } }
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(UserAuthGuard)
  logout(@Req() request: any) {
    const token = bearer(request.headers.authorization)
    if (token) this.database.db.prepare('UPDATE user_sessions SET revoked_at=? WHERE token_hash=?').run(new Date().toISOString(), createHash('sha256').update(token).digest('hex'))
    return { code: 200, msg: '已退出', data: null }
  }

  private hasAdminAccess(userId: string) {
    return Boolean(this.database.db.prepare("SELECT 1 FROM admin_wechat_bindings b JOIN admin_users a ON a.id=b.admin_user_id WHERE b.user_id=? AND b.revoked_at IS NULL AND a.status='active'").get(userId))
  }
}
