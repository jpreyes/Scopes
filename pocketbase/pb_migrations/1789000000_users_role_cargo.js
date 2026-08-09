/// <reference path="../pb_data/types.d.ts" />

// Rol de aplicación + cargo en `users`, y cierre del registro público.
//
// - `role`: 'admin' | 'user'. Los admins ven Ingresos, Egresos, Costeo Interno
//   y la sección Usuarios; también son los únicos que pueden crear cuentas.
// - `cargo`: ConfigTab.vue ya lo escribía, pero no existía en el esquema y
//   PocketBase lo descartaba en silencio.
migrate((app) => {
  const users = app.findCollectionByNameOrId('users')

  if (!users.fields.getByName('role')) {
    users.fields.add(new SelectField({
      name: 'role',
      values: ['admin', 'user'],
      maxSelect: 1,
    }))
  }

  if (!users.fields.getByName('cargo')) {
    users.fields.add(new TextField({ name: 'cargo', max: 100 }))
  }

  users.listRule = '@request.auth.id != ""'
  users.viewRule = '@request.auth.id != ""'
  // Solo un admin crea cuentas: se acabó el registro abierto a internet.
  users.createRule = '@request.auth.role = "admin"'
  // Cada quien edita su propio perfil, pero no puede auto-promoverse a admin.
  users.updateRule = '(@request.auth.id = id && @request.body.role:isset = false) || @request.auth.role = "admin"'
  users.deleteRule = '@request.auth.role = "admin"'

  app.save(users)

  // Las cuentas que ya existían quedan como 'user' salvo que se les asigne otro rol.
  app.findRecordsByFilter('users', 'role = ""').forEach((r) => {
    r.set('role', 'user')
    app.save(r)
  })
}, (app) => {
  const users = app.findCollectionByNameOrId('users')
  users.fields.removeByName('role')
  users.fields.removeByName('cargo')
  users.createRule = '@request.auth.id = ""'
  users.updateRule = '@request.auth.id = id'
  users.deleteRule = ''
  app.save(users)
})
