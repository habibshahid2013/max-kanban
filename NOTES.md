# Max Kanban — Working Notes (for Hassan)

## How I’ll work going forward (your requested process)
For each change-set:
1) Draft plan + options
2) Run it through a “team review” step:
   - ChatGPT-style critique (fast, pragmatic)
   - Claude-style critique (UX, product, edge cases)
3) Write the consolidated output here (this file)
4) Implement + deploy
5) Append a short changelog + what to test

> Note: I can’t literally call OpenAI ChatGPT web or Anthropic Claude web from inside this runtime unless we wire those APIs into a tool. Instead I’ll emulate the ‘team review’ step by spawning isolated sub-agent reviews and capturing their critiques here, then acting on them.

## Current status (live)
- App: https://max-kanban.vercel.app
- Repo: https://github.com/habibshahid2013/max-kanban
- Kanban v2: DnD, XP/level/streak, improved contrast.
- Server endpoints shipped:
  - /api/tasks (CRUD)
  - /api/inbox (NLP → task)

## Immediate priorities
1) Make persistence real (DB-backed), not just local.
2) Add search + quick-add.
3) Add per-task activity log (“Max updates”).
4) Build a reliable “talk to Max → task appears on board” loop.

## Team review: what we should fix next (draft)
- Current server sync is polling + best-effort writes; needs a real DB connection and a proper sync strategy.
- Auth is removed; single-user token auth for the API should be enabled when DB is live.
- UI needs:
  - a visible drag handle (not whole-card drag)
  - clearer tap targets on mobile
  - reduce visual noise (borders/shadows) while keeping contrast

## What I’m implementing next (no approval needed)
- Add a search box + filter chips (status/priority/tag)
- Add “Quick add” input: type a sentence, it parses tags/priority/status/xp and creates a card
- Add activity log (client-side first; DB-backed once DB is connected)

## What you need to do once (DB)
To enable DB-backed tasks:
- Attach a Postgres/Neon DB to the Vercel project max-kanban and ensure env vars are present.

Once that’s done, /api/tasks will persist and the board will become truly shared across devices.
