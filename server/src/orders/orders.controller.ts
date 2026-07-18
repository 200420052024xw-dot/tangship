import { Body, Controller, Get, Headers, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { UserAuthGuard } from '../auth/auth';
import { createOrderSchema, parseDto } from '../validation/schemas';

@Controller('orders')
@UseGuards(UserAuthGuard)
export class OrdersController {
  constructor(private orders: OrdersService) {}

  @Post() @HttpCode(200)
  async create(@Req() req: any, @Headers('idempotency-key') key: string, @Body() body: unknown) {
    const data = parseDto(createOrderSchema, body);
    const result = await this.orders.create(req.user.id, { ...data, idempotencyKey: key || '' });
    return { code: 200, msg: '订单已提交后台审核', data: result };
  }

  @Get()
  async list(@Req() req: any) {
    const data = await this.orders.list(req.user.id);
    return { code: 200, msg: 'success', data };
  }

  @Get(':id')
  async detail(@Req() req: any, @Param('id') id: string) {
    const data = await this.orders.detail(req.user.id, id);
    return { code: 200, msg: 'success', data };
  }

  @Post(':id/cancel') @HttpCode(200)
  async cancel(@Req() req: any, @Param('id') id: string) {
    const data = await this.orders.cancel(req.user.id, id);
    return { code: 200, msg: '订单已取消', data };
  }

  @Post(':id/pay') @HttpCode(200)
  async pay(@Req() req: any, @Param('id') id: string, @Body() body: { amountCents: number }) {
    const data = await this.orders.validatePayment(req.user.id, id, body.amountCents);
    return { code: 200, msg: '支付成功', data };
  }
}
