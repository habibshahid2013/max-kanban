"use client";

import { useDraggable } from "@dnd-kit/core";

export function DragTask({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });

  const style: React.CSSProperties | undefined = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-70" : ""} {...listeners} {...attributes}>
      {children}
    </div>
  );
}
