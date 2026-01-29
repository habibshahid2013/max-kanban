"use client";

import { useDroppable } from "@dnd-kit/core";

export function DropColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={isOver ? "ring-2 ring-indigo-400" : ""}>
      {children}
    </div>
  );
}
