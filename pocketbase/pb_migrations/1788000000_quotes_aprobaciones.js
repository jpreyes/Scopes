/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const col = app.findCollectionByNameOrId('quotes')
  if (!col) return
  const exists = col.fields.find(x => x.name === 'aprobaciones')
  if (!exists) col.fields.add(new JSONField({ id: 'json1770000001', name: 'aprobaciones' }))
  app.save(col)
}, (app) => {
  const col = app.findCollectionByNameOrId('quotes')
  if (!col) return
  const f = col.fields.find(x => x.name === 'aprobaciones')
  if (f) col.fields.remove(f.id)
  app.save(col)
})
