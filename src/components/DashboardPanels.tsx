"use client";

import { useEffect, useMemo, useState } from "react";
import type { Priority } from "@/lib/kanbanTypes";
import { useStore } from "@/lib/store";

type OpenClawHealth = {
  updatedAt: number;
  whatsapp?: { state?: string; authAgeSec?: number; number?: string; lastDisconnectTs?: number };
  gateway?: { reachable?: boolean; latencyMs?: number };
};

const PRI_ORDER: Record<Priority, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

function fmtAgo(ms: number) {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function DashboardPanels() {
  const tasks = useStore((s) => s.tasks);
  const [health, setHealth] = useState<OpenClawHealth | null>(null);
  const [healthErr, setHealthErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const pull = async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const data = await res.json();
        if (!alive) return;
        if (res.ok && data?.ok && data.health) {
          setHealth(data.health);
          setHealthErr(null);
        } else {
          setHealth(null);
        }
      } catch (e: any) {
        if (!alive) return;
        setHealthErr(String(e?.message ?? e));
      }
    };
    pull();
    const id = setInterval(pull, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const wip = useMemo(() => tasks.filter((t) => t.columnId === "DOING"), [tasks]);

  const queued = useMemo(() => {
    return tasks
      .filter((t) => t.columnId === "TODO" || t.columnId === "BACKLOG")
      .slice()
      .sort((a, b) => {
        const po = PRI_ORDER[a.priority] - PRI_ORDER[b.priority];
        if (po !== 0) return po;
        return b.updatedAt - a.updatedAt;
      });
  }, [tasks]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Health panel */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-300">Health</div>
            <div className="text-lg font-semibold text-slate-100">OpenClaw + WhatsApp</div>
          </div>
          <div className="text-xs text-slate-400">{health?.updatedAt ? fmtAgo(health.updatedAt) : "no pings yet"}</div>
        </div>

        {health ? (
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-300">WhatsApp</span>
              <span className="font-medium text-slate-100">
                {health.whatsapp?.state ?? "unknown"}
                {health.whatsapp?.number ? ` · ${health.whatsapp.number}` : ""}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Auth age</span>
              <span className="font-medium text-slate-100">
                {typeof health.whatsapp?.authAgeSec === "number" ? `${Math.floor(health.whatsapp.authAgeSec / 60)}m` : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Gateway</span>
              <span className="font-medium text-slate-100">
                {health.gateway?.reachable ? "reachable" : "unknown"}
                {typeof health.gateway?.latencyMs === "number" ? ` · ${health.gateway.latencyMs}ms` : ""}
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-3 text-sm text-slate-300">
            {healthErr ? (
              <div className="text-slate-400">Health error: {healthErr}</div>
            ) : (
              <div>
                No OpenClaw health pings yet. (Next step: I’ll wire the local cron to POST health to this app so you can see WhatsApp link state + disconnects.)
              </div>
            )}
          </div>
        )}
      </div>

      {/* WIP + queue panel */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-300">Execution</div>
            <div className="text-lg font-semibold text-slate-100">WIP (limit 2) + Queue</div>
          </div>
          <div className={`rounded-full px-2 py-1 text-xs ${wip.length > 2 ? "bg-red-500/20 text-red-200" : "bg-emerald-500/15 text-emerald-200"}`}>
            {wip.length}/2
          </div>
        </div>

        <div className="mt-3">
          <div className="text-xs font-semibold text-slate-400">DOING</div>
          <div className="mt-1 space-y-1">
            {wip.length ? (
              wip.slice(0, 2).map((t) => (
                <div key={t.id} className="truncate rounded-lg border border-slate-800 bg-slate-950/40 px-2 py-1 text-sm text-slate-100">
                  {t.title}
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-400">Nothing in DOING</div>
            )}
          </div>
        </div>

        <div className="mt-4">
          <div className="text-xs font-semibold text-slate-400">QUEUE (TODO/BACKLOG)</div>
          <div className="mt-1 space-y-1">
            {queued.length ? (
              queued.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/30 px-2 py-1">
                  <div className="min-w-0 truncate text-sm text-slate-200">{t.title}</div>
                  <div className="shrink-0 rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-200">{t.priority}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-400">Queue empty</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
