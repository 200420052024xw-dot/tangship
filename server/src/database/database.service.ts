import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Database = require('better-sqlite3');
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly db: Database.Database;
  constructor() {
    const configured = process.env.SQLITE_DB_PATH;
    if (!configured) throw new Error('SQLITE_DB_PATH is required');
    const path = isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
    mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_mode = WAL');
    this.db.pragma(`busy_timeout = ${Number(process.env.SQLITE_BUSY_TIMEOUT_MS || 5000)}`);
  }
  migrate() {
    this.db.exec('CREATE TABLE IF NOT EXISTS _app_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
    const directory=resolve(process.cwd(),'drizzle');
    for(const name of readdirSync(directory).filter(v=>v.endsWith('.sql')).sort()){
      if(this.db.prepare('SELECT 1 FROM _app_migrations WHERE name=?').get(name))continue;
      const sql=readFileSync(resolve(directory,name),'utf8').replaceAll('--> statement-breakpoint','');
      this.db.transaction(()=>{this.db.exec(sql);this.db.prepare('INSERT INTO _app_migrations VALUES(?,?)').run(name,new Date().toISOString());})();
    }
  }
  onModuleDestroy() { this.db.close(); }
}
