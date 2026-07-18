import { Body, Controller, Get, Param, Post, Put, Req, UploadedFile, UseGuards, UseInterceptors, ForbiddenException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminAuthGuard } from '../auth/auth';
import { OperationsService } from './operations.service';
const superOnly=(req:any)=>{if(req.admin.role!=='super_admin')throw new ForbiddenException('仅超级管理员可修改运营配置');};
@Controller('content') export class PublicContentController{constructor(private service:OperationsService){}@Get('vehicles') vehicles(){return{code:200,msg:'success',data:this.service.listVehicles()}}@Get('vehicles/:id') vehicle(@Param('id') id:string){return{code:200,msg:'success',data:this.service.getVehicle(id)}}@Get('banners') banners(){return{code:200,msg:'success',data:this.service.listBanners()}}}
@Controller('admin/operations') @UseGuards(AdminAuthGuard) export class AdminOperationsController{constructor(private service:OperationsService){}
 @Get('vehicles') vehicles(){return{code:200,msg:'success',data:this.service.listVehicles(true)}}
 @Put('vehicles/:id') vehicle(@Req() req:any,@Param('id') id:string,@Body() body:any){superOnly(req);return{code:200,msg:'已保存',data:this.service.saveVehicle(req.admin.id,id,body)}}
 @Post('vehicles/:id/images') image(@Req() req:any,@Param('id') id:string,@Body() body:any){superOnly(req);return{code:200,msg:'已添加',data:this.service.addVehicleImage(req.admin.id,id,body)}}
 @Get('banners') banners(){return{code:200,msg:'success',data:this.service.listBanners(true)}}
 @Put('banners/:id') banner(@Req() req:any,@Param('id') id:string,@Body() body:any){superOnly(req);return{code:200,msg:'已保存',data:this.service.saveBanner(req.admin.id,id,body)}}
 @Post('upload') @UseInterceptors(FileInterceptor('file',{limits:{fileSize:5*1024*1024}})) async upload(@Req() req:any,@UploadedFile() file:any){superOnly(req);return{code:200,msg:'上传成功',data:await this.service.upload(req.admin.id,file,'images')}}
 @Get('pricing') pricing(){return{code:200,msg:'success',data:this.service.pricing()}}
 @Put('pricing/draft') draft(@Req() req:any,@Body() body:any){superOnly(req);return{code:200,msg:'草稿已保存',data:this.service.saveDraft(req.admin.id,body.config,body.expectedVersion)}}
 @Post('pricing/preview') preview(@Body() body:any){return{code:200,msg:'success',data:this.service.preview(body.input,!!body.useDraft)}}
 @Post('pricing/publish') publish(@Req() req:any,@Body() body:any){superOnly(req);return{code:200,msg:'已发布',data:this.service.publish(req.admin.id,body.expectedVersion)}}
 @Post('orders/:id/suggested-quote') suggest(@Body() body:any){return{code:200,msg:'success',data:this.service.preview(body,false)}}}
