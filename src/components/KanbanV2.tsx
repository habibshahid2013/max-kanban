"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { toast, Toaster } from "sonner";

import type { ColumnId, Priority } from "@/lib/kanbanTypes";
import { useStore } from "@/lib/store";
import { Modal } from "@/components/Modal";
import { DragTask } from "@/components/DragTask";
import { DropColumn } from "@/components/DropColumn";

const COLS: { id: ColumnId; name: string; head: string; accent: string; badge: string }[] = [
  { id: "BACKLOG", name: "Backlog", head: "bg-slate-900/70 text-slate-100 border-slate-800", accent: "border-l-slate-500", badge: "bg-slate-800 text-slate-100" },
  { id: "TODO", name: "To Do", head: "bg-slate-900/70 text-slate-100 border-slate-800", accent: "border-l-amber-400", badge: "bg-amber-400/15 text-amber-200" },
  { id: "DOING", name: "In Progress", head: "bg-slate-900/70 text-slate-100 border-slate-800", accent: "border-l-sky-400", badge: "bg-sky-400/15 text-sky-200" },
  { id: "BLOCKED", name: "Blocked", head: "bg-slate-900/70 text-slate-100 border-slate-800", accent: "border-l-red-400", badge: "bg-red-400/15 text-red-200" },
  { id: "DONE", name: "Done", head: "bg-slate-900/70 text-slate-100 border-slate-800", accent: "border-l-emerald-400", badge: "bg-emerald-400/15 text-emerald-200" },
];

function priClass(p: Priority) {
  switch (p) {
    case "URGENT":
      return "bg-red-400/15 text-red-200 border border-red-400/30";
    case "HIGH":
      return "bg-orange-400/15 text-orange-200 border border-orange-400/30";
    case "MEDIUM":
      return "bg-slate-800 text-slate-200 border border-slate-700";
    case "LOW":
      return "bg-emerald-400/15 text-emerald-200 border border-emerald-400/30";
  }
}

async function fetchServerTasks() {
  const res = await fetch("/api/tasks", { cache: "no-store" });
  if (!res.ok) throw new Error("fetch failed");
  const data = await res.json();
  if (!data.ok) throw new Error("bad response");
  return data.tasks as any[];
}

export function KanbanV2() {
  const tasks = useStore((s) => s.tasks);
  const addTask = useStore((s) => s.addTask);
  const moveTask = useStore((s) => s.moveTask);
  const updateTask = useStore((s) => s.updateTask);
  const deleteTask = useStore((s) => s.deleteTask);
  const clearAll = useStore((s) => s.clearAll);
  const exportJson = useStore((s) => s.exportJson);
  const importJson = useStore((s) => s.importJson);

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const colRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeCol, setActiveCol] = useState<ColumnId>("TODO");

  // Server sync: poll every 10s; if server isn't configured, ignore errors.
  useEffect(() => {
    let alive = true;
    const pull = async () => {
      try {
        const serverTasks = await fetchServerTasks();
        if (!alive) return;
        // Merge by id: server wins.
        const merged = new Map<string, any>();
        for (const t of tasks) merged.set(t.id, t);
        for (const st of serverTasks) merged.set(st.id, st);
        const next = Array.from(merged.values());
        // Replace tasks without touching stats.
        // (Zustand setState signature differs across versions; keep it simple.)
        useStore.setState({ tasks: next });
      } catch {
        // no-op
      }
    };
    pull();
    const id = setInterval(pull, 10000);
    return () => {
      alive = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = useMemo(() => tasks.find((t) => t.id === selectedId) ?? null, [tasks, selectedId]);

  const scrollToCol = useCallback((id: ColumnId) => {
    const idx = COLS.findIndex((c) => c.id === id);
    const el = colRefs.current[idx];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    setActiveCol(id);
  }, []);

  // Track active column on mobile swipe (best-effort).
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = scroller.getBoundingClientRect();
        const mid = rect.left + rect.width / 2;

        let bestId: ColumnId | null = null;
        let bestDist = Number.POSITIVE_INFINITY;

        COLS.forEach((c, i) => {
          const el = colRefs.current[i];
          if (!el) return;
          const r = el.getBoundingClientRect();
          const center = r.left + r.width / 2;
          const d = Math.abs(center - mid);
          if (d < bestDist) {
            bestDist = d;
            bestId = c.id;
          }
        });

        if (bestId) setActiveCol(bestId);
      });
    };

    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      scroller.removeEventListener("scroll", onScroll);
    };
  }, []);

  const byCol = useMemo(() => {
    const map: Record<ColumnId, typeof tasks> = { BACKLOG: [], TODO: [], DOING: [], BLOCKED: [], DONE: [] };
    for (const t of tasks) map[t.columnId].push(t);
    for (const k of Object.keys(map) as ColumnId[]) map[k].sort((a, b) => b.updatedAt - a.updatedAt);
    return map;
  }, [tasks]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      const { active, over } = e;
      if (!over) return;
      const taskId = String(active.id);
      const overId = String(over.id);
      if (!overId.startsWith("col:")) return;
      const col = overId.replace("col:", "") as ColumnId;

      const prev = tasks.find((t) => t.id === taskId);
      if (!prev) return;
      if (prev.columnId === col) return;

      moveTask(taskId, col);
      if (col === "DONE") toast.success(`+${prev.xpReward} XP`);

      // Best-effort server update
      fetch("/api/tasks", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: taskId, columnId: col }),
      }).catch(() => {});
    },
    [moveTask, tasks]
  );

  const doExport = () => {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "max-kanban-export.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        importJson(await file.text());
        toast.success("Imported");
      } catch {
        toast.error("Invalid export JSON");
      }
    };
    input.click();
  };

  return (
    <div>
      <Toaster richColors />
      {/* Mobile-first sticky header (project-manager feel) */}
      <div className="sticky top-0 z-10 -mx-6 border-b border-slate-800/60 bg-slate-950/85 px-6 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-0">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-slate-100 md:text-2xl">Max Kanban</h1>
            <p className="mt-0.5 hidden text-sm text-slate-300 md:block">Drag tasks between columns. Server sync enabled when DB is configured.</p>
          </div>
          <div className="flex gap-2">
            <button className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400" onClick={() => setCreateOpen(true)}>
              New
            </button>
            <button className="hidden rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-slate-100 hover:bg-slate-900 md:inline-flex" onClick={doExport}>
              Export
            </button>
            <button className="hidden rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-slate-100 hover:bg-slate-900 md:inline-flex" onClick={doImport}>
              Import
            </button>
            <button className="hidden rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-slate-100 hover:bg-slate-900 md:inline-flex" onClick={clearAll}>
              Clear
            </button>
          </div>
        </div>

        {/* Column "tabs" (tap to jump; swipe to navigate) */}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 md:hidden">
          {COLS.map((c) => (
            <button
              key={c.id}
              onClick={() => scrollToCol(c.id)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                activeCol === c.id
                  ? "border-slate-600 bg-slate-900 text-slate-100"
                  : "border-slate-800 bg-slate-950/30 text-slate-300"
              }`}
            >
              {c.name} <span className="ml-1 text-slate-400">{byCol[c.id].length}</span>
            </button>
          ))}
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        {/* Desktop grid; Mobile swipe (scroll-snap) */}
        <div
          ref={scrollerRef}
          className="mt-4 -mx-6 flex gap-4 overflow-x-auto px-6 pb-2 md:mx-0 md:mt-6 md:grid md:grid-cols-5 md:overflow-visible md:px-0 md:pb-0"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {COLS.map((col, idx) => (
            <div
              key={col.id}
              ref={(el) => {
                colRefs.current[idx] = el;
              }}
              className="rounded-2xl border border-slate-800 bg-slate-950/30 shadow-sm md:w-auto w-[85vw] max-w-[420px] shrink-0"
              style={{ scrollSnapAlign: "start" }}
            >
              <div className={`rounded-t-2xl border-b px-3 py-2 ${col.head} border-l-4 ${col.accent}`}>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">{col.name}</div>
                  <div className={`rounded-full px-2 py-0.5 text-xs ${col.badge}`}>{byCol[col.id].length}</div>
                </div>
              </div>

              <DropColumn id={`col:${col.id}`}>
                <div className="min-h-[280px] space-y-2 rounded-b-2xl bg-slate-950/10 p-3">
                  {byCol[col.id].map((t) => (
                    <DragTask key={t.id} id={t.id}>
                      <div
                        className="cursor-grab rounded-xl border border-slate-800 bg-slate-900/40 p-3 shadow-sm hover:bg-slate-900/70"
                        onDoubleClick={() => setSelectedId(t.id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm font-medium text-slate-100">{t.title}</div>
                          <div className={`rounded-full px-2 py-0.5 text-xs ${priClass(t.priority)}`}>{t.priority}</div>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-slate-300">
                          <span>XP {t.xpReward}</span>
                          {t.tags.length ? <span>{t.tags.slice(0, 2).join(", ")}{t.tags.length > 2 ? "…" : ""}</span> : <span />}
                        </div>
                      </div>
                    </DragTask>
                  ))}
                </div>
              </DropColumn>

              <div className="px-3 pb-3">
                <button
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/30 px-3 py-2 text-sm text-slate-100 hover:bg-slate-900"
                  onClick={() => {
                    (window as any).__MK_DEFAULT_COL__ = col.id;
                    setCreateOpen(true);
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
          onCreate={(vals) => {
            addTask(vals);
            setCreateOpen(false);
            // best-effort server create
            fetch("/api/tasks", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(vals),
            }).catch(() => {});
          }}
        />
      </Modal>

      <Modal open={!!selected} title={selected?.title ?? "Task"} onClose={() => setSelectedId(null)}>
        {selected ? (
          <TaskDetail
            task={selected}
            onChange={(patch) => {
              updateTask(selected.id, patch);
              fetch("/api/tasks", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ id: selected.id, ...patch }),
              }).catch(() => {});
            }}
            onDelete={() => {
              deleteTask(selected.id);
              fetch(`/api/tasks?id=${encodeURIComponent(selected.id)}`, { method: "DELETE" }).catch(() => {});
              setSelectedId(null);
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}

function CreateTaskForm({
  onCreate,
}: {
  onCreate: (t: { title: string; description: string; columnId: ColumnId; priority: Priority; tags: string[]; xpReward: number }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [tags, setTags] = useState("");
  const [xpReward, setXpReward] = useState(25);

  const submit = () => {
    const col = ((window as any).__MK_DEFAULT_COL__ as ColumnId | undefined) ?? "TODO";
    (window as any).__MK_DEFAULT_COL__ = undefined;
    if (!title.trim()) return;
    onCreate({
      title,
      description,
      priority,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      xpReward,
      columnId: col,
    });
    setTitle("");
    setDescription("");
    setPriority("MEDIUM");
    setTags("");
    setXpReward(25);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium">Title</label>
        <input className="mt-1 w-full rounded-lg border px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label className="text-sm font-medium">Description</label>
        <textarea className="mt-1 w-full rounded-lg border px-3 py-2" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid grid-cols-3 gap-3">
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
          <label className="text-sm font-medium">XP reward</label>
          <input type="number" className="mt-1 w-full rounded-lg border px-3 py-2" value={xpReward} onChange={(e) => setXpReward(Number(e.target.value))} min={0} max={500} />
        </div>
        <div>
          <label className="text-sm font-medium">Tags</label>
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
      <p className="text-xs text-slate-500">Tip: double-click a card to edit details.</p>
    </div>
  );
}

function TaskDetail({ task, onChange, onDelete }: { task: any; onChange: (patch: any) => void; onDelete: () => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Status</label>
          <select className="mt-1 w-full rounded-lg border px-3 py-2" value={task.columnId} onChange={(e) => onChange({ columnId: e.target.value as ColumnId })}>
            <option value="BACKLOG">Backlog</option>
            <option value="TODO">To Do</option>
            <option value="DOING">In Progress</option>
            <option value="BLOCKED">Blocked</option>
            <option value="DONE">Done</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Priority</label>
          <select className="mt-1 w-full rounded-lg border px-3 py-2" value={task.priority} onChange={(e) => onChange({ priority: e.target.value as Priority })}>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="URGENT">URGENT</option>
          </select>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">XP reward</label>
        <input type="number" className="mt-1 w-full rounded-lg border px-3 py-2" value={task.xpReward} min={0} max={500} onChange={(e) => onChange({ xpReward: Number(e.target.value) })} />
      </div>

      <div>
        <label className="text-sm font-medium">Description</label>
        <textarea className="mt-1 w-full rounded-lg border px-3 py-2" rows={6} value={task.description} onChange={(e) => onChange({ description: e.target.value })} />
      </div>

      <div>
        <label className="text-sm font-medium">Tags</label>
        <input className="mt-1 w-full rounded-lg border px-3 py-2" value={task.tags.join(", ")} onChange={(e) => onChange({ tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} />
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">Updated {new Date(task.updatedAt).toLocaleString()}</div>
        <button className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-red-700 hover:bg-red-100" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}
