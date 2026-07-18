import { defineConfig } from 'drizzle-kit';
export default defineConfig({ schema: './src/database/schema.ts', out: './drizzle', dialect: 'sqlite', dbCredentials: { url: process.env.SQLITE_DB_PATH || './data/app.db' } });
