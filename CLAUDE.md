# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**`AGENTS.md` is the exhaustive reference** for per-feature behavior (finanzas fields, workflow de estados, formulas, UI gotchas). This file covers the architecture and the constraints you'd otherwise learn by breaking something. Read AGENTS.md before touching a feature area; keep both in sync when conventions change.

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server on `http://localhost:5173/` (HMR) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the build on `http://localhost:4173/` |

There is **no lint, typecheck, or test setup** — no test runner, no CI. Verification is manual (build + click through the app). A chunk-size >500 kB warning on build comes from the Tiptap bundle and is expected.

`npm run db` / `npm run db:setup` invoke `pocketbase/pocketbase.exe` — **Windows-only, leftovers from local dev**. They do not work on the VPS.

### On this VPS there is no node

`node`/`npm` are not installed on the box. Every build goes through Docker:

```bash
cd /root/scopes
docker compose -f deploy/docker-compose.yml build      # node:22-alpine → nginx, multi-stage
docker compose -f deploy/docker-compose.yml up -d
docker ps -a --filter "label=com.docker.compose.project=scopes"
```

Backend is a separate stack: container `pb-scopes` (`127.0.0.1:8091`), data in `/root/pocketbase/scopes/pb_data`, migrations bind-mounted from `pocketbase/pb_migrations/` in this repo. Public at `https://scopes.jpreyes.cl` via the box's Cloudflare Tunnel → `127.0.0.1:8092`.

Schema changes made in the PocketBase admin UI (`/_/`) land as **new migration files in this repo's working tree** — commit them.

## Architecture

Vite 8 + Vue 3 SFC (`<script setup>`) + Tailwind 4 (`@tailwindcss/vite`, no config file — theme tokens live in `src/style.css`). Tiptap for rich text, `xlsx` for Excel export.

**No router, no Pinia.** `src/stores/presupuesto.js` (~1500 lines) declares a module-level `reactive({...})` singleton `state` plus all logic, and `usePresupuesto()` just returns handles to it. Every component calls `usePresupuesto()` and mutates the same object. Navigation is two state fields:

- `state.activeSection` — sidebar section (`dashboard`, `propuestas`, `clientes`, `catalogo`, `proyectos`, `ingresos`*, `egresos`*, `usuarios`*, `config`). `*` = admin-only.
- `state.activeTab` — within `propuestas` only: `historial` (the **list**, and the section's landing tab), `propuesta`, `gantt`, `costeo`*.

`App.vue` is the shell: auth guard, header, tab bar, a `v-else-if` chain dispatching on `activeSection`, and a **separate `.print-layout` div** rendered independently of the on-screen tabs (see Print below).

### Data layer — PocketBase-first with localStorage fallback

`src/stores/pocketbase.js` is a hand-rolled REST client over `fetch` (no PocketBase SDK): one `api()` helper plus per-collection `get*`/`save*`/`delete*`. Collections: `users`, `clients`, `catalog`, `quotes`, `proyectos`, `ingresos`, `egresos`.

Two behaviors are load-bearing across every saver:

- **id length decides the verb.** `id.length === 15` (PB-generated) → PATCH. Otherwise → POST **with `id` stripped**; PB rejects custom short ids (`validation_min_text_constraint`). Savers return `{ ...record, id: created.id }` and the store adopts that id so subsequent edits PATCH.
- **Never `sort=-created`.** The collections were created by migrations that list only the `id` system field, so they have no `created`/`updated` columns and any sort by a missing field returns 400. All list queries are plain `?perPage=N`; sorting happens client-side in the store.

`dbLogin()` runs on mount (after auth) and, on success, sets `state.dbConnected = true` then runs `migrateLocalToPB()`, `dedupeQuotes()` and `migrarEstadosViejos()`. Without a session the app stays in localStorage mode. LocalStorage keys: `presto_{quoteNumber}` per quote, `presto_list`, `presto_counter`, `presto_clients`, `presto_catalog`, `presto_proyectos`, `presto_ingresos`, `presto_egresos`.

**PB silently drops fields that aren't in the collection schema.** Adding a field to `state` + `collectData()` without a matching migration produces a save that appears to work and loses the data.

### Auth and roles

- Auth is the **`users` collection**, never `_superusers`. Vite bakes env vars into the public bundle — a superuser login in the frontend exposed the whole database once already. `dbLogin()` reuses the logged-in user's token via `refreshUser()` (`auth-refresh`); every collection rule is `@request.auth.id != ""`.
- Token + user record live in `sessionStorage` (`pb_user_token`, `pb_user`). `restoreUserToken()` on mount decides between `<LoginPage />` and the app.
- No public signup. Admins create accounts in the Usuarios section (`users.createRule = '@request.auth.role = "admin"'`).
- `users.role` = `admin | user`; `computed.isAdmin` gates Ingresos, Egresos, Usuarios, the Costeo Interno tab and the Dashboard's financial KPIs. **The UI gating is cosmetic — the real barrier is the collection rules.** `users.updateRule` blocks self-promotion.
- Admin accounts are seeded by `deploy/seed-admins.sh` reading `deploy/admins.env` (chmod 600, gitignored — also holds the panel superuser password).

### Confidentiality boundary

**Costeo Interno never reaches print/PDF or a client-facing surface.** It is admin-only in the UI and deliberately absent from `.print-layout`.

### Print and export

`.print-layout` in `App.vue` is the document: cover page plus inline `v-html` of the sections and `<PrintGantt />`. It deliberately does **not** reuse `<PropuestaTab />`, which would instantiate a second set of Tiptap editors. Which blocks appear is driven by `state.printSections` (section ids plus the `economica` and `gantt` keys).

`src/utils/exportPropuesta.js` (dynamically imported from `PropuestaTab`) produces the actual deliverables and replaced `window.print()`:

- **PDF** — adds `export-mode` to `.print-layout` (moves it off-screen at A4 width, 794 px), captures it with `html2canvas-pro` + `jsPDF`, and paginates by cutting at the boundaries of `.print-content`'s top-level blocks. The cover is full-bleed. Output is an image: faithful to the design, text not selectable.
- **Word** — rebuilds the document with `docx` (paragraphs, lists, tables, embedded images; Gantt as a grid of shaded cells, falling back to a date table when `ganttSpan > 40`).

A proposal can be exported in **any** state, but when `computed.aprobadaInternamente` is false the file gets a diagonal **"SIN APROBACIÓN INTERNA"** watermark — text stamped over the composed pages in the PDF, and a canvas-generated image floated `behindDocument` in the Word header (how Word itself does watermarks). That approval rule lives **only in the store**, and both the UI and the exporter read it from there. In both formats the font size is computed by measuring the string: at a fixed size the rotated text runs off the page.

Two traps here:

- **The document's visual CSS lives outside `@media print`**, scoped under `.print-layout`. The PDF is captured on screen and never goes through the print engine, so a rule left inside `@media print` silently won't apply to the export.
- **`html2canvas-pro`, not `html2canvas`** — Tailwind 4's default palette emits `oklch()` colors, which the original parser throws on.

`@media print` now hides `.app-shell` (the whole app) so Ctrl+P doesn't put the header and sidebar on paper.

## Conventions worth knowing before editing

- **Computed access from components:** destructure `computed` from `usePresupuesto()` and read as `computed.finKpis.value.recibido`. Assigning a computed to a local `const` and reading `.prop` breaks template bindings (no auto-unwrap on member access).
- **Add/edit forms** (`Clientes`, `Catalogo`, `ProyectosTab`): `editingId = ref(null)`, `openAdd()` sets it to the sentinel `'__new__'` — not `null`, since the form is `v-if="editingId !== null"` and would never open.
- **RichTextEditor** is keyed `'rte-' + s.id + '-' + state.loadVersion`; bump `state.loadVersion` to force re-creation after loading a budget. Images are base64 data URIs (max 2 MB) inside the section HTML, so a quote's localStorage key can approach the ~5 MB limit.
- **Costeo groups hold references**, not items: `costeoGroups[].itemKeys[]` are integer `_key`s into items that live in `costeoCategories`. Category→group drag = copy, group→group = move. Call `recalcSales()` after any cost or margin-mode change.
- **Margin modes:** `'venta'` → `sale = cost × (1 + markup/100)`; `'utilidad'` → `sale = cost / (1 − markup/100)`.
- **Quote number** `CT-PS-{NNN}-{YYYY}`, counter in `localStorage presto_counter`. `saveBudget()` = `persistBudget()` + `generateQuoteNumber()`; state transitions call `persistBudget()` only, so they don't burn a number.
- **Currency formatting:** `$` → 0 decimals, `.` thousands separator; `UF` / `US$` / `€` → 2 decimals. `fmt()` uses `state.currency`; `fmtMoney(amount, currency)` and `fmtMulti(map)` handle the per-currency maps the finanzas KPIs produce.
- **Proposal status select** in `PropuestaTab` uses `:value` + `@change` → `onStatusChange()`, **not `v-model`** — reverting the reactive value inside a watch left the DOM desynced from `vModelSelect`.
- `v-if` and `v-for` never on the same element (wrap in `<template v-for>`). Use `overflow-clip`, not `overflow-hidden`, on the CosteoInterno outer container — `hidden` breaks the sticky panel.
- **Never insert non-ASCII data into PB from PowerShell.** `Invoke-RestMethod` on PS 5.1 sends the JSON body as Windows-1252 and corrupts tildes/ñ (stored as U+FFFD). Seed from the browser (fetch is UTF-8) or with a UTF-8 `byte[]` body.

## Repo layout notes

- `presupuesto-refine/` — an abandoned/parallel React + Refine rewrite with its own `package.json` and a bundled `pocketbase.exe`. **Not** part of the deployed app; don't wire changes into it.
- `referencia/` — client Word/Excel source documents the proposal format is modeled on.
- Root-level `*.png` and `page-snapshot*.md` are captured QA artifacts, not source.
