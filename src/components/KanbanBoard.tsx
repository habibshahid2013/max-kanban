"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

import type { BoardState, Card, ColumnId, Priority } from "@/lib/kanbanTypes";
import { createCard, loadState, saveState } from "@/lib/kanbanStore";
import { Modal } from "@/components/Modal";

function Badge({ children }: { children: string }) {
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{children}</span>;
}

function priorityClass(p: Priority) {
  switch (p) {
    case "URGENT":
      return "bg-red-100 text-red-800";
    case "HIGH":
      return "bg-orange-100 text-orange-800";
    case "MEDIUM":
      return "bg-slate-100 text-slate-800";
    case "LOW":
      return "bg-emerald-100 text-emerald-800";
  }
}

export function KanbanBoard() {
  const [state, setState] = useState<BoardState>(() => loadState());
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Card | null>(null);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const columns = useMemo(() => [...state.columns].sort((a, b) => a.order - b.order), [state.columns]);

  const cardsByColumn = useMemo(() => {
    const map: Record<ColumnId, Card[]> = {
      BACKLOG: [],
      TODO: [],
      DOING: [],
      BLOCKED: [],
      DONE: [],
    };
    for (const c of state.cards) map[c.columnId].push(c);
    // stable order: newest first for now
    for (const k of Object.keys(map) as ColumnId[]) {
      map[k].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    }
    return map;
  }, [state.cards]);

  const addCard = useCallback(
    (c: Card) => {
      setState((s) => ({ ...s, cards: [c, ...s.cards] }));
    },
    [setState]
  );

  const updateCard = useCallback((id: string, patch: Partial<Card>) => {
    setState((s) => ({
      ...s,
      cards: s.cards.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c)),
    }));
  }, []);

  const deleteCard = useCallback((id: string) => {
    setState((s) => ({ ...s, cards: s.cards.filter((c) => c.id !== id) }));
    setSelected((cur) => (cur?.id === id ? null : cur));
  }, []);

  const clearAll = useCallback(() => {
    setState((s) => ({ ...s, cards: [] }));
    setSelected(null);
  }, []);

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      const { active, over } = e;
      if (!over) return;
      const cardId = String(active.id);
      const overId = String(over.id);

      // We encode droppable ids as: col:<COLUMN_ID>
      if (overId.startsWith("col:")) {
        const col = overId.replace("col:", "") as ColumnId;
        updateCard(cardId, { columnId: col });
      }
    },
    [updateCard]
  );

  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "max-kanban-export.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [state]);

  const importJson = useCallback(async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const parsed = JSON.parse(text) as BoardState;
        if (parsed.version !== 1) throw new Error("Wrong version");
        if (!Array.isArray(parsed.columns) || !Array.isArray(parsed.cards)) throw new Error("Invalid shape");
        setState(parsed);
      } catch {
        alert("Invalid JSON export");
      }
    };
    input.click();
  }, []);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Max Kanban</h1>
          <p className="mt-1 text-slate-600">Local-first Kanban. Data is stored in your browser (for now).</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800" onClick={() => setCreateOpen(true)}>
            New task
          </button>
          <button className="rounded-lg border px-3 py-2 hover:bg-slate-50" onClick={exportJson}>
            Export
          </button>
          <button className="rounded-lg border px-3 py-2 hover:bg-slate-50" onClick={importJson}>
            Import
          </button>
          <button className="rounded-lg border px-3 py-2 hover:bg-slate-50" onClick={clearAll}>
            Clear
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className="mt-6 grid gap-4 md:grid-cols-5">
          {columns.map((col) => (
            <div key={col.id} className="rounded-xl border bg-white p-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">{col.name}</h2>
                <Badge>{String(cardsByColumn[col.id].length)}</Badge>
              </div>

              <div id={`col:${col.id}`} className="mt-3 min-h-[200px] rounded-lg bg-slate-50 p-2">
                <SortableContext items={cardsByColumn[col.id].map((c) => c.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {cardsByColumn[col.id].map((c) => (
                      <div
                        key={c.id}
                        className="cursor-pointer rounded-lg border bg-white p-3 shadow-sm hover:bg-slate-50"
                        onClick={() => setSelected(c)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm font-medium text-slate-900">{c.title}</div>
                          <span className={`rounded-full px-2 py-0.5 text-xs ${priorityClass(c.priority)}`}>{c.priority}</span>
                        </div>
                        {c.tags.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {c.tags.slice(0, 4).map((t) => (
                              <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                                {t}
                              </span>
                            ))}
                            {c.tags.length > 4 ? <span className="text-xs text-slate-500">+{c.tags.length - 4}</span> : null}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </SortableContext>
              </div>

              <div className="mt-2">
                <button
                  className="w-full rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
                  onClick={() => {
                    setCreateOpen(true);
                    // default column
                    (window as any).__MK_DEFAULT_COL__ = col.id;
                  }}
                >
                  + Add
                </button>
              </div>
            </div>
          ))}
        </div>
      </DndContext>

      <Modal open={createOpen} title="New task" onClose={() => setCreateOpen(false)}>
        <CreateTaskForm
          onCreate={(c) => {
            addCard(c);
            setCreateOpen(false);
          }}
        />
      </Modal>

      <Modal open={!!selected} title={selected?.title ?? "Task"} onClose={() => setSelected(null)}>
        {selected ? (
          <TaskDetail
            card={selected}
            onChange={(patch) => {
              updateCard(selected.id, patch);
              setSelected((cur) => (cur ? { ...cur, ...patch, updatedAt: Date.now() } : cur));
            }}
            onDelete={() => deleteCard(selected.id)}
          />
        ) : null}
      </Modal>
    </div>
  );
}

function CreateTaskForm({ onCreate }: { onCreate: (c: Card) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [tags, setTags] = useState("");

  const submit = () => {
    const defaultCol = ((window as any).__MK_DEFAULT_COL__ as ColumnId | undefined) ?? "TODO";
    (window as any).__MK_DEFAULT_COL__ = undefined;
    if (!title.trim()) return;
    onCreate(
      createCard({
        title,
        description,
        priority,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        columnId: defaultCol,
      })
    );
    setTitle("");
    setDescription("");
    setPriority("MEDIUM");
    setTags("");
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium">Title</label>
        <input
          className="mt-1 w-full rounded-lg border px-3 py-2"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Ship kanban MVP"
        />
      </div>
      <div>
        <label className="text-sm font-medium">Description</label>
        <textarea
          className="mt-1 w-full rounded-lg border px-3 py-2"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Priority</label>
          <select className="mt-1 w-full rounded-lg border px-3 py-2" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="URGENT">URGENT</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Tags (comma-separated)</label>
          <input className="mt-1 w-full rounded-lg border px-3 py-2" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="ui, backend" />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button className="rounded-lg border px-4 py-2 hover:bg-slate-50" type="button" onClick={() => { setTitle(""); setDescription(""); setTags(""); }}>
          Reset
        </button>
        <button className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800" type="button" onClick={submit}>
          Create
        </button>
      </div>
    </div>
  );
}

function TaskDetail({
  card,
  onChange,
  onDelete,
}: {
  card: Card;
  onChange: (patch: Partial<Card>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Status</label>
          <select
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={card.columnId}
            onChange={(e) => onChange({ columnId: e.target.value as ColumnId })}
          >
            <option value="BACKLOG">Backlog</option>
            <option value="TODO">Todo</option>
            <option value="DOING">Doing</option>
            <option value="BLOCKED">Blocked</option>
            <option value="DONE">Done</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Priority</label>
          <select
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={card.priority}
            onChange={(e) => onChange({ priority: e.target.value as Priority })}
          >
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="URGENT">URGENT</option>
          </select>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Description</label>
        <textarea
          className="mt-1 w-full rounded-lg border px-3 py-2"
          rows={6}
          value={card.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </div>

      <div>
        <label className="text-sm font-medium">Tags</label>
        <input
          className="mt-1 w-full rounded-lg border px-3 py-2"
          value={card.tags.join(", ")}
          onChange={(e) => onChange({ tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">
          Updated {new Date(card.updatedAt).toLocaleString()}
        </div>
        <button className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-red-700 hover:bg-red-100" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}
