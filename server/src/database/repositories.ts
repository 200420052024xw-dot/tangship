export const REPOSITORIES = Symbol('REPOSITORIES');
export interface UserRepository { findById(id:string): unknown; }
export interface SessionRepository { resolve(token:string): {id:string;userId:string}|undefined; revoke(token:string):void; }
export interface AddressRepository { list(userId:string):unknown[]; findOwned(id:string,userId:string):unknown; }
export interface OrderRepository { findOwned(id:string,userId:string):unknown; }
export interface QuoteRepository { current(orderId:string):unknown; }
export interface AdminRepository { findByUsername(username:string):unknown; }
export interface AuditLogRepository { write(adminId:string,action:string,resourceType:string,resourceId:string,detail:unknown):void; }
export interface PaymentGateway { createPayment(orderId:string,amountCents:number):Promise<{providerTradeNo:string}>; }
export class DisabledPaymentGateway implements PaymentGateway { async createPayment():Promise<{providerTradeNo:string}>{throw new Error('Payment gateway is not configured');} }
