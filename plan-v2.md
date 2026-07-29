# Plan v2 — Scopes

## Estado Actual (Julio 2026)

### Implementado
- [x] Dashboard con estadísticas (totales, estados, montos, recientes)
- [x] Clientes CRUD (localStorage + PocketBase)
- [x] Catálogo CRUD (localStorage + PocketBase)
- [x] Propuesta: editor rich text (Tiptap), items económicos, secciones
- [x] Carta Gantt: fases, tareas, dependencias, unidades configurables
- [x] Costeo Interno: categorías, items, grupos drag & drop, márgenes
- [x] Historial de presupuestos + exportación Excel
- [x] Impresión/PDF con portada y layout dedicado
- [x] Autenticación web (PocketBase users collection)
- [x] Registro de usuarios (público, password ≥ 8 chars)
- [x] Perfil de usuario (nombre, email, cargo)
- [x] PocketBase como backend (híbrido con localStorage fallback)
- [x] Migración automática localStorage → PocketBase al conectar
- [x] Varios fixes: print table columnas, drag CosteoInterno, credenciales env vars

### Pendiente / Por definir

#### Features
- [ ] Recuperación de contraseña (PocketBase password reset)
- [ ] Dashboard: gráficos, filtros por fecha/estado
- [ ] Catálogo: categorías editables, búsqueda
- [ ] Clientes: historial de presupuestos por cliente
- [ ] Exportar propuesta a Word/PDF desde frontend
- [ ] Firmas digitales (captura de firma)
- [ ] Template de propuestas (guardar secciones como plantilla)
- [ ] Notificaciones por email al cambiar estado
- [ ] Multi-idioma (es/en)

#### Infraestructura
- [ ] Deploy a servidor Linux (nginx + PocketBase)
- [ ] Dockerizar (app + PocketBase)
- [ ] CI/CD básico
- [ ] Backup automático de pb_data
- [ ] SSL/HTTPS (Let's Encrypt)

#### Refactor / Mejoras
- [ ] Migrar de `_superusers` a solo `users` auth para CRUD
- [ ] Separar store en módulos (clientes, catálogo, presupuestos)
- [ ] Unit tests (Vitest)
- [ ] Components con TypeScript
- [ ] Manejo de errores más robusto
- [ ] Loading states en operaciones asíncronas

## Stack
- Frontend: Vite 8 + Vue 3 + Tailwind CSS 4 + Tiptap
- Backend: PocketBase (SQLite)
- Auth: PocketBase users collection (password)
- Persistencia: PocketBase primero, localStorage fallback
