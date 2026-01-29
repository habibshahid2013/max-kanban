#!/usr/bin/env node

// Auto-start tasks assigned to Max by moving them to DOING.
// Assignment rule (for now):
// - title starts with "Max:" (case-insensitive) OR
// - tags include "max" OR "ai"
// Only moves tasks in BACKLOG or TODO.

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
    console.log("/api/tasks unavailable (likely DB not configured). No-op.");
    return;
  }
  const tasks = data.tasks || [];

  const startable = tasks.filter((t) => isAssignedToMax(t) && canStart(t));
  if (!startable.length) {
    console.log("No new assigned tasks to start.");
    return;
  }

  for (const t of startable) {
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
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
