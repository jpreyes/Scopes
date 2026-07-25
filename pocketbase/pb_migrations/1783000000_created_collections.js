/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collections = [
    {
      name: 'clients',
      fields: [
        { id: 'text3208210256', name: 'id', type: 'text', system: true, primaryKey: true, autogeneratePattern: '[a-z0-9]{15}', max: 15, min: 15, required: true },
        { id: 'name', name: 'name', type: 'text', required: true, max: 200 },
        { id: 'company', name: 'company', type: 'text', max: 200 },
        { id: 'email', name: 'email', type: 'email' },
        { id: 'phone', name: 'phone', type: 'text', max: 50 },
        { id: 'address', name: 'address', type: 'text', max: 300 },
        { id: 'notes', name: 'notes', type: 'text', max: 500 },
      ],
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
    },
    {
      name: 'catalog',
      fields: [
        { id: 'text3208210256', name: 'id', type: 'text', system: true, primaryKey: true, autogeneratePattern: '[a-z0-9]{15}', max: 15, min: 15, required: true },
        { id: 'name', name: 'name', type: 'text', required: true, max: 200 },
        { id: 'price', name: 'price', type: 'number', required: true },
        { id: 'unit', name: 'unit', type: 'text', max: 20 },
        { id: 'category', name: 'category', type: 'text', max: 100 },
      ],
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
    },
    {
      name: 'quotes',
      fields: [
        { id: 'text3208210256', name: 'id', type: 'text', system: true, primaryKey: true, autogeneratePattern: '[a-z0-9]{15}', max: 15, min: 15, required: true },
        { id: 'quoteNumber', name: 'quoteNumber', type: 'text', max: 50 },
        { id: 'quoteRev', name: 'quoteRev', type: 'text', max: 10 },
        { id: 'quoteDate', name: 'quoteDate', type: 'text', max: 20 },
        { id: 'validUntil', name: 'validUntil', type: 'text', max: 20 },
        { id: 'proposalStatus', name: 'proposalStatus', type: 'text', max: 20 },
        { id: 'awardAmount', name: 'awardAmount', type: 'number' },
        { id: 'projectNotes', name: 'projectNotes', type: 'text', max: 500 },
        { id: 'currency', name: 'currency', type: 'text', max: 10 },
        { id: 'contactPerson', name: 'contactPerson', type: 'text', max: 200 },
        { id: 'company', name: 'company', type: 'text', max: 200 },
        { id: 'companyAddr', name: 'companyAddr', type: 'text', max: 300 },
        { id: 'companyPhone', name: 'companyPhone', type: 'text', max: 50 },
        { id: 'companyEmail', name: 'companyEmail', type: 'email' },
        { id: 'companyResp', name: 'companyResp', type: 'text', max: 200 },
        { id: 'companyRespSig', name: 'companyRespSig', type: 'text', max: 200 },
        { id: 'clientName', name: 'clientName', type: 'text', max: 200 },
        { id: 'clientAddr', name: 'clientAddr', type: 'text', max: 300 },
        { id: 'clientPhone', name: 'clientPhone', type: 'text', max: 50 },
        { id: 'clientEmail', name: 'clientEmail', type: 'email' },
        { id: 'clientResp', name: 'clientResp', type: 'text', max: 200 },
        { id: 'clientRespSig', name: 'clientRespSig', type: 'text', max: 200 },
        { id: 'headerClient', name: 'headerClient', type: 'text', max: 200 },
        { id: 'subheader', name: 'subheader', type: 'text', max: 300 },
        { id: 'propuestaSections', name: 'propuestaSections', type: 'json' },
        { id: 'proposalItems', name: 'proposalItems', type: 'json' },
        { id: 'taxRate', name: 'taxRate', type: 'number' },
        { id: 'costeoMarkup', name: 'costeoMarkup', type: 'number' },
        { id: 'costeoMarginMode', name: 'costeoMarginMode', type: 'text', max: 20 },
        { id: 'costeo', name: 'costeo', type: 'json' },
        { id: 'costeoGroups', name: 'costeoGroups', type: 'json' },
        { id: 'printSections', name: 'printSections', type: 'json' },
        { id: 'ganttPhases', name: 'ganttPhases', type: 'json' },
        { id: 'ganttUnit', name: 'ganttUnit', type: 'text', max: 20 },
        { id: 'ganttSpan', name: 'ganttSpan', type: 'number' },
        { id: 'ganttTasks', name: 'ganttTasks', type: 'json' },
      ],
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
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
  ['quotes', 'catalog', 'clients'].forEach(name => {
    const col = app.findCollectionByNameOrId(name)
    if (col) app.delete(col)
  })
})
