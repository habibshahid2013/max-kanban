# Max Kanban — Working Notes (for Hassan)

## Operating workflow (how Max works day-to-day)
**Goal:** fast execution, clear communication, minimal token waste.

**For every task (default):**
1) **Intake**: clarify objective, constraints, definition of done (DoD) *only if required*.
2) **Team review** (2 passes):
   - Pass A (ChatGPT-style): blunt, pragmatic, quick wins.
   - Pass B (Claude-style): UX/product, edge cases, coherence.
3) **Synthesize**: write decisions + checklist into this NOTES.md.
4) **Implement**: ship in small slices; each slice ends with a deploy.
5) **Verify**: quick smoke test + update task status.
6) **Update board**: move card + append brief progress note.

## Kanban integration rules (single-user)
- If Hassan creates a task, Max auto-starts the highest priority TODO/BACKLOG and moves it to **DOING**.
- Preferred explicit assignment still supported: title starts with `Max:` or tags include `max/ai`.

## New backlog (imported from your “Claude Code Workflow System” plan)
I added the following top-priority tasks to the board (lean starting point):
- Define response formatting rules (WhatsApp-first)
- Build AI capability matrix
- Define task routing logic (multi-AI orchestration)
- Calendar audit workflow
- Email triage workflow
- Idea-to-spec workflow
- Convert remaining epics/tasks into Kanban items

## UI/UX direction (condensed)
- Reduce visual noise: flatter cards, consistent typography/spacing.
- Dedicated drag handle + non-drag move action for mobile.
- Instant capture input + `/` search.
- Keep gamification compact (ambient HUD).
