import { DatabaseService } from './database.service';const db=new DatabaseService();db.migrate();db.onModuleDestroy();console.log('SQLite migration complete');
