/// <reference path="../pb_data/types.d.ts" />

// - `quote_versions`: historial de versiones de cada propuesta. Lo escribe solo
//   el hook `pb_hooks/quotes.pb.js` (create/update/delete cerrados a la API).
// - `quotes.quoteNumber` único: el N.º final lo asigna el servidor al aprobar
//   y dos propuestas no pueden volver a compartir número (antes el contador
//   vivía en el localStorage de cada navegador y chocaban).
// - JSON de `quotes` hasta 20 MB: el límite por defecto es 1 MB y una sección
//   con una imagen base64 lo pasaba; el guardado fallaba y nadie se enteraba.
// - Sesión de un año: el token se renueva cada vez que se abre la app, así que
//   en la práctica solo se vuelve a pedir la clave tras un año sin entrar.
const JSON_QUOTES = ['propuestaSections', 'proposalItems', 'costeo', 'costeoGroups', 'printSections', 'ganttPhases', 'ganttTasks', 'aprobaciones']

migrate((app) => {
  let versiones = null
  try { versiones = app.findCollectionByNameOrId('quote_versions') } catch (_) { /* no existe todavía */ }
  if (!versiones) {
    versiones = new Collection({
      type: 'base',
      name: 'quote_versions',
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'quoteId', type: 'text', required: true, max: 15 },
        { name: 'quoteNumber', type: 'text', max: 50 },
        { name: 'status', type: 'text', max: 20 },
        { name: 'savedBy', type: 'text', max: 200 },
        { name: 'savedAt', type: 'text', max: 40 },
        { name: 'total', type: 'number' },
        { name: 'currency', type: 'text', max: 10 },
        { name: 'hash', type: 'text', max: 64 },
        { name: 'data', type: 'json', maxSize: 30 * 1024 * 1024 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      ],
      indexes: ['CREATE INDEX idx_quote_versions_quote ON quote_versions (quoteId, created)'],
    })
    app.save(versiones)
  }

  const quotes = app.findCollectionByNameOrId('quotes')
  JSON_QUOTES.forEach((n) => {
    const f = quotes.fields.getByName(n)
    if (f) f.maxSize = 20 * 1024 * 1024
  })
  quotes.addIndex('idx_quotes_quoteNumber', true, 'quoteNumber', "quoteNumber != ''")
  app.save(quotes)

  const users = app.findCollectionByNameOrId('users')
  unmarshal({ authToken: { duration: 31536000 } }, users)
  app.save(users)
}, (app) => {
  const quotes = app.findCollectionByNameOrId('quotes')
  quotes.removeIndex('idx_quotes_quoteNumber')
  app.save(quotes)

  const users = app.findCollectionByNameOrId('users')
  unmarshal({ authToken: { duration: 2592000 } }, users)
  app.save(users)

  try { app.delete(app.findCollectionByNameOrId('quote_versions')) } catch (_) { /* ya no estaba */ }
})
