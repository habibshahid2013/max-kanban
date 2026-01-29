"use client";

import { useDroppable } from "@dnd-kit/core";

export function DropColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={
        isOver
          ? "rounded-xl ring-2 ring-slate-900/40 ring-offset-2 ring-offset-white"
          : "rounded-xl"
      }
    >
      {children}
    </div>
  );
}
