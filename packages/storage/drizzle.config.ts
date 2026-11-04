import { defineConfig } from 'drizzle-kit';

// `pnpm --filter @roastpilot/storage exec drizzle-kit generate` writes SQL migrations from the schema.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/schema/*.ts',
  out: './src/migrations',
});
