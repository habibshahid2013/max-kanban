import { NextResponse } from "next/server";
import { ensureSchema, q } from "@/lib/db";
import { parseTaskText } from "@/lib/taskNlp";

function requireToken(req: Request) {
  const token = req.headers.get("x-maxkanban-token") || new URL(req.url).searchParams.get("token");
  const expected = process.env.MAXKANBAN_TOKEN;
  if (!expected) return true;
  return token && token === expected;
}

export async function POST(req: Request) {
  try {
    if (!requireToken(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    await ensureSchema();

    const body = await req.json();
    const text = String(body.text || "").trim();
    if (!text) return NextResponse.json({ ok: false, error: "text required" }, { status: 400 });

    const parsed = parseTaskText(text);
    const id = crypto.randomUUID();
    const tags = parsed.tags.join(",");

    await q(
      `insert into tasks (id, title, column_id, priority, tags, xp_reward)
       values ($1,$2,$3,$4,$5,$6)`,
      [id, parsed.title, parsed.columnId, parsed.priority, tags, parsed.xpReward]
    );

    return NextResponse.json({ ok: true, id, parsed });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
