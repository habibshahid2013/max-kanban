export type ColumnId = "BACKLOG" | "TODO" | "DOING" | "BLOCKED" | "DONE";

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type Card = {
  id: string;
  title: string;
  description: string;
  columnId: ColumnId;
  priority: Priority;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  dueAt?: number;
};

export type BoardState = {
  version: 1;
  columns: { id: ColumnId; name: string; order: number }[];
  cards: Card[];
};
