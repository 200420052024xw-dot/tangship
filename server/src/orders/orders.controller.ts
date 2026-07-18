import { Body, Controller, Get, Headers, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common'; import { OrdersService } from './orders.service'; import { UserAuthGuard } from '../auth/auth'; import { createOrderSchema, parseDto } from '../validation/schemas';
@Controller('orders') @UseGuards(UserAuthGuard) export class OrdersController {constructor(private orders:OrdersService){}
 @Post() @HttpCode(200) create(@Req() req:any,@Headers('idempotency-key') key:string,@Body() body:unknown){const data=parseDto(createOrderSchema,body);return {code:200,msg:'订单已提交后台审核',data:this.orders.create(req.user.id,{...data,idempotencyKey:key||''})};}
 @Get() list(@Req() req:any){return {code:200,msg:'success',data:this.orders.list(req.user.id)}}
 @Get(':id') detail(@Req() req:any,@Param('id') id:string){return {code:200,msg:'success',data:this.orders.detail(req.user.id,id)}}
 @Post(':id/cancel') @HttpCode(200) cancel(@Req() req:any,@Param('id') id:string){return {code:200,msg:'订单已取消',data:this.orders.cancel(req.user.id,id)}}
 @Post(':id/pay') @HttpCode(200) pay(@Req() req:any,@Param('id') id:string,@Body() body:{amountCents:number}){return {code:200,msg:'支付成功',data:this.orders.validatePayment(req.user.id,id,body.amountCents)}}
}
