/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collections = ['clients', 'catalog', 'quotes']
  const rule = '@request.auth.id != ""'

  collections.forEach(name => {
    const col = app.findCollectionByNameOrId(name)
    if (!col) return
    col.listRule = rule
    col.viewRule = rule
    col.createRule = rule
    col.updateRule = rule
    col.deleteRule = rule
    app.save(col)
  })
}, (app) => {
  const collections = ['clients', 'catalog', 'quotes']
  collections.forEach(name => {
    const col = app.findCollectionByNameOrId(name)
    if (!col) return
    col.listRule = ''
    col.viewRule = ''
    col.createRule = ''
    col.updateRule = ''
    col.deleteRule = ''
    app.save(col)
  })
})
