#!/usr/bin/env node

// Auto-start tasks by moving them to DOING.
// Single-user rule (Hassan-only):
// - Prefer tasks explicitly assigned to Max (title starts with "Max:" or tags include max/ai)
// - Otherwise, auto-start the highest-priority TODO/BACKLOG task.
// Safety: only start ONE task per run.

const BASE = process.env.MAX_KANBAN_URL || "https://max-kanban.vercel.app";
const TOKEN = process.env.MAXKANBAN_TOKEN || "";

function isAssignedToMax(t) {
  const title = String(t.title || "").trim();
  if (/^max\s*:/i.test(title)) return true;
  const tags = Array.isArray(t.tags) ? t.tags.map((x) => String(x).toLowerCase()) : [];
  return tags.includes("max") || tags.includes("ai");
}

function canStart(t) {
  return t && (t.columnId === "BACKLOG" || t.columnId === "TODO");
}

function priorityRank(p) {
  const v = String(p || "").toUpperCase();
  if (v === "URGENT") return 0;
  if (v === "HIGH") return 1;
  if (v === "MEDIUM") return 2;
  return 3;
}

async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}), "content-type": "application/json" };
  if (TOKEN) headers["x-maxkanban-token"] = TOKEN;
  const res = await fetch(`${BASE}${path}`, { ...opts, headers, cache: "no-store" });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!res.ok) {
    // If DB isn't configured, the API may 500. Treat as a no-op.
    if (res.status === 500) return null;
    throw new Error(`HTTP ${res.status} ${typeof data === "string" ? data : JSON.stringify(data)}`);
  }
  return data;
}

async function main() {
  const data = await api("/api/tasks", { method: "GET" });
  if (!data) {
    // silent no-op
    return;
  }
  const tasks = data.tasks || [];

  // 1) Prefer explicitly-assigned tasks
  const explicit = tasks
    .filter((t) => isAssignedToMax(t) && canStart(t))
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || (b.createdAt ?? 0) - (a.createdAt ?? 0));

  // 2) Otherwise pick the single highest priority startable task
  const fallback = tasks
    .filter((t) => canStart(t))
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || (b.createdAt ?? 0) - (a.createdAt ?? 0));

  const pick = explicit[0] || fallback[0];
  if (!pick) {
    // silent no-op
    return;
  }

  const t = pick;
  const now = new Date().toISOString();
  const desc = String(t.description || "");
  const marker = `\n\n[Max] Auto-started: ${now}`;
  const nextDesc = desc.includes("[Max] Auto-started") ? desc : (desc + marker).trim();

  await api("/api/tasks", {
    method: "PATCH",
    body: JSON.stringify({ id: t.id, columnId: "DOING", description: nextDesc }),
  });

  console.log(`Started: ${t.title} (${t.id})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
