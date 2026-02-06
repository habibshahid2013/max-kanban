#!/usr/bin/env node

// max-kanban stale sweeper
// Default: NOTIFY-ONLY (prints a WhatsApp-ready summary of stale DOING tasks).
// Optional: --demote to auto-demote tasks stuck in DOING for >24h back to TODO.
// Exempt tags: pinned, wip-ok
// Auth: uses MAXKANBAN_TOKEN (same as /api/tasks) when set.

const BASE = process.env.MAX_KANBAN_URL || "https://max-kanban.vercel.app";
const TOKEN = process.env.MAXKANBAN_TOKEN || "";

const STALE_MS = 24 * 60 * 60 * 1000;
const EXEMPT_TAGS = new Set(["pinned", "wip-ok"]);

const MODE = process.argv.includes("--demote") ? "demote" : "notify";

// lock to avoid double-trigger
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const LOCK_PATH = path.join(os.tmpdir(), "max-kanban-stale-sweeper.lock");
const STALE_LOCK_MS = 5 * 60 * 1000;

function acquireLock() {
  try {
    const fd = fs.openSync(LOCK_PATH, "wx");
    fs.writeFileSync(fd, String(Date.now()));
    return () => {
      try { fs.closeSync(fd); } catch {}
      try { fs.unlinkSync(LOCK_PATH); } catch {}
    };
  } catch {
    try {
      const st = fs.statSync(LOCK_PATH);
      if (Date.now() - st.mtimeMs > STALE_LOCK_MS) {
        fs.unlinkSync(LOCK_PATH);
        const fd = fs.openSync(LOCK_PATH, "wx");
        fs.writeFileSync(fd, String(Date.now()));
        return () => {
          try { fs.closeSync(fd); } catch {}
          try { fs.unlinkSync(LOCK_PATH); } catch {}
        };
      }
    } catch {}
    return null;
  }
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

function hasExemptTag(tags = []) {
  return tags.some((t) => EXEMPT_TAGS.has(String(t).toLowerCase()));
}

async function main() {
  const startedAt = Date.now();
  const release = acquireLock();
  if (!release) return;

  let demoted = 0;
  const demotedTitles = [];
  const staleTitles = [];

  try {
    const data = await api("/api/tasks", { method: "GET" });
    if (!data) return;

    const tasks = data.tasks || [];
    const now = Date.now();

    const stale = tasks.filter((t) => {
      if (!t || t.columnId !== "DOING") return false;
      if (hasExemptTag(t.tags || [])) return false;
      const updatedAt = Number(t.updatedAt || 0);
      if (!updatedAt) return false;
      return now - updatedAt > STALE_MS;
    });

    // Always collect a report
    for (const t of stale) staleTitles.push(String(t.title || t.id));

    // Only demote when explicitly requested
    if (MODE === "demote") {
      for (const t of stale) {
        const ts = new Date().toISOString();
        const desc = String(t.description || "");
        const marker = `[Max] Auto-demoted (stale >24h): ${ts}`;
        const nextDesc = desc.includes("[Max] Auto-demoted") ? desc : `${marker}\n\n${desc}`.trim();

        await api("/api/tasks", {
          method: "PATCH",
          body: JSON.stringify({ id: t.id, columnId: "TODO", description: nextDesc }),
        });

        demoted++;
        demotedTitles.push(String(t.title || t.id));
      }
    }
  } finally {
    release();
    const ms = Date.now() - startedAt;

    if (MODE === "demote") {
      if (demoted > 0) {
        console.log(`max-kanban-stale-sweeper: demoted ${demoted} DOING→TODO in ${ms}ms`);
        console.log(`max-kanban-stale-sweeper: demoted: ${demotedTitles.slice(0, 10).join(" | ")}${demotedTitles.length > 10 ? " | …" : ""}`);
      } else {
        console.log(`max-kanban-stale-sweeper: no stale DOING tasks (${ms}ms)`);
      }
      return;
    }

    // notify-only summary (WhatsApp-ready)
    if (staleTitles.length === 0) {
      console.log(`max-kanban-stale-sweeper: notify: none stale (${ms}ms)`);
    } else {
      console.log(`max-kanban-stale-sweeper: notify: ${staleTitles.length} stale DOING task(s) (${ms}ms)`);
      // human-readable list for copy/paste
      console.log(`STale DOING (24h+):\n- ${staleTitles.join("\n- ")}`);
    }
  }
}

main().catch((e) => {
  console.error(`max-kanban-stale-sweeper: error: ${e?.message || String(e)}`);
  process.exit(1);
});
