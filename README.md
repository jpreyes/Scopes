# Presupuesto Rápido

Generador de ofertas técnico-económicas con cotización, costeo interno confidencial, carta Gantt y exportación a Excel/PDF.

## Stack

- **Vite 8 + Vue 3** (SFC `<script setup>`) + **Tailwind CSS 4**
- **Tiptap** editor de texto enriquecido (negrita, listas, imágenes subidas como base64)
- **xlsx** exportación Excel
- Sin router — tabs vía `state.activeTab` en store reactivo
- Sin linter, typecheck ni tests

## Comandos

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor dev `http://localhost:5173/` (HMR) |
| `npm run build` | Build producción a `dist/` |
| `npm run preview` | Preview build `http://localhost:4173/` |

## Producción

Desplegado en **https://scopes.jpreyes.cl** (VPS `srv1134838.hstgr.cloud`, vía Cloudflare Tunnel).

```
docker compose -f deploy/docker-compose.yml build && docker compose -f deploy/docker-compose.yml up -d
```

nginx sirve la SPA en `127.0.0.1:8092` y hace de proxy de `/api/` y `/_/` hacia el contenedor `pb-scopes`
(stack `pocketbase`, `127.0.0.1:8091`). Detalles en `deploy/` y en `AGENTS.md`.

## Acceso y roles

- **No hay registro público.** Las cuentas las crea un administrador desde la sección **Usuarios**.
- `role` = `admin` o `user`. Solo los admins ven Ingresos, Egresos, Usuarios, el tab **Costeo Interno**
  y las KPI financieras del Dashboard.

## Funcionalidades

- **Propuesta** con secciones de texto enriquecido (presentación, servicio, objetivo, alcance, ventajas), tabla de precios, totales con IVA, firmas
- **Carta Gantt** configurable por unidad de tiempo (horas, días, semanas, meses, años), con meses reales y barras visuales
- **Costeo Interno** confidencial (no se imprime): categorías, items, margen de venta/utilidad, agrupación drag & drop nativo
- **Impresión profesional**: portada + propuesta completa, ocultando edición y costeo. Secciones imprimibles seleccionables vía checkboxes
- **Persistencia en localStorage** con listado de presupuestos guardados
- **Exportación Excel** de costeo por grupos y de historial
- **Imágenes** subidas como base64 y almacenadas en localStorage

## Estructura

```
src/
  App.vue                      — Shell, tabs, print layout
  stores/presupuesto.js        — Store único con estado, computados y lógica
  components/
    CoverPage.vue              — Portada solo impresión
    PropuestaTab.vue           — Formulario propuesta + Carta Gantt
    GanttTab.vue               — Editor dedicado de carta Gantt
    CosteoInterno.vue          — Costeo interno confidencial
    HistorialTab.vue           — Listado de presupuestos guardados
    RichTextEditor.vue         — Wrapper Tiptap con upload de imágenes
public/images/
  image1.png                   — Logo
  image2.png                   — Fondo portada
referencia/                    — Documentos Word/Excel de referencia
```

## Convenciones clave

- N° cotización: `CT-PS-{NNN}-{YYYY}`, auto-incremento en localStorage
- Monedas: `$` = 0 decimales, separador miles `.`; `UF`/`US$`/`€` = 2 decimales
- Margen venta: `P = Costo × (1 + margen%)`; margen utilidad: `P = Costo / (1 − margen%)`
- Drag & drop: Categoría → grupo = copia; Grupo → grupo = mover
- Print layout separado (`.print-layout`) oculto en pantalla, visible solo al imprimir
