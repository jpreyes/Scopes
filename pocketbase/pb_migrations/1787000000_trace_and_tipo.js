/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const addFields = (name, fields) => {
    const col = app.findCollectionByNameOrId(name)
    if (!col) return
    fields.forEach(f => {
      const exists = col.fields.find(x => x.name === f.name)
      if (!exists) col.fields.add(new TextField(f))
    })
    app.save(col)
  }

  addFields('quotes', [
    { id: 'text1770000001', name: 'createdBy', type: 'text', max: 200 },
    { id: 'text1770000002', name: 'createdAt', type: 'text', max: 40 },
    { id: 'text1770000003', name: 'updatedBy', type: 'text', max: 200 },
    { id: 'text1770000004', name: 'updatedAt', type: 'text', max: 40 },
  ])
  addFields('proyectos', [
    { id: 'text1770000005', name: 'createdBy', type: 'text', max: 200 },
    { id: 'text1770000006', name: 'createdAt', type: 'text', max: 40 },
    { id: 'text1770000007', name: 'updatedBy', type: 'text', max: 200 },
    { id: 'text1770000008', name: 'updatedAt', type: 'text', max: 40 },
  ])
  addFields('catalog', [
    { id: 'text1770000009', name: 'tipo', type: 'text', max: 20 },
  ])
}, (app) => {
  const removeFields = (name, fieldNames) => {
    const col = app.findCollectionByNameOrId(name)
    if (!col) return
    fieldNames.forEach(fn => {
      const f = col.fields.find(x => x.name === fn)
      if (f) col.fields.remove(f.id)
    })
    app.save(col)
  }
  removeFields('quotes', ['createdBy', 'createdAt', 'updatedBy', 'updatedAt'])
  removeFields('proyectos', ['createdBy', 'createdAt', 'updatedBy', 'updatedAt'])
  removeFields('catalog', ['tipo'])
})
