import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { UserAuthGuard } from '../auth/auth';
import { AddressInputDto, addressInputSchema, parseDto } from '../validation/schemas';

@Controller('addresses')
@UseGuards(UserAuthGuard)
export class AddressesController {
  constructor(private supabase: SupabaseService) {}

  private getClient() { return this.supabase.getClient(); }

  @Get()
  async list(@Req() req: any) {
    const { data, error } = await this.getClient().from('addresses').select('*').eq('user_id', req.user.id).is('deleted_at', null).order('created_at', { ascending: false });
    if (error) throw new Error(`查询地址失败: ${error.message}`);
    return { code: 200, msg: 'success', data };
  }

  @Post() @HttpCode(200)
  async create(@Req() req: any, @Body() body: unknown) {
    const data = parseDto(addressInputSchema, body);
    const userId = req.user.id;
    const client = this.getClient();

    if (data.migrationKey) {
      const { data: existing } = await client.from('addresses').select('id').eq('user_id', userId).eq('migration_key', data.migrationKey).is('deleted_at', null).maybeSingle();
      if (existing) {
        const { data: addr } = await client.from('addresses').select('*').eq('id', existing.id).maybeSingle();
        return { code: 200, msg: '已存在', data: addr };
      }
    }

    await this.clearDefaults(userId, data);
    const id = randomUUID();
    const time = new Date().toISOString();
    const { error } = await client.from('addresses').insert({
      id, user_id: userId, contact_name: data.contactName, phone: data.phone,
      province: data.province, city: data.city, district: data.district,
      poi_name: data.poiName, formatted_address: data.formattedAddress,
      detail_address: data.detailAddress, longitude: data.longitude, latitude: data.latitude,
      usage_type: data.usageType, is_default_sender: data.isDefaultSender ? 1 : 0,
      is_default_receiver: data.isDefaultReceiver ? 1 : 0,
      created_at: time, updated_at: time, migration_key: data.migrationKey || null,
    });
    if (error) throw new Error(`创建地址失败: ${error.message}`);
    const { data: addr } = await client.from('addresses').select('*').eq('id', id).maybeSingle();
    return { code: 200, msg: '已创建', data: addr };
  }

  @Put(':id') @HttpCode(200)
  async update(@Req() req: any, @Param('id') id: string, @Body() body: unknown) {
    const data = parseDto(addressInputSchema.omit({ migrationKey: true }), body);
    const userId = req.user.id;
    const client = this.getClient();

    const { data: existing } = await client.from('addresses').select('id').eq('id', id).eq('user_id', userId).is('deleted_at', null).maybeSingle();
    if (!existing) throw new BadRequestException('地址不存在');

    await this.clearDefaults(userId, data);
    const time = new Date().toISOString();
    const { error } = await client.from('addresses').update({
      contact_name: data.contactName, phone: data.phone,
      province: data.province, city: data.city, district: data.district,
      poi_name: data.poiName, formatted_address: data.formattedAddress,
      detail_address: data.detailAddress, longitude: data.longitude, latitude: data.latitude,
      usage_type: data.usageType, is_default_sender: data.isDefaultSender ? 1 : 0,
      is_default_receiver: data.isDefaultReceiver ? 1 : 0, updated_at: time,
    }).eq('id', id).eq('user_id', userId).is('deleted_at', null);
    if (error) throw new BadRequestException('地址更新失败');
    const { data: addr } = await client.from('addresses').select('*').eq('id', id).maybeSingle();
    return { code: 200, msg: '已更新', data: addr };
  }

  @Delete(':id') @HttpCode(200)
  async remove(@Req() req: any, @Param('id') id: string) {
    const time = new Date().toISOString();
    const { error } = await this.getClient().from('addresses').update({
      deleted_at: time, updated_at: time, is_default_sender: 0, is_default_receiver: 0,
    }).eq('id', id).eq('user_id', req.user.id).is('deleted_at', null);
    if (error) throw new BadRequestException('地址不存在');
    return { code: 200, msg: '已删除', data: null };
  }

  private async clearDefaults(userId: string, data: Pick<AddressInputDto, 'isDefaultSender' | 'isDefaultReceiver'>) {
    const client = this.getClient();
    if (data.isDefaultSender) await client.from('addresses').update({ is_default_sender: 0 }).eq('user_id', userId).is('deleted_at', null);
    if (data.isDefaultReceiver) await client.from('addresses').update({ is_default_receiver: 0 }).eq('user_id', userId).is('deleted_at', null);
  }
}
