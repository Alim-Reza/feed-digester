import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dbCredentials: {
    url: process.env.DATA_DIR
      ? `${process.env.DATA_DIR}/feed-digester.sqlite`
      : './data/feed-digester.sqlite',
  },
});
