"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";
import type { ColumnId, Priority } from "./kanbanTypes";
import { dayKey, levelForXp, xpToNextLevel } from "./gamification";

export type Task = {
  id: string;
  title: string;
  description: string;
  columnId: ColumnId;
  priority: Priority;
  tags: string[];
  xpReward: number; // awarded when moved to DONE
  createdAt: number;
  updatedAt: number;
};

export type StoreState = {
  version: 1;
  tasks: Task[];

  xp: number;
  level: number;
  streak: number;
  lastDoneDay: string | null;

  addTask: (t: Omit<Task, "id" | "createdAt" | "updatedAt">) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  moveTask: (id: string, to: ColumnId) => void;
  clearAll: () => void;

  exportJson: () => string;
  importJson: (raw: string) => void;
};

function clampTitle(s: string) {
  return s.trim().slice(0, 200);
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      version: 1,
      tasks: [],

      xp: 0,
      level: 1,
      streak: 0,
      lastDoneDay: null,

      addTask: (t) =>
        set((s) => {
          const now = Date.now();
          const task: Task = {
            id: nanoid(),
            title: clampTitle(t.title),
            description: (t.description ?? "").trim(),
            columnId: t.columnId ?? "TODO",
            priority: t.priority ?? "MEDIUM",
            tags: (t.tags ?? []).map((x) => x.trim()).filter(Boolean),
            xpReward: Math.max(0, Math.min(500, t.xpReward ?? 25)),
            createdAt: now,
            updatedAt: now,
          };
          return { ...s, tasks: [task, ...s.tasks] };
        }),

      updateTask: (id, patch) =>
        set((s) => ({
          ...s,
          tasks: s.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  ...patch,
                  title: patch.title ? clampTitle(patch.title) : t.title,
                  updatedAt: Date.now(),
                }
              : t
          ),
        })),

      deleteTask: (id) => set((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) })),

      moveTask: (id, to) =>
        set((s) => {
          const task = s.tasks.find((t) => t.id === id);
          if (!task) return s;

          const wasDone = task.columnId === "DONE";
          const goingDone = to === "DONE";

          let xp = s.xp;
          let lastDoneDay = s.lastDoneDay;
          let streak = s.streak;

          if (!wasDone && goingDone) {
            xp += task.xpReward;

            const today = dayKey(new Date());
            if (lastDoneDay === today) {
              // no streak change
            } else if (lastDoneDay) {
              const prevMs = Date.parse(lastDoneDay + "T00:00:00Z");
              const diffDays = Math.floor((Date.parse(today + "T00:00:00Z") - prevMs) / 86400000);
              if (diffDays === 1) streak += 1;
              else streak = 1;
            } else {
              streak = 1;
            }
            lastDoneDay = today;
          }

          const level = levelForXp(xp);

          return {
            ...s,
            xp,
            level,
            streak,
            lastDoneDay,
            tasks: s.tasks.map((t) => (t.id === id ? { ...t, columnId: to, updatedAt: Date.now() } : t)),
          };
        }),

      clearAll: () => set({ version: 1, tasks: [], xp: 0, level: 1, streak: 0, lastDoneDay: null }),

      exportJson: () => {
        const s = get();
        return JSON.stringify(
          {
            version: 1,
            tasks: s.tasks,
            stats: { xp: s.xp, level: s.level, streak: s.streak, lastDoneDay: s.lastDoneDay },
          },
          null,
          2
        );
      },

      importJson: (raw) => {
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.tasks)) throw new Error("Invalid export");
        const stats = parsed.stats ?? {};
        set({
          version: 1,
          tasks: parsed.tasks,
          xp: Number(stats.xp ?? 0) || 0,
          level: Number(stats.level ?? levelForXp(Number(stats.xp ?? 0) || 0)) || 1,
          streak: Number(stats.streak ?? 0) || 0,
          lastDoneDay: stats.lastDoneDay ?? null,
        });
      },
    }),
    {
      name: "max-kanban:z1",
      version: 1,
    }
  )
);

export function nextLevelProgress(xp: number) {
  return xpToNextLevel(xp);
}
