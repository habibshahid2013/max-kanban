import { Pool } from "pg";

// Global pool reuse across hot reload / lambda invocations.
const globalForDb = globalThis as unknown as { __mk_pool__?: Pool };

function makePool() {
  const cs = process.env.DATABASE_URL;
  if (!cs) throw new Error("DATABASE_URL is missing");

  // Neon pooled URLs typically require SSL.
  return new Pool({
    connectionString: cs,
    ssl: cs.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
    max: 5,
  });
}

export const pool = globalForDb.__mk_pool__ ?? makePool();
if (!globalForDb.__mk_pool__) globalForDb.__mk_pool__ = pool;

export async function ensureSchema() {
  await pool.query(`
    create table if not exists tasks (
      id text primary key,
      title text not null,
      description text not null default '',
      column_id text not null,
      priority text not null,
      tags text not null default '',
      xp_reward int not null default 25,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists status_kv (
      key text primary key,
      payload text not null default '{}',
      updated_at timestamptz not null default now()
    );
  `);
}

export async function q<T = any>(text: string, params: any[] = []): Promise<{ rows: T[] }> {
  const res = await pool.query(text, params);
  return { rows: res.rows as unknown as T[] };
}
