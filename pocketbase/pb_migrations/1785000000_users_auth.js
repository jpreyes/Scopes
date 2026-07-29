/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const users = app.findCollectionByNameOrId('users')
  if (users) {
    users.listRule = '@request.auth.id != ""'
    users.viewRule = '@request.auth.id != ""'
    users.createRule = null
    users.updateRule = '@request.auth.id = id'
    users.deleteRule = ''
    app.save(users)
  }

  // Seed default user: admin@scopes.cl / admin123
  const existing = app.findCollectionByNameOrId('users')
  if (existing) {
    const records = app.findRecordsByFilter('users', 'email = "admin@scopes.cl"')
    if (!records.length) {
      const record = new Record(existing, {
        email: 'admin@scopes.cl',
        password: 'admin123',
        passwordConfirm: 'admin123',
        name: 'Administrador',
      })
      app.save(record)
    }
  }
}, (app) => {})
