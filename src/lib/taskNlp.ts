import type { ColumnId, Priority } from "./kanbanTypes";

export type ParsedTask = {
  title: string;
  columnId: ColumnId;
  priority: Priority;
  tags: string[];
  xpReward: number;
};

const STATUS_ALIASES: Array<[RegExp, ColumnId]> = [
  [/\b(backlog)\b/i, "BACKLOG"],
  [/\b(todo|to\s*do)\b/i, "TODO"],
  [/\b(doing|in\s*progress|progress)\b/i, "DOING"],
  [/\b(blocked|stuck)\b/i, "BLOCKED"],
  [/\b(done|complete|completed)\b/i, "DONE"],
];

const PRI_ALIASES: Array<[RegExp, Priority]> = [
  [/\b(urgent|p0)\b/i, "URGENT"],
  [/\b(high|p1)\b/i, "HIGH"],
  [/\b(med(ium)?|p2)\b/i, "MEDIUM"],
  [/\b(low|p3)\b/i, "LOW"],
];

export function parseTaskText(text: string): ParsedTask {
  const raw = text.trim();

  // tags via #tag
  const tags = Array.from(raw.matchAll(/#([a-z0-9_-]+)/gi)).map((m) => m[1].toLowerCase());

  // xp via "xp 50" or "+50xp"
  const xpMatch = raw.match(/(?:\bxp\b\s*[:=]?\s*(\d+))|(?:\+(\d+)\s*xp\b)/i);
  const xpReward = Math.max(0, Math.min(500, Number(xpMatch?.[1] ?? xpMatch?.[2] ?? 25) || 25));

  let columnId: ColumnId = "TODO";
  for (const [re, col] of STATUS_ALIASES) {
    if (re.test(raw)) {
      columnId = col;
      break;
    }
  }

  let priority: Priority = "MEDIUM";
  for (const [re, pri] of PRI_ALIASES) {
    if (re.test(raw)) {
      priority = pri;
      break;
    }
  }

  // Title heuristic: strip leading command words
  const cleaned = raw
    .replace(/^\s*(new\s+task|task|add\s+task|create\s+task)\s*[:\-]?\s*/i, "")
    .replace(/\s+#([a-z0-9_-]+)/gi, "")
    .replace(/\s+(xp\s*[:=]?\s*\d+|\+\d+\s*xp)\b/gi, "")
    .trim();

  const title = cleaned.length ? cleaned : raw.slice(0, 120);

  return { title, columnId, priority, tags, xpReward };
}
