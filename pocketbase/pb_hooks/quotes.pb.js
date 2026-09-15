/// <reference path="../pb_data/types.d.ts" />

// Propuestas: trazabilidad, N.º final al aprobar e historial de versiones.
// La lógica está en lib/quotes.js (ver ahí el porqué de cada cosa).

onRecordCreateRequest((e) => {
  require(`${__hooks}/lib/quotes.js`).antesDeGuardar(e, true)
  e.next()
}, 'quotes')

onRecordUpdateRequest((e) => {
  require(`${__hooks}/lib/quotes.js`).antesDeGuardar(e, false)
  e.next()
}, 'quotes')

// Una versión que no se pudo guardar no debe tumbar el guardado de la propuesta,
// que a esta altura ya está hecho.
onRecordAfterCreateSuccess((e) => {
  try {
    require(`${__hooks}/lib/quotes.js`).guardarVersion(e.app, e.record)
  } catch (err) {
    console.error('[quotes] no se pudo guardar la versión:', err)
  }
  e.next()
}, 'quotes')

onRecordAfterUpdateSuccess((e) => {
  try {
    require(`${__hooks}/lib/quotes.js`).guardarVersion(e.app, e.record)
  } catch (err) {
    console.error('[quotes] no se pudo guardar la versión:', err)
  }
  e.next()
}, 'quotes')
