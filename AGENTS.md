# AGENTS.md

## Stack
- **Vite 8 + Vue 3** (SFC `<script setup>`) + **Tailwind CSS 4** (via `@tailwindcss/vite`)
- **Tiptap** (`@tiptap/vue-3` + starter-kit) for rich text
- **PocketBase** (`pocketbase/`) as backend via raw `fetch()` (no SDK), hybrid with localStorage fallback
- `xlsx` for Excel export, no router (tab-based via `state.activeTab`)
- Auth via PocketBase `users` collection (not `_superusers`)

## Commands
| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server at `http://localhost:5173/` (HMR) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview built app at `http://localhost:4173/` |
| `npm run db` | Start PocketBase at `http://localhost:8090` |
| `npm run db:setup` | Create admin superuser (`admin@scopes.cl`) |
- No lint, typecheck, or test commands exist.
- Build may warn chunk size >500 kB (Tiptap bundle) — harmless.

## Project Structure
- `src/App.vue` — shell, auth guard, tabs, print layout (`.print-layout`)
- `src/utils/exportPropuesta.js` — exportación a PDF y Word (carga diferida)
- `src/stores/presupuesto.js` — single `reactive({...})` object `state`, all logic in `usePresupuesto()` composable (no Pinia/Vuex)
- `src/stores/pocketbase.js` — PocketBase REST client (fetch-based), user auth + admin auth
- `src/components/` — `LoginPage`, `Dashboard`, `Sidebar`, `CoverPage`, `ConfigTab` (profile), `PropuestaTab`, `GanttTab`, `CosteoInterno`, `HistorialTab`, `Clientes`, `Catalogo`, `ProyectosTab`, `IngresosTab`, `EgresosTab`, `RichTextEditor`, `PrintGantt`
- `pocketbase/` — PocketBase binary + `pb_data/` + `pb_migrations/`
- `presupuesto-refine/` — separate React/Refine/PocketBase rewrite (WIP)
- `public/images/` — `image1.png` (logo), `image2.png` (cover bg)

## Auth Flow
- On load: `restoreUserToken()` checks `sessionStorage('pb_user_token')`. If valid, show app. If not, show `<LoginPage />`.
- Login: `pb.loginUser(email, password)` → `POST /api/collections/users/auth-with-password`. Token + user stored in sessionStorage. `App.vue` then runs `dbLogin().then(loadAll)`.
- **No hay registro público.** Las cuentas las crea un admin desde la sección Usuarios (`users.createRule = '@request.auth.role = "admin"'`).
- Logout: `pb.logoutUser()` clears sessionStorage, sets `state.user = null` y `dbConnected = false`.
- **NUNCA volver a autenticar `_superusers` desde el frontend.** Vite hornea las env vars en el bundle público: `VITE_PB_EMAIL`/`VITE_PB_PASSWORD` exponían la base entera a cualquiera que abriera la web. `dbLogin()` usa el token del usuario logueado (`pb.refreshUser()` → `auth-refresh`) y todas las colecciones tienen reglas `@request.auth.id != ""`.

## Roles
- `users.role` = `'admin' | 'user'` (migración `1789000000_users_role_cargo.js`, junto con `cargo`).
- `computed.isAdmin` en el store. Solo admins ven: Ingresos, Egresos, Usuarios y el tab **Costeo Interno**; las KPI financieras del Dashboard también quedan ocultas.
- `updateRule` de `users` impide auto-promoverse: `(@request.auth.id = id && @request.body.role:isset = false) || @request.auth.role = "admin"`.
- El gating de la UI es cosmético; la barrera real son las reglas de las colecciones.

## Despliegue
- `deploy/` — build multi-stage (node → nginx) + `docker-compose.yml` (proyecto `scopes`, `127.0.0.1:8092`). nginx sirve la SPA y hace de proxy de `/api/` y `/_/` hacia `pb-scopes:8090` por la red docker `scopesnet`, así que todo va al mismo origen y no hay CORS.
- PocketBase de producción: stack `pocketbase` del VPS, servicio `scopes` (`127.0.0.1:8091`), datos en `/root/pocketbase/scopes/pb_data`, migraciones montadas desde este repo.
- Público en `https://scopes.jpreyes.cl` vía Cloudflare Tunnel.
- `deploy/seed-admins.sh` + `deploy/admins.env` (gitignored) crean/reaseguran las cuentas admin.
- El seed demo `admin@scopes.cl/admin123` solo corre con `SCOPES_SEED_DEMO=1`.

## Data Layer
- **PocketBase-first** with localStorage fallback for all CRUD (clients, catalog, quotes, proyectos, ingresos, egresos).
- `dbLogin()` on mount tries admin auto-login. On success:
  - Sets `state.dbConnected = true`
  - `migrateLocalToPB()` syncs localStorage-only records to PocketBase
- `loadBudgetByNum()` queries PocketBase first (if connected), falls back to `presto_{qn}` localStorage key.
- **DO NOT use `sort=-created`** in PB queries — collections created by migration have NO `created`/`updated` system fields, so PB returns 400. Sort client-side instead (see Gotchas).

## Finanzas (proyectos / ingresos / egresos)
- Collections: `proyectos`, `ingresos`, `egresos` (rules `@request.auth.id != ""`). LocalStorage keys: `presto_proyectos`, `presto_ingresos`, `presto_egresos`.
- **Proyectos**: `nombre`, `quoteNumber` (propuesta vinculada), `clientName`, `status` (`activo`/`en_pausa`/`finalizado`/`cancelado`), `startDate`, `endDate`, `awardAmount`, `currency`, `responsable`, `notes`.
- **Ingresos**: `fecha`, `proyectoId`+`proyecto` (denormalized name), `concepto`, `monto`, `moneda`, `estado` (`programado`/`recibido`), `metodo`, `comprobante`, `nota`.
- **Egresos**: same + `categoria` (`RHH`, `Materiales`, `Equipos`, `Servicios`, `Traslados y Viáticos`, `Otros`), `beneficiario`.
- `finKpis` computed (inside `computed` object) → `{ recibido, programado, pagado, pendiente, utilidad, proyectosActivos, proyectosTotal }` — all maps grouped **per currency**.
- Formatting: `fmtMoney(amount, currency)` for single values; `fmtMulti(map)` joins per-currency sums with ` · `.
- `crearProyectoDesdePropuesta(qn)` creates a project from an adjudicated quote (Historial "→ Proyecto" button), autofilling client/award/currency.
- `proyectoStats(proyectoId)` → `{ recibido, pagado }` per-currency maps for the project card.
- Estado toggles (Recibido/Pagado) save the whole record via `saveIngreso/saveEgreso` (PATCH).
- Excel exports: `exportIngresosExcel()`, `exportEgresosExcel()`.

## Key Conventions
- **Rich text** sections store HTML in `state.propuestaSections[].content`. Images as base64 data URIs (max 2 MB). Rendered with `v-html` in print. RichTextEditor bound as `:key="'rte-' + s.id + '-' + state.loadVersion"` — increment `loadVersion` to force re-create.
- **Print layout** uses a separate `.print-layout` div (hidden on screen) with `<CoverPage />` (`page-break-after: always`) and inline `v-html` + `<PrintGantt />` — NOT via `<PropuestaTab />` (avoids duplicate Tiptap instances).
- **Exportación PDF / Word** (`src/utils/exportPropuesta.js`, import dinámico desde `PropuestaTab`): reemplaza a `window.print()`, que imprimía la página completa. **PDF** = se le añade la clase `export-mode` al `.print-layout` (lo saca fuera de pantalla con ancho A4 = 794 px) y se fotografía con `html2canvas-pro` + `jsPDF`; se pagina cortando por el borde de los bloques de primer nivel de `.print-content`, la portada va a sangre. **Word** = se reconstruye el documento con `docx` (párrafos, listas, tablas, imágenes reales, Gantt como grilla de celdas pintadas; si `ganttSpan > 40` cae a una tabla de fechas). Ambas respetan `printSections` y **excluyen el Costeo Interno**.
- **Marca de agua "SIN APROBACIÓN INTERNA"**: se puede descargar en cualquier estado, pero si `computed.aprobadaInternamente` es falso el archivo sale marcado. La regla vive **solo en el store** (`aprobadaInternamente` = 2 votos distintos **o** estado en `aprobada`/`enviada`/`rectificacion`/`adjudicada`, para las propuestas viejas sin votos); la UI y el módulo de exportación la leen de ahí. En PDF es texto girado estampado sobre las páginas ya compuestas (`estamparMarcaDeAgua`); en Word es una imagen generada en un `<canvas>` e incrustada como imagen flotante `behindDocument` en el encabezado, que es como Word hace las marcas de agua de verdad. En ambos casos **el cuerpo del texto se calcula midiéndolo**: a tamaño fijo el texto girado se sale de la hoja y queda cortado.
- **Los estilos del documento viven fuera de `@media print`** (scoped bajo `.print-layout`): la captura del PDF ocurre en pantalla y nunca pasa por el motor de impresión, así que si una regla queda dentro de `@media print` no se aplica al exportar.
- **`html2canvas-pro`, no `html2canvas`**: la paleta por defecto de Tailwind 4 emite colores `oklch()` y el original falla al parsearlos.
- En `@media print` se oculta `.app-shell` (la app entera). Antes solo había marcas `no-print` sueltas y la cabecera y el menú lateral salían impresos.
- **Print sections** toggled via `state.printSections` checkboxes. Uses `economica` and `gantt` keys alongside section IDs.
- **Gantt chart**: unit configurable (`hour`/`day`/`week`/`month`/`year`). Month headers use real calendar day counts.
- **CosteoInterno is confidential** — never on print/PDF. Margin mode via `costeoMarginMode` (`'venta'` / `'utilidad'`).
- **Items in groups**: referenced by `_key` integer in `costeoGroups[].itemKeys[]`. Items live in categories; groups hold references only.
- **Drag & drop**: native HTML5. Category→group = copy (item stays). Group→group = move (removed from source).
- **Quote number**: `CT-PS-{NNN}-{YYYY}`, auto-increment via `localStorage presto_counter`.
- **Currency**: `$` → 0 decimals with `.` thousands sep; `UF`/`US$`/`€` → 2 decimals.
- **Persistence**: `localStorage` keys `presto_{quoteNumber}` and `presto_list`. `saveBudget()` auto-increments counter. `loadBudgetByNum()` matches saved items by category `id`.
- **Propuestas tabs**: `state.tabs` = Documento (`propuesta`), Carta Gantt (`gantt`), Costeo Interno (`costeo`). **Al entrar a la sección Propuestas el Sidebar abre `activeTab = 'historial'`**, que es la LISTA de propuestas (`HistorialTab` con título "Propuestas", botones Editar/Eliminar/→ Proyecto y "+ Nueva propuesta" que hace `resetBudget()` + `activeTab = 'propuesta'`). En el formulario, la barra de tabs muestra un botón "← Lista" que vuelve a `activeTab = 'historial'`. El botón "Nueva" del header hace lo mismo. No existe sección ni tab "Historial" en el menú (eliminado — la lista ES la entrada de Propuestas).
- **Layout CosteoInterno**: `flex-col md:flex-row` with left panel scrollable (`md:overflow-y-auto`), right panel `md:max-h-[calc(100vh-13rem)]`.
- **ConfigTab** is user profile (name, email, cargo). Not company info or PB connection settings.
- **resetBudget()** clears proposal form (generates new quote number), preserves company info.

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
- `costeoCategories` default is `[]` (no default items). `ganttTasks` default is `[]`.
- `subheader` default is `''` (no default text).
- `resetBudget()` preserves company info from previous state.
- `seedSampleData()` saves to both localStorage and PocketBase (if connected).
- `registerUser()` requires password ≥ 8 chars (PocketBase default).
- `users` collection `createRule` is `@request.auth.id = ""` (only unauthenticated can register).
- **PB savers**: id `length === 15` (PB-generated) → PATCH; otherwise → POST **with the `id` field stripped** (PB rejects custom short ids on create: "validation_min_text_constraint"). Savers return `{ ...record, id: created.id }` and store functions adopt it, so edits PATCH the same record. `saveQuote` additionally dedupes by `quoteNumber` (PATCHes the existing record instead of creating a duplicate).
- **Trazabilidad**: `quotes` y `proyectos` llevan `createdBy`/`createdAt`/`updatedBy`/`updatedAt` (text ISO). El store los escribe con `withTrace(record, prev)` (helper `who()` = user name/email). `saveBudget()` recupera el prev desde localStorage/PB para conservar `createdBy`/`createdAt`. Historial muestra columnas "Creado por" y "Modificado" (`fmtStamp` dd/mm hh:mm).
- **Aprobación interna de propuestas**: campo `aprobaciones` (JSON array `{by, at}`) en la colección `quotes` (y en `collectData`/`loadBudgetByNum`/`resetBudget`). `aprobarPropuesta()` (store) exige que el aprobador sea distinto del creador (`createdBy`) y no repita voto; solo aplica en estado `en_revision`, y con la 2ª aprobación auto-transiciona a `aprobada`. `aprobacionInfo` computed → `{ lista, count (usuarios distintos), listaParaEnviar (count>=2) }`. El estado "Enviada" se bloquea con <2 aprobaciones: el select de estado en PropuestaTab usa `:value` + `@change` con `onStatusChange()` (NO `v-model` — revertir el estado reactivo dentro de un watch dejaba el DOM desincronizado con vModelSelect). `saveBudget()` llama `persistBudget()` + `generateQuoteNumber()`; las transiciones usan solo `persistBudget()` (no avanza el contador) y `persistBudget()` sincroniza `state.createdBy`. OJO: PB descarta silenciosamente campos que no existen en el esquema — al agregar un campo al state hay que agregarlo a la colección (migración).
- **Estados de propuesta (workflow)**: `borrador` → `en_revision` → `aprobada` → `enviada` → `adjudicada` / `rectificacion` / `rechazada`; más `modificacion` (revisores piden cambios, vuelve a `en_revision` limpiando votos). Transiciones por botones en PropuestaTab (barra "Acciones por estado") + select libre con validación. `enviarARevision()` desde borrador/modificacion/rectificacion (limpia votos); `solicitarCambios()` (en_revision → modificacion, limpia votos); `enviarACliente()` (aprobada → enviada, guarda `ultimoTotalEnviado`); `reenviarACliente()` (rectificacion → enviada, PERO si el total actual difiere del registro guardado → en_revision con votos limpios + toast "El monto cambió"); `rectificarPropuesta()`/`adjudicarPropuesta()`/`rechazarPropuesta()` (enviada → respectivo). `migrarEstadosViejos()` en `dbLogin` convierte `revision` → `en_revision`. Labels/colores: `STATUS_LABELS`/`STATUS_COLORS` en el store + `normalizeStatus()`; HistorialTab usa `statusClass()`; Dashboard cuenta por las 8 claves.
- **`dedupeQuotes()`** corre en `dbLogin()`: agrupa quotes por `quoteNumber` y elimina duplicados conservando el de mayor contenido (items con precio, secciones con contenido, awardAmount, status).
- **No `created`/`updated` fields**: collections were created via migrations listing only the `id` system field, so `sort=-created` (and any sort by a missing field) → 400 "Something went wrong". All list queries are plain `?perPage=N` and sorted client-side in the store (`loadHistorial` by `quoteDate` desc, clients/catalog by `name`, ingresos/egresos by `fecha` desc).
- **Form add/edit pattern**: `editingId = ref(null)` with `openAdd()` setting it to `'__new__'` (NOT `null` — the form is `v-if="editingId !== null"` and would never show). `submitForm()` uses `id: editingId === '__new__' ? Date.now() + '' : editingId`. See `Clientes.vue`/`Catalogo.vue`/`ProyectosTab.vue`.
- **Computed access**: components destructure `computed` from `usePresupuesto()` and read refs as `computed.finKpis.value.recibido` (never assign a computed to a local `const` and read `.prop` — template bindings don't auto-unwrap member access there).
- **Encoding — NUNCA insertar datos en PB desde PowerShell**: `Invoke-RestMethod` en PS 5.1 envía el body JSON en Windows-1252 y corrompe tildes/ñ/á (guardan como U+FFFD). Todo seeding/inserción de datos con caracteres no-ASCII debe hacerse desde el navegador (fetch = UTF-8) o con body como `byte[]` UTF-8. Síntoma: texto con "�" o "?" en la app.
- **ProyectosTab views**: `view` ref ('tabla'/'kanban'/'calendario'). Kanban = HTML5 drag entre columnas por `status` (`kanbanDragStart`/`kanbanDrop`, guarda con `saveProyecto`). Calendario = timeline horizontal con `timeline` computed (meses + barras % por startDate/endDate).
- **Catálogo**: campo `tipo` ('producto'/'recurso') + filtro `filtroTipo`. Items viejos sin `tipo` → 'producto'.
- **CosteoInterno**: panel derecho `md:sticky md:top-[4.5rem] md:max-h-[calc(100vh-5.5rem)] md:overflow-y-auto` (sigue el scroll, botones finales siempre accesibles).
