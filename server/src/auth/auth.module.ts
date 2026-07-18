import { Module } from '@nestjs/common'
import { AuthController } from './auth.controller'
import { UserAuthGuard } from './auth'

@Module({ controllers: [AuthController], providers: [UserAuthGuard], exports: [UserAuthGuard] })
export class AuthModule {}
