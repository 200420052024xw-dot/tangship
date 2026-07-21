import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Param, Post, Put, Query, Req, ServiceUnavailableException, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminAuthGuard } from '../auth/auth';
import { OperationsService } from './operations.service';
import { AdminDataService } from '../admin-data/admin-data.service';

const superOnly = (request: any) => { if (request.admin.role !== 'super_admin') throw new ForbiddenException('仅超级管理员可修改运营配置'); };

@Controller('content')
export class PublicContentController {
  constructor(private readonly service: OperationsService) {}
  @Get('vehicles') async vehicles(@Query('mode') mode?: string, @Req() request?: any) { const data = await this.service.listVehicles(false, mode || undefined); request.res?.setHeader('Cache-Control', 'public, max-age=120'); return { code: 200, msg: 'success', data: data.map((vehicle: any) => ({ ...vehicle, images: vehicle.images?.length ? [vehicle.images[0]] : [] })) }; }
  @Get('vehicles/:id') async vehicle(@Param('id') id: string) { return { code: 200, msg: 'success', data: await this.service.getVehicle(id) }; }
  @Get('banners') async banners(@Req() request: any) { request.res?.setHeader('Cache-Control', 'public, max-age=120'); return { code: 200, msg: 'success', data: await this.service.listBanners() }; }
  @Get('contact') async contact() { return { code: 200, msg: 'success', data: await this.service.getContactSettings() }; }
  @Post('pricing/preview') @HttpCode(200) async pricingPreview(@Body() body: any) { return { code: 200, msg: 'success', data: await this.service.preview(body, false) }; }
  @Post('inquiries') @HttpCode(200) async submitInquiry(@Body() body: any) { return { code: 200, msg: '提交成功', data: await this.service.submitInquiry(body) }; }
  @Get('inquiries/stats') async inquiryStats() { return { code: 200, msg: 'success', data: await this.service.getInquiryStats() }; }
}

@Controller('admin/operations')
@UseGuards(AdminAuthGuard)
export class AdminOperationsController {
  constructor(private readonly service: OperationsService, private readonly adminData: AdminDataService) {}

  @Get('vehicles') async vehicles(@Query('mode') mode?: string) { return { code: 200, msg: 'success', data: this.adminData.isSqlite ? this.adminData.listVehicles(mode) : await this.service.listVehicles(true, mode || undefined) }; }
  @Put('vehicles/:id') @HttpCode(200) async vehicle(@Req() request: any, @Param('id') id: string, @Body() body: any) { superOnly(request); return { code: 200, msg: '已保存', data: this.adminData.isSqlite ? this.adminData.saveVehicle(request.admin.id, id, body) : await this.service.saveVehicle(request.admin.id, id, body) }; }
  @Delete('vehicles/:id') @HttpCode(200) async deleteVehicle(@Req() request: any, @Param('id') id: string) { superOnly(request); if (this.adminData.isSqlite) this.adminData.deleteVehicle(request.admin.id, id); else await this.service.deleteVehicle(request.admin.id, id); return { code: 200, msg: '已删除', data: null }; }
  @Post('vehicles/:id/images') @HttpCode(200) async image(@Req() request: any, @Param('id') id: string, @Body() body: any) { superOnly(request); if (this.adminData.isSqlite) this.adminData.addVehicleImage(); return { code: 200, msg: '已添加', data: await this.service.addVehicleImage(request.admin.id, id, body) }; }
  @Delete('vehicles/:id/images/:imageId') @HttpCode(200) async deleteImage(@Req() request: any, @Param('id') id: string, @Param('imageId') imageId: string) { superOnly(request); if (this.adminData.isSqlite) this.adminData.deleteVehicleImage(request.admin.id, id, imageId); else await this.service.deleteVehicleImage(request.admin.id, id, imageId); return { code: 200, msg: '已删除', data: null }; }

  @Get('banners') async banners() { return { code: 200, msg: 'success', data: this.adminData.isSqlite ? this.adminData.listBanners() : await this.service.listBanners(true) }; }
  @Put('banners/:id') @HttpCode(200) async banner(@Req() request: any, @Param('id') id: string, @Body() body: any) { superOnly(request); return { code: 200, msg: '已保存', data: this.adminData.isSqlite ? this.adminData.saveBanner(request.admin.id, id, body) : await this.service.saveBanner(request.admin.id, id, body) }; }
  @Post('upload') @HttpCode(200) @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } })) async upload(@Req() request: any, @UploadedFile() file: any) { superOnly(request); if (this.adminData.isSqlite) throw new ServiceUnavailableException({ code: 'LOCAL_UPLOAD_DISABLED', message: '本地 SQLite 模式不执行真实上传，请在线上 TOS 环境联调' }); return { code: 200, msg: '上传成功', data: await this.service.upload(request.admin.id, file, 'images') }; }

  @Get('pricing') async pricing() { return { code: 200, msg: 'success', data: this.adminData.isSqlite ? this.adminData.pricing() : await this.service.pricing() }; }
  @Put('pricing/draft') @HttpCode(200) async draft(@Req() request: any, @Body() body: any) { superOnly(request); return { code: 200, msg: '草稿已保存', data: this.adminData.isSqlite ? this.adminData.saveDraft(request.admin.id, body.config, body.expectedVersion) : await this.service.saveDraft(request.admin.id, body.config, body.expectedVersion) }; }
  @Post('pricing/preview') @HttpCode(200) async preview(@Body() body: any) { return { code: 200, msg: 'success', data: this.adminData.isSqlite ? this.adminData.preview(body.input, !!body.useDraft) : await this.service.preview(body.input, !!body.useDraft) }; }
  @Post('pricing/publish') @HttpCode(200) async publish(@Req() request: any, @Body() body: any) { superOnly(request); return { code: 200, msg: '已发布', data: this.adminData.isSqlite ? this.adminData.publish(request.admin.id, body.expectedVersion) : await this.service.publish(request.admin.id, body.expectedVersion) }; }
  @Post('orders/:id/suggested-quote') @HttpCode(200) async suggest(@Body() body: any) { return { code: 200, msg: 'success', data: this.adminData.isSqlite ? this.adminData.preview(body, false) : await this.service.preview(body, false) }; }

  @Get('inquiries') async inquiries(@Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('type') type?: string, @Query('status') status?: string) { return { code: 200, msg: 'success', data: this.adminData.isSqlite ? this.adminData.listInquiries(Number(page) || 1, Number(pageSize) || 100, type, status) : await this.service.listInquiries(Number(page) || 1, Number(pageSize) || 100, type, status) }; }
  @Put('inquiries/:id/status') @HttpCode(200) async updateInquiry(@Req() request: any, @Param('id') id: string, @Body() body: any) { return { code: 200, msg: '已更新', data: this.adminData.isSqlite ? this.adminData.updateInquiry(request.admin.id, id, body) : await this.service.updateInquiry(request.admin.id, id, body) }; }

  @Get('contact') async getContact() { return { code: 200, msg: 'success', data: this.adminData.isSqlite ? this.adminData.getContact() : await this.service.getContactSettings() }; }
  @Put('contact') @HttpCode(200) async saveContact(@Req() request: any, @Body() body: any) { superOnly(request); return { code: 200, msg: '已保存', data: this.adminData.isSqlite ? this.adminData.saveContact(request.admin.id, body) : await this.service.saveContactSettings(request.admin.id, body) }; }
}
