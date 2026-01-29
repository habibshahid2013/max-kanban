import { NextResponse } from "next/server";
import { ensureSchema, q } from "@/lib/db";

// Minimal token auth (single-user).
function requireToken(req: Request) {
  const token = req.headers.get("x-maxkanban-token") || new URL(req.url).searchParams.get("token");
  const expected = process.env.MAXKANBAN_TOKEN;
  if (!expected) return true; // allow if not configured (local dev)
  return token && token === expected;
}

export async function GET() {
  try {
    await ensureSchema();
    const { rows } = await q<any>(
      `
      select id, title, description, column_id, priority, tags, xp_reward,
             extract(epoch from created_at)*1000 as created_at_ms,
             extract(epoch from updated_at)*1000 as updated_at_ms
      from tasks
      order by updated_at desc
      limit 500;
      `
    );

    return NextResponse.json({
      ok: true,
      tasks: rows.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        columnId: r.column_id,
        priority: r.priority,
        tags: (r.tags || "").split(",").map((t: string) => t.trim()).filter(Boolean),
        xpReward: r.xp_reward,
        createdAt: Number(r.created_at_ms),
        updatedAt: Number(r.updated_at_ms),
      })),
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
    const id = String(body.id || crypto.randomUUID());
    const title = String(body.title || "").trim().slice(0, 200);
    const description = String(body.description || "").trim();
    const columnId = String(body.columnId || "TODO");
    const priority = String(body.priority || "MEDIUM");
    const tags = Array.isArray(body.tags) ? body.tags.map((t: any) => String(t).trim()).filter(Boolean).join(",") : "";
    const xpReward = Math.max(0, Math.min(500, Number(body.xpReward ?? 25) || 25));

    if (!title) return NextResponse.json({ ok: false, error: "title required" }, { status: 400 });

    await q(
      `
      insert into tasks (id, title, description, column_id, priority, tags, xp_reward)
      values ($1,$2,$3,$4,$5,$6,$7)
      on conflict (id) do update set
        title = excluded.title,
        description = excluded.description,
        column_id = excluded.column_id,
        priority = excluded.priority,
        tags = excluded.tags,
        xp_reward = excluded.xp_reward,
        updated_at = now();
      `,
      [id, title, description, columnId, priority, tags, xpReward]
    );

    return NextResponse.json({ ok: true, id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    if (!requireToken(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    await ensureSchema();

    const body = await req.json();
    const id = String(body.id || "");
    if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });

    const cur = await q<any>(`select * from tasks where id=$1 limit 1`, [id]);
    if (!cur.rows.length) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
    const row = cur.rows[0] as any;

    const title = body.title != null ? String(body.title).trim().slice(0, 200) : row.title;
    const description = body.description != null ? String(body.description).trim() : row.description;
    const columnId = body.columnId != null ? String(body.columnId) : row.column_id;
    const priority = body.priority != null ? String(body.priority) : row.priority;
    const tags = body.tags != null ? (Array.isArray(body.tags) ? body.tags.map((t: any) => String(t).trim()).filter(Boolean).join(",") : String(body.tags)) : row.tags;
    const xpReward = body.xpReward != null ? Math.max(0, Math.min(500, Number(body.xpReward) || 0)) : row.xp_reward;

    await q(
      `
      update tasks set
        title=$2,
        description=$3,
        column_id=$4,
        priority=$5,
        tags=$6,
        xp_reward=$7,
        updated_at=now()
      where id=$1;
      `,
      [id, title, description, columnId, priority, tags, xpReward]
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    if (!requireToken(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    await ensureSchema();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
    await q(`delete from tasks where id=$1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
