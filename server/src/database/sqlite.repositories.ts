import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseService } from './database.service';

export const hashToken=(token:string)=>createHash('sha256').update(token).digest('hex');
@Injectable()
export class SqliteRepositories {
  constructor(readonly database:DatabaseService) {}
  user={findById:(id:string)=>this.database.db.prepare('SELECT * FROM users WHERE id=?').get(id)};
  session={
    resolve:(token:string)=>this.database.db.prepare("SELECT id,user_id userId FROM user_sessions WHERE token_hash=? AND revoked_at IS NULL AND expires_at>?").get(hashToken(token),new Date().toISOString()) as {id:string;userId:string}|undefined,
    revoke:(token:string)=>{this.database.db.prepare('UPDATE user_sessions SET revoked_at=? WHERE token_hash=?').run(new Date().toISOString(),hashToken(token));},
  };
  address={list:(userId:string)=>this.database.db.prepare('SELECT * FROM addresses WHERE user_id=? AND deleted_at IS NULL ORDER BY updated_at DESC').all(userId),findOwned:(id:string,userId:string)=>this.database.db.prepare('SELECT * FROM addresses WHERE id=? AND user_id=? AND deleted_at IS NULL').get(id,userId)};
  order={findOwned:(id:string,userId:string)=>this.database.db.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').get(id,userId)};
  quote={current:(orderId:string)=>this.database.db.prepare('SELECT * FROM order_quotes WHERE order_id=? ORDER BY created_at DESC LIMIT 1').get(orderId)};
  admin={findByUsername:(username:string)=>this.database.db.prepare('SELECT * FROM admin_users WHERE username=? AND status=\'active\'').get(username)};
  audit={write:(adminId:string,action:string,resourceType:string,resourceId:string,detail:unknown)=>this.database.db.prepare('INSERT INTO audit_logs VALUES(?,?,?,?,?,?,?)').run(randomUUID(),adminId,action,resourceType,resourceId,JSON.stringify(detail),new Date().toISOString())};
}
