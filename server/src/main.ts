import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '@/app.module';
import * as express from 'express';
import { HttpStatusInterceptor } from '@/interceptors/http-status.interceptor';
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { SupabaseService } from '@/supabase/supabase.service';
import { seedSupabase } from '@/supabase/seed';

for (const candidate of [resolve(process.cwd(), '.env.local'), resolve(process.cwd(), '../.env.local')]) {
  if (existsSync(candidate)) {
    loadEnv({ path: candidate, override: process.env.NODE_ENV !== 'production' });
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
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const allowedOrigins=(process.env.ADMIN_ALLOWED_ORIGINS||'http://localhost:5174').split(',').map(v=>v.trim()).filter(Boolean);
  const isDev = process.env.NODE_ENV !== 'production';
  app.enableCors({origin:(origin,callback)=>{
    if(!origin||allowedOrigins.includes(origin)||(isDev&&(origin.includes('localhost')||origin.includes('dev.coze.site'))))callback(null,true);
    else callback(new Error('Origin not allowed'));
  },credentials:true});
  app.setGlobalPrefix('api', {
    exclude: ['/admin/{*s}'],
  });
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ limit: '1mb', extended: true }));

  // Serve admin-web static files
  const adminDist = resolve(process.cwd(), 'public/admin');
  if (existsSync(adminDist)) {
    app.useStaticAssets(adminDist, { prefix: '/admin/' });
    // SPA fallback for client-side routing
    const expressApp = app.getHttpAdapter().getInstance() as express.Express;
    expressApp.get(/^\/admin(?!\/assets\/).*/, (_req, res) => {
      res.sendFile(resolve(adminDist, 'index.html'));
    });
    console.log(`Admin web served at /admin/`);
  }

  // 全局拦截器：统一将 POST 请求的 201 状态码改为 200
  app.useGlobalInterceptors(new HttpStatusInterceptor());
  app.enableShutdownHooks();

  // Seed database on startup
  const supabaseService = app.get(SupabaseService);
  await seedSupabase(supabaseService);

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
