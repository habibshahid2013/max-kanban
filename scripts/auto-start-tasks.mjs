#!/usr/bin/env node

// Auto-start tasks by moving them to DOING.
// Single-user rule (Hassan-only):
// - Prefer tasks explicitly assigned to Max (title starts with "Max:" or tags include max/ai)
// - Otherwise, auto-start the highest-priority TODO/BACKLOG task.
// Safety: only start ONE task per run.
//
// CLEANUP:
// - File lock to prevent double cron triggers from racing
// - One-line summary output for easier auditing

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = process.env.MAX_KANBAN_URL || "https://max-kanban.vercel.app";
const TOKEN = process.env.MAXKANBAN_TOKEN || "";

// ---- lock helpers ----
const LOCK_PATH = path.join(os.tmpdir(), "max-kanban-auto-start.lock");
const STALE_MS = 2 * 60 * 1000; // 2 minutes (script should be quick)

function acquireLock() {
  try {
    // O_EXCL style create; fails if already exists
    const fd = fs.openSync(LOCK_PATH, "wx");
    fs.writeFileSync(fd, String(Date.now()));
    return () => {
      try {
        fs.closeSync(fd);
      } catch {}
      try {
        fs.unlinkSync(LOCK_PATH);
      } catch {}
    };
  } catch {
    // If lock exists but is stale, remove and try once more
    try {
      const st = fs.statSync(LOCK_PATH);
      if (Date.now() - st.mtimeMs > STALE_MS) {
        fs.unlinkSync(LOCK_PATH);
        const fd = fs.openSync(LOCK_PATH, "wx");
        fs.writeFileSync(fd, String(Date.now()));
        return () => {
          try {
            fs.closeSync(fd);
          } catch {}
          try {
            fs.unlinkSync(LOCK_PATH);
          } catch {}
        };
      }
    } catch {}
    return null;
  }
}

// ---- task selection ----
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

async function api(p, opts = {}) {
  const headers = { ...(opts.headers || {}), "content-type": "application/json" };
  if (TOKEN) headers["x-maxkanban-token"] = TOKEN;

  const res = await fetch(`${BASE}${p}`, { ...opts, headers, cache: "no-store" });
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
  const startedAt = Date.now();
  const release = acquireLock();
  if (!release) {
    // Another run is in-flight (or lock not stale yet). Quiet exit.
    return;
  }

  let moved = 0;
  let pickedTitle = null;

  try {
    const data = await api("/api/tasks", { method: "GET" });
    if (!data) {
      // API 500 treated as no-op
      return;
    }

    const tasks = data.tasks || [];

    const explicit = tasks
      .filter((t) => isAssignedToMax(t) && canStart(t))
      .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || (b.createdAt ?? 0) - (a.createdAt ?? 0));

    const fallback = tasks
      .filter((t) => canStart(t))
      .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || (b.createdAt ?? 0) - (a.createdAt ?? 0));

    const pick = explicit[0] || fallback[0];
    if (!pick) return;

    const t = pick;
    pickedTitle = String(t.title || "");

    const now = new Date().toISOString();
    const desc = String(t.description || "");
    const marker = `\n\n[Max] Auto-started: ${now}`;
    const nextDesc = desc.includes("[Max] Auto-started") ? desc : (desc + marker).trim();

    await api("/api/tasks", {
      method: "PATCH",
      body: JSON.stringify({ id: t.id, columnId: "DOING", description: nextDesc }),
    });

    moved = 1;
  } finally {
    release();

    const ms = Date.now() - startedAt;
    if (moved > 0) {
      console.log(`max-kanban-auto-start: moved ${moved} task → DOING (${pickedTitle}) in ${ms}ms`);
    } else {
      console.log(`max-kanban-auto-start: no matching tasks (${ms}ms)`);
    }
  }
}

main().catch((e) => {
  console.error(`max-kanban-auto-start: error: ${e?.message || String(e)}`);
  process.exit(1);
});
