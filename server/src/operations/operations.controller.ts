import { Body, Controller, Get, Param, Post, Put, Req, UploadedFile, UseGuards, UseInterceptors, ForbiddenException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminAuthGuard } from '../auth/auth';
import { OperationsService } from './operations.service';

const superOnly = (req: any) => { if (req.admin.role !== 'super_admin') throw new ForbiddenException('仅超级管理员可修改运营配置'); };

@Controller('content')
export class PublicContentController {
  constructor(private service: OperationsService) {}
  @Get('vehicles') async vehicles(@Req() req: any) {
    const data = await this.service.listVehicles();
    // 列表页精简: 只返回首图，去掉大图数组，大幅减少 payload
    const lite = data.map((v: any) => ({
      ...v, images: v.images?.length ? [v.images[0]] : [],
    }));
    req.res?.setHeader('Cache-Control', 'public, max-age=120');
    return { code: 200, msg: 'success', data: lite };
  }
  @Get('vehicles/:id') async vehicle(@Param('id') id: string) { return { code: 200, msg: 'success', data: await this.service.getVehicle(id) }; }
  @Get('banners') async banners(@Req() req: any) {
    req.res?.setHeader('Cache-Control', 'public, max-age=120');
    return { code: 200, msg: 'success', data: await this.service.listBanners() };
  }
}

@Controller('admin/operations')
@UseGuards(AdminAuthGuard)
export class AdminOperationsController {
  constructor(private service: OperationsService) {}

  @Get('vehicles') async vehicles() { return { code: 200, msg: 'success', data: await this.service.listVehicles(true) }; }
  @Put('vehicles/:id') async vehicle(@Req() req: any, @Param('id') id: string, @Body() body: any) { superOnly(req); return { code: 200, msg: '已保存', data: await this.service.saveVehicle(req.admin.id, id, body) }; }
  @Post('vehicles/:id/images') async image(@Req() req: any, @Param('id') id: string, @Body() body: any) { superOnly(req); return { code: 200, msg: '已添加', data: await this.service.addVehicleImage(req.admin.id, id, body) }; }
  @Get('banners') async banners() { return { code: 200, msg: 'success', data: await this.service.listBanners(true) }; }
  @Put('banners/:id') async banner(@Req() req: any, @Param('id') id: string, @Body() body: any) { superOnly(req); return { code: 200, msg: '已保存', data: await this.service.saveBanner(req.admin.id, id, body) }; }
  @Post('upload') @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } })) async upload(@Req() req: any, @UploadedFile() file: any) { superOnly(req); return { code: 200, msg: '上传成功', data: await this.service.upload(req.admin.id, file, 'images') }; }
  @Get('pricing') async pricing() { return { code: 200, msg: 'success', data: await this.service.pricing() }; }
  @Put('pricing/draft') async draft(@Req() req: any, @Body() body: any) { superOnly(req); return { code: 200, msg: '草稿已保存', data: await this.service.saveDraft(req.admin.id, body.config, body.expectedVersion) }; }
  @Post('pricing/preview') async preview(@Body() body: any) { return { code: 200, msg: 'success', data: this.service.preview(body.input, !!body.useDraft) }; }
  @Post('pricing/publish') async publish(@Req() req: any, @Body() body: any) { superOnly(req); return { code: 200, msg: '已发布', data: await this.service.publish(req.admin.id, body.expectedVersion) }; }
  @Post('orders/:id/suggested-quote') async suggest(@Body() body: any) { return { code: 200, msg: 'success', data: this.service.preview(body, false) }; }
}
