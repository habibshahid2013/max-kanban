"use client";

import { nextLevelProgress, useStore } from "@/lib/store";

export function StatsHeader() {
  const xp = useStore((s) => s.xp);
  const level = useStore((s) => s.level);
  const streak = useStore((s) => s.streak);

  const prog = nextLevelProgress(xp);
  const pct = Math.max(0, Math.min(100, Math.round((prog.into / prog.needed) * 100)));

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-slate-600">Level</div>
          <div className="text-2xl font-semibold text-slate-900">{level}</div>
        </div>

        <div className="flex-1 min-w-[220px]">
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>XP</span>
            <span>
              {prog.into}/{prog.needed}
            </span>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-indigo-600" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div>
          <div className="text-sm text-slate-600">Streak</div>
          <div className="text-2xl font-semibold text-slate-900">{streak}</div>
        </div>
      </div>
    </div>
  );
}
