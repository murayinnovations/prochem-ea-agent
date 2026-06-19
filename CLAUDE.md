# Claude Code Conventions

Read `PROJECT.md` first for architecture. This file is for code style and workflow.

## Stack rules

- **TypeScript everywhere.** No `.js` files except config.
- **Next.js App Router**, server components by default. Add `"use client"` only when needed (state, effects, chart libs).
- **Tailwind only** for styling. No CSS modules, no styled-components.
- **shadcn/ui** for primitives. Install components with `npx shadcn@latest add <name>`, don't hand-roll.
- **Recharts** for all visualizations. Match the style in the reference screenshots (rounded bars, subtle grids, KES formatting).
- **Supabase JS client** for all DB access. Use the typed client (`Database` type generated via `supabase gen types`).
- **Zod** for all external input validation (API routes, agent tool params, SAP responses).

## File layout

```
app/
  (dashboard)/
    commercial/        # CRT-style pages
    treasury/          # AR, FX, debtors
    layout.tsx
  api/
    chat/route.ts      # streaming chat endpoint
    briefing/route.ts  # on-demand briefing
    sync/route.ts      # manual sync trigger (admin only)
  page.tsx             # home / overview
components/
  ui/                  # shadcn primitives
  charts/              # Recharts wrappers
  kpi-card.tsx
  chat/                # chat UI
lib/
  supabase/            # client + server helpers
  sap/                 # SAP B1 client
    client.ts
    mock.ts
    types.ts
  agent/
    tools.ts           # tool definitions + handlers
    schemas.ts         # zod schemas for tool params
    prompts.ts         # system prompts
    run.ts             # main agent loop
  formatters.ts        # KES, percentages, dates
supabase/
  migrations/
  functions/           # edge functions (incl. sync worker)
```

## Conventions

- **Money:** always store in minor units (cents) as `bigint`, format at display time. `formatKES(amount)` → "KES 11.7B".
- **Dates:** ISO strings in DB, format at display. Use date-fns.
- **No `any`.** If you need an escape hatch, use `unknown` and narrow with zod.
- **API routes return** `{ data, error }` shape consistently.
- **Errors:** throw in lib code, catch at route boundary, return structured error.

## Agent tools

- Each tool lives in `lib/agent/tools.ts` as `{ name, description, input_schema, handler }`.
- `input_schema` is JSON Schema (for Anthropic API) generated from a zod schema (single source of truth).
- Handlers return JSON-serializable objects. No streaming, no side effects.
- If a tool needs to return >50 rows, paginate or summarize. Models choke on huge tool results.

## Testing

- Vitest for unit tests on formatters, agent tools, SAP parsers.
- Don't test UI exhaustively. Test the agent loop with mocked Anthropic + mocked tools.

## Git

- One branch per feature. PR descriptions reference the section of `PROJECT.md` they implement.
- Conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`.

## When in doubt

- Match the visual style of the reference screenshots (Bidco CRT + Treasury).
- Prefer fewer dependencies. If shadcn or Recharts can do it, don't add a new lib.
- Server-side rendering for dashboards (fast first paint, fresh data). Client components only for interactivity.
