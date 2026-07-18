import { Global, Module, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { SqliteRepositories } from './sqlite.repositories';
@Global() @Module({providers:[DatabaseService,SqliteRepositories],exports:[DatabaseService,SqliteRepositories]})
export class DatabaseModule implements OnModuleInit { constructor(private db:DatabaseService){} onModuleInit(){this.db.migrate();} }
