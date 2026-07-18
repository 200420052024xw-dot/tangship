import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import * as express from 'express';
import { HttpStatusInterceptor } from '@/interceptors/http-status.interceptor';
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

for (const candidate of [resolve(process.cwd(), '.env.local'), resolve(process.cwd(), '../.env.local')]) {
  if (existsSync(candidate)) {
    loadEnv({ path: candidate, override: process.env.NODE_ENV !== 'production' });
    if (process.env.SQLITE_DB_PATH && !isAbsolute(process.env.SQLITE_DB_PATH)) process.env.SQLITE_DB_PATH = resolve(dirname(candidate), process.env.SQLITE_DB_PATH);
    break;
  }
}

function parsePort(): number {
  const args = process.argv.slice(2);
  const portIndex = args.indexOf('-p');
  if (portIndex !== -1 && args[portIndex + 1]) {
    const port = parseInt(args[portIndex + 1], 10);
    if (!isNaN(port) && port > 0 && port < 65536) {
      return port;
    }
  }
  return 3000;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const allowedOrigins=(process.env.ADMIN_ALLOWED_ORIGINS||'http://localhost:5174').split(',').map(v=>v.trim()).filter(Boolean);
  app.enableCors({origin:(origin,callback)=>{if(!origin||allowedOrigins.includes(origin))callback(null,true);else callback(new Error('Origin not allowed'));},credentials:true});
  app.setGlobalPrefix('api');
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ limit: '1mb', extended: true }));

  // 全局拦截器：统一将 POST 请求的 201 状态码改为 200
  app.useGlobalInterceptors(new HttpStatusInterceptor());
  // 1. 开启优雅关闭 Hooks (关键!)
  app.enableShutdownHooks();

  // 2. 解析端口
  const port = parsePort();
  try {
    await app.listen(port);
    console.log(`Server running on http://localhost:${port}`);
  } catch (err) {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ 端口 ${port} 被占用! 请运行 'npx kill-port ${port}' 然后重试。`);
      process.exit(1);
    } else {
      throw err;
    }
  }
}
bootstrap();
