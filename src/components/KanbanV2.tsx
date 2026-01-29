"use client";

import { useCallback, useMemo, useState } from "react";
import { DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { toast, Toaster } from "sonner";

import type { ColumnId, Priority } from "@/lib/kanbanTypes";
import { useStore } from "@/lib/store";
import { Modal } from "@/components/Modal";
import { DragTask } from "@/components/DragTask";
import { DropColumn } from "@/components/DropColumn";

const COLS: { id: ColumnId; name: string; head: string; accent: string }[] = [
  {
    id: "BACKLOG",
    name: "Backlog",
    head: "bg-slate-100 text-slate-950 border-slate-200",
    accent: "border-l-slate-500",
  },
  {
    id: "TODO",
    name: "To Do",
    head: "bg-amber-100 text-amber-950 border-amber-200",
    accent: "border-l-amber-500",
  },
  {
    id: "DOING",
    name: "In Progress",
    head: "bg-blue-100 text-blue-950 border-blue-200",
    accent: "border-l-blue-500",
  },
  {
    id: "BLOCKED",
    name: "Blocked",
    head: "bg-red-100 text-red-950 border-red-200",
    accent: "border-l-red-500",
  },
  {
    id: "DONE",
    name: "Done",
    head: "bg-emerald-100 text-emerald-950 border-emerald-200",
    accent: "border-l-emerald-600",
  },
];

function priClass(p: Priority) {
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

  const selected = useMemo(() => tasks.find((t) => t.id === selectedId) ?? null, [tasks, selectedId]);

  const byCol = useMemo(() => {
    const map: Record<ColumnId, typeof tasks> = {
      BACKLOG: [],
      TODO: [],
      DOING: [],
      BLOCKED: [],
      DONE: [],
    };
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Max Kanban</h1>
          <p className="mt-1 text-slate-600">Drag tasks between columns. Stored locally (for now).</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800" onClick={() => setCreateOpen(true)}>
            New task
          </button>
          <button className="rounded-lg border px-3 py-2 hover:bg-slate-50" onClick={doExport}>
            Export
          </button>
          <button className="rounded-lg border px-3 py-2 hover:bg-slate-50" onClick={doImport}>
            Import
          </button>
          <button className="rounded-lg border px-3 py-2 hover:bg-slate-50" onClick={clearAll}>
            Clear
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className="mt-6 grid gap-4 md:grid-cols-5">
          {COLS.map((col) => (
            <div key={col.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div
                className={`rounded-t-2xl border-b px-3 py-2 ${col.head} border-l-4 ${col.accent}`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">{col.name}</div>
                  <div className="rounded-full border border-black/10 bg-white px-2 py-0.5 text-xs text-slate-900">
                    {byCol[col.id].length}
                  </div>
                </div>
              </div>

              <DropColumn id={`col:${col.id}`}>
                <div className="min-h-[280px] space-y-2 rounded-b-2xl bg-white p-3">
                  {byCol[col.id].map((t) => (
                    <DragTask key={t.id} id={t.id}>
                      <div
                        className="cursor-grab rounded-xl border border-slate-300 bg-white p-3 shadow-sm hover:bg-slate-50 hover:shadow"
                        onDoubleClick={() => setSelectedId(t.id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm font-medium text-slate-900">{t.title}</div>
                          <div className={`rounded-full px-2 py-0.5 text-xs ${priClass(t.priority)}`}>{t.priority}</div>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
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
                  className="w-full rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
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
          }}
        />
      </Modal>

      <Modal open={!!selected} title={selected?.title ?? "Task"} onClose={() => setSelectedId(null)}>
        {selected ? (
          <TaskDetail
            task={selected}
            onChange={(patch) => updateTask(selected.id, patch)}
            onDelete={() => {
              deleteTask(selected.id);
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
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
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
          <input
            type="number"
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={xpReward}
            onChange={(e) => setXpReward(Number(e.target.value))}
            min={0}
            max={500}
          />
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

function TaskDetail({
  task,
  onChange,
  onDelete,
}: {
  task: { title: string; description: string; tags: string[]; priority: Priority; columnId: ColumnId; xpReward: number; updatedAt: number };
  onChange: (patch: any) => void;
  onDelete: () => void;
}) {
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
