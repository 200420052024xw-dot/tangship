import { Module } from '@nestjs/common';import { AddressesController } from './addresses.controller';import { UserAuthGuard } from '../auth/auth';
@Module({controllers:[AddressesController],providers:[UserAuthGuard]})export class AddressesModule{}
