import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Req, UseGuards } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { DatabaseService } from '../database/database.service'
import { SqliteRepositories } from '../database/sqlite.repositories'
import { UserAuthGuard } from '../auth/auth'
import { AddressInputDto, addressInputSchema, parseDto } from '../validation/schemas'

@Controller('addresses') @UseGuards(UserAuthGuard)
export class AddressesController {
  constructor(private db: DatabaseService, private repos: SqliteRepositories) {}
  @Get() list(@Req() req: any) { return { code: 200, msg: 'success', data: this.repos.address.list(req.user.id) } }

  @Post() @HttpCode(200)
  create(@Req() req: any, @Body() body: unknown) {
    const data = parseDto(addressInputSchema, body), userId = req.user.id
    if (data.migrationKey) { const existing = this.db.db.prepare('SELECT id FROM addresses WHERE user_id=? AND migration_key=? AND deleted_at IS NULL').get(userId, data.migrationKey) as { id: string } | undefined; if (existing) return { code: 200, msg: '已存在', data: this.repos.address.findOwned(existing.id, userId) } }
    const id = randomUUID(), time = new Date().toISOString()
    this.db.db.transaction(() => { this.clearDefaults(userId, data); this.db.db.prepare('INSERT INTO addresses(id,user_id,contact_name,phone,province,city,district,poi_name,formatted_address,detail_address,longitude,latitude,usage_type,is_default_sender,is_default_receiver,created_at,updated_at,deleted_at,migration_key) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,?)').run(id, userId, data.contactName, data.phone, data.province, data.city, data.district, data.poiName, data.formattedAddress, data.detailAddress, data.longitude, data.latitude, data.usageType, data.isDefaultSender ? 1 : 0, data.isDefaultReceiver ? 1 : 0, time, time, data.migrationKey || null) })()
    return { code: 200, msg: '已创建', data: this.repos.address.findOwned(id, userId) }
  }

  @Put(':id') @HttpCode(200)
  update(@Req() req: any, @Param('id') id: string, @Body() body: unknown) {
    const data = parseDto(addressInputSchema.omit({ migrationKey: true }), body), userId = req.user.id
    if (!this.repos.address.findOwned(id, userId)) throw new BadRequestException('地址不存在')
    this.db.db.transaction(() => { this.clearDefaults(userId, data); const result = this.db.db.prepare('UPDATE addresses SET contact_name=?,phone=?,province=?,city=?,district=?,poi_name=?,formatted_address=?,detail_address=?,longitude=?,latitude=?,usage_type=?,is_default_sender=?,is_default_receiver=?,updated_at=? WHERE id=? AND user_id=? AND deleted_at IS NULL').run(data.contactName, data.phone, data.province, data.city, data.district, data.poiName, data.formattedAddress, data.detailAddress, data.longitude, data.latitude, data.usageType, data.isDefaultSender ? 1 : 0, data.isDefaultReceiver ? 1 : 0, new Date().toISOString(), id, userId); if (result.changes !== 1) throw new BadRequestException('地址不存在') })()
    return { code: 200, msg: '已更新', data: this.repos.address.findOwned(id, userId) }
  }

  @Delete(':id') @HttpCode(200)
  remove(@Req() req: any, @Param('id') id: string) { const time = new Date().toISOString(), result = this.db.db.prepare('UPDATE addresses SET deleted_at=?,updated_at=?,is_default_sender=0,is_default_receiver=0 WHERE id=? AND user_id=? AND deleted_at IS NULL').run(time, time, id, req.user.id); if (result.changes !== 1) throw new BadRequestException('地址不存在'); return { code: 200, msg: '已删除', data: null } }

  private clearDefaults(userId: string, data: Pick<AddressInputDto, 'isDefaultSender' | 'isDefaultReceiver'>) { if (data.isDefaultSender) this.db.db.prepare('UPDATE addresses SET is_default_sender=0 WHERE user_id=? AND deleted_at IS NULL').run(userId); if (data.isDefaultReceiver) this.db.db.prepare('UPDATE addresses SET is_default_receiver=0 WHERE user_id=? AND deleted_at IS NULL').run(userId) }
}
