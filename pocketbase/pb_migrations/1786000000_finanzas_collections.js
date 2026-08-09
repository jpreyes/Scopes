/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collections = [
    {
      name: 'proyectos',
      fields: [
        { id: 'text3208210256', name: 'id', type: 'text', system: true, primaryKey: true, autogeneratePattern: '[a-z0-9]{15}', max: 15, min: 15, required: true },
        { id: 'nombre', name: 'nombre', type: 'text', required: true, max: 300 },
        { id: 'quoteNumber', name: 'quoteNumber', type: 'text', max: 50 },
        { id: 'clientName', name: 'clientName', type: 'text', max: 200 },
        { id: 'status', name: 'status', type: 'text', max: 20 },
        { id: 'startDate', name: 'startDate', type: 'text', max: 20 },
        { id: 'endDate', name: 'endDate', type: 'text', max: 20 },
        { id: 'awardAmount', name: 'awardAmount', type: 'number' },
        { id: 'currency', name: 'currency', type: 'text', max: 10 },
        { id: 'responsable', name: 'responsable', type: 'text', max: 200 },
        { id: 'notes', name: 'notes', type: 'text', max: 1000 },
      ],
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
    },
    {
      name: 'ingresos',
      fields: [
        { id: 'text3208210256', name: 'id', type: 'text', system: true, primaryKey: true, autogeneratePattern: '[a-z0-9]{15}', max: 15, min: 15, required: true },
        { id: 'fecha', name: 'fecha', type: 'text', max: 20 },
        { id: 'proyectoId', name: 'proyectoId', type: 'text', max: 50 },
        { id: 'proyecto', name: 'proyecto', type: 'text', max: 300 },
        { id: 'concepto', name: 'concepto', type: 'text', required: true, max: 300 },
        { id: 'monto', name: 'monto', type: 'number', required: true },
        { id: 'moneda', name: 'moneda', type: 'text', max: 10 },
        { id: 'estado', name: 'estado', type: 'text', max: 20 },
        { id: 'metodo', name: 'metodo', type: 'text', max: 50 },
        { id: 'comprobante', name: 'comprobante', type: 'text', max: 100 },
        { id: 'nota', name: 'nota', type: 'text', max: 500 },
      ],
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
    },
    {
      name: 'egresos',
      fields: [
        { id: 'text3208210256', name: 'id', type: 'text', system: true, primaryKey: true, autogeneratePattern: '[a-z0-9]{15}', max: 15, min: 15, required: true },
        { id: 'fecha', name: 'fecha', type: 'text', max: 20 },
        { id: 'proyectoId', name: 'proyectoId', type: 'text', max: 50 },
        { id: 'proyecto', name: 'proyecto', type: 'text', max: 300 },
        { id: 'categoria', name: 'categoria', type: 'text', max: 50 },
        { id: 'concepto', name: 'concepto', type: 'text', required: true, max: 300 },
        { id: 'monto', name: 'monto', type: 'number', required: true },
        { id: 'moneda', name: 'moneda', type: 'text', max: 10 },
        { id: 'beneficiario', name: 'beneficiario', type: 'text', max: 200 },
        { id: 'estado', name: 'estado', type: 'text', max: 20 },
        { id: 'comprobante', name: 'comprobante', type: 'text', max: 100 },
        { id: 'nota', name: 'nota', type: 'text', max: 500 },
      ],
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
    },
  ]

  collections.forEach(colData => {
    const collection = new Collection({
      name: colData.name,
      type: 'base',
      system: false,
      fields: colData.fields,
      listRule: colData.listRule,
      viewRule: colData.viewRule,
      createRule: colData.createRule,
      updateRule: colData.updateRule,
      deleteRule: colData.deleteRule,
      indexes: [],
    })
    app.save(collection)
  })
}, (app) => {
  ['proyectos', 'ingresos', 'egresos'].forEach(name => {
    const col = app.findCollectionByNameOrId(name)
    if (col) app.delete(col)
  })
})
