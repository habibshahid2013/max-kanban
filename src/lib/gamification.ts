export type Stats = {
  xp: number;
  level: number;
  streak: number;
  lastDoneDay: string | null; // YYYY-MM-DD
};

export function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function levelForXp(xp: number): number {
  // Simple curve: level 1 at 0xp, then +100xp per level.
  return Math.max(1, Math.floor(xp / 100) + 1);
}

export function xpToNextLevel(xp: number): { level: number; into: number; needed: number } {
  const level = levelForXp(xp);
  const base = (level - 1) * 100;
  const into = xp - base;
  const needed = 100;
  return { level, into, needed };
}

export function applyDone(stats: Stats, now = new Date()): Stats {
  const today = dayKey(now);
  const nextXp = stats.xp;

  // streak logic
  let streak = stats.streak;
  if (stats.lastDoneDay === today) {
    // already counted today
  } else if (stats.lastDoneDay) {
    const prev = new Date(stats.lastDoneDay + "T00:00:00Z");
    const diffDays = Math.floor((Date.parse(today + "T00:00:00Z") - prev.getTime()) / 86400000);
    if (diffDays === 1) streak += 1;
    else streak = 1;
  } else {
    streak = 1;
  }

  const xp = nextXp;
  const level = levelForXp(xp);
  return { xp, level, streak, lastDoneDay: today };
}
