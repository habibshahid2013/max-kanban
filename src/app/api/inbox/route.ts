import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { parseTaskText } from "@/lib/taskNlp";

function requireToken(req: Request) {
  const token = req.headers.get("x-maxkanban-token") || new URL(req.url).searchParams.get("token");
  const expected = process.env.MAXKANBAN_TOKEN;
  if (!expected) return true;
  return token && token === expected;
}

async function ensureSchema() {
  await sql`
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
  `;
}

export async function POST(req: Request) {
  if (!requireToken(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  await ensureSchema();

  const body = await req.json();
  const text = String(body.text || "").trim();
  if (!text) return NextResponse.json({ ok: false, error: "text required" }, { status: 400 });

  const parsed = parseTaskText(text);
  const id = crypto.randomUUID();
  const tags = parsed.tags.join(",");

  await sql`
    insert into tasks (id, title, column_id, priority, tags, xp_reward)
    values (${id}, ${parsed.title}, ${parsed.columnId}, ${parsed.priority}, ${tags}, ${parsed.xpReward});
  `;

  return NextResponse.json({ ok: true, id, parsed });
}
