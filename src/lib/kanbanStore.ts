"use client";

import { nanoid } from "nanoid";
import type { BoardState, Card, ColumnId, Priority } from "./kanbanTypes";

const STORAGE_KEY = "max-kanban:v1";

export function defaultState(): BoardState {
  return {
    version: 1,
    columns: [
      { id: "BACKLOG", name: "Backlog", order: 10 },
      { id: "TODO", name: "Todo", order: 20 },
      { id: "DOING", name: "Doing", order: 30 },
      { id: "BLOCKED", name: "Blocked", order: 40 },
      { id: "DONE", name: "Done", order: 50 },
    ],
    cards: [],
  };
}

export function loadState(): BoardState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as BoardState;
    if (parsed?.version !== 1) return defaultState();
    // light validation
    if (!Array.isArray(parsed.columns) || !Array.isArray(parsed.cards)) return defaultState();
    return parsed;
  } catch {
    return defaultState();
  }
}

export function saveState(state: BoardState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function createCard(input: {
  title: string;
  description?: string;
  columnId?: ColumnId;
  priority?: Priority;
  tags?: string[];
  dueAt?: number;
}): Card {
  const now = Date.now();
  return {
    id: nanoid(),
    title: input.title.trim(),
    description: (input.description ?? "").trim(),
    columnId: input.columnId ?? "TODO",
    priority: input.priority ?? "MEDIUM",
    tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean),
    dueAt: input.dueAt,
    createdAt: now,
    updatedAt: now,
  };
}
