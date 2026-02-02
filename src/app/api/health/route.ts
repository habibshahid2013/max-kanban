import { NextResponse } from "next/server";
import { ensureSchema, q } from "@/lib/db";

function requireToken(req: Request) {
  const token = req.headers.get("x-maxkanban-token") || new URL(req.url).searchParams.get("token");
  const expected = process.env.MAXKANBAN_TOKEN;
  if (!expected) return true;
  return token && token === expected;
}

export async function GET() {
  try {
    await ensureSchema();
    const { rows } = await q<any>(`select key, payload, extract(epoch from updated_at)*1000 as updated_at_ms from status_kv where key='openclaw_health' limit 1;`);
    if (!rows.length) return NextResponse.json({ ok: true, health: null });
    const r = rows[0];
    return NextResponse.json({
      ok: true,
      health: {
        ...(JSON.parse(r.payload || "{}")),
        updatedAt: Number(r.updated_at_ms),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (!requireToken(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    await ensureSchema();
    const body = await req.json();
    const payload = JSON.stringify(body ?? {});
    await q(
      `insert into status_kv (key, payload) values ('openclaw_health',$1)
       on conflict (key) do update set payload=excluded.payload, updated_at=now();`,
      [payload]
    );
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
