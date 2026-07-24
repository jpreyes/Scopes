# AGENTS.md

## Stack
- **Vite 8 + Vue 3** (SFC `<script setup>`) + **Tailwind CSS 4** (via `@tailwindcss/vite`)
- **Tiptap** (`@tiptap/vue-3` + starter-kit) for rich text
- `xlsx` for Excel export, no router (tab-based via `state.activeTab`)
- `sortablejs` / `vue-draggable-plus` in deps but **unused** — drag uses native HTML5 API

## Commands
| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server at `http://localhost:5173/` (HMR) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview built app at `http://localhost:4173/` |
- No lint, typecheck, or test commands exist.
- Build may warn chunk size >500 kB (Tiptap bundle) — harmless.

## Project Structure
- `src/App.vue` — shell, tabs, print layout, print handler
- `src/stores/presupuesto.js` — single `reactive({...})` object `state`, all logic in `usePresupuesto()` composable (no Pinia/Vuex)
- `src/components/` — `CoverPage` (print-only), `PropuestaTab`, `GanttTab`, `CosteoInterno`, `HistorialTab`, `RichTextEditor` (Tiptap), `PrintGantt`
- `presupuesto-refine/` — separate React/Refine/PocketBase rewrite (WIP, TypeScript, CommonJS `type`)
- `public/images/` — `image1.png` (logo), `image2.png` (cover bg)
- Stale Vite template leftovers: `HelloWorld.vue`, `src/assets/`

## Key Conventions
- **Rich text** sections store HTML in `state.propuestaSections[].content`. Images as base64 data URIs (max 2 MB). Rendered with `v-html` in print. RichTextEditor bound as `:key="'rte-' + s.id + '-' + state.loadVersion"` — increment `loadVersion` to force re-create.
- **Print layout** uses a separate `.print-layout` div (hidden on screen) with `<CoverPage />` (`page-break-after: always`) and inline `v-html` + `<PrintGantt />` — NOT via `<PropuestaTab />` (avoids duplicate Tiptap instances).
- **Print sections** toggled via `state.printSections` checkboxes. Uses `economica` and `gantt` keys alongside section IDs.
- **Gantt chart**: unit configurable (`hour`/`day`/`week`/`month`/`year`). Month headers use real calendar day counts.
- **CosteoInterno is confidential** — never on print/PDF. Margin mode via `costeoMarginMode` (`'venta'` / `'utilidad'`).
- **Items in groups**: referenced by `_key` integer in `costeoGroups[].itemKeys[]`. Items live in categories; groups hold references only.
- **Drag & drop**: native HTML5. Category→group = copy (item stays). Group→group = move (removed from source).
- **Quote number**: `CT-PS-{NNN}-{YYYY}`, auto-increment via `localStorage presto_counter`.
- **Currency**: `$` → 0 decimals with `.` thousands sep; `UF`/`US$`/`€` → 2 decimals.
- **Persistence**: `localStorage` keys `presto_{quoteNumber}` and `presto_list`. `saveBudget()` auto-increments counter. `loadBudgetByNum()` matches saved items by category `id`.
- **Layout CosteoInterno**: `flex-col md:flex-row` with left panel scrollable (`md:overflow-y-auto`), right panel `md:max-h-[calc(100vh-13rem)]`.

## Margin Formulas
| Mode | Formula |
|------|---------|
| `'venta'` | `sale = cost × (1 + markup/100)` |
| `'utilidad'` | `sale = cost / (1 − markup/100)` |

Always call `recalcSales()` after changing item cost or margin mode.

## Gotchas
- `costeoCategories` structure fixed by ID. New categories get string IDs (`uid() + ''`).
- No `costeoMarginMode` in old saved budgets — defaults to `'venta'`.
- No `ganttUnit`/`ganttSpan` in old saved budgets — defaults to `'day'` / 14.
- Rich text stores base64 images → localStorage ~5 MB limit per key.
- `v-if` and `v-for` must never be on same element — wrap in `<template v-for>`.
- `overflow-clip` on outer container (NOT `overflow-hidden`, breaks sticky in CosteoInterno).
- Build output `dist/` includes `images/` copied from `public/images/`.
