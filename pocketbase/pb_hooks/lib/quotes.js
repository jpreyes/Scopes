/// <reference path="../../pb_data/types.d.ts" />

// Lógica de servidor de `quotes`. Vive en un módulo aparte porque en el JSVM de
// PocketBase cada handler corre en una VM aislada que no ve el ámbito del
// archivo `.pb.js`: todo auxiliar entra por `require()` dentro del handler.

const FINAL = /^CT-PS-(\d+)-(\d{4})$/
const PROVISORIO = 'PROV-'
// Desde `aprobada` en adelante la propuesta ya pasó la revisión interna.
const APROBADAS = ['aprobada', 'enviada', 'rectificacion', 'adjudicada']
const VERSIONES_POR_PROPUESTA = 40

function quien(e) {
  const a = e.auth
  if (!a) return ''
  return a.getString('name') || a.email() || ''
}

// Siguiente correlativo: el mayor CT-PS-NNN existente + 1. El índice único de
// `quoteNumber` hace fallar la segunda de dos aprobaciones simultáneas en vez
// de repetir el número.
function siguienteNumero(app) {
  const filas = arrayOf(new DynamicModel({ n: '' }))
  app.db().newQuery("SELECT quoteNumber AS n FROM quotes WHERE quoteNumber LIKE 'CT-PS-%'").all(filas)
  let max = 0
  for (const f of filas) {
    const m = FINAL.exec(f.n)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return 'CT-PS-' + String(max + 1).padStart(3, '0') + '-' + new Date().getFullYear()
}

// Antes de escribir: la trazabilidad la pone el servidor, no el navegador.
// El cliente sobrescribía `createdBy` con quien guardara desde un navegador
// que no tuviera la propuesta en su localStorage, y así "creado por" y
// "modificado por" terminaban siendo siempre la misma persona.
function antesDeGuardar(e, esNueva) {
  const r = e.record
  const ahora = new Date().toISOString()
  const usuario = quien(e)

  if (esNueva) {
    if (usuario) r.set('createdBy', usuario)
    if (!r.getString('createdAt')) r.set('createdAt', ahora)
  } else {
    const o = r.original()
    if (o.getString('createdBy')) r.set('createdBy', o.getString('createdBy'))
    if (o.getString('createdAt')) r.set('createdAt', o.getString('createdAt'))
    // Un correlativo final no se cambia nunca: ni una pestaña vieja que todavía
    // tiene el N.º provisorio puede devolverlo atrás.
    if (FINAL.test(o.getString('quoteNumber'))) r.set('quoteNumber', o.getString('quoteNumber'))
  }
  if (usuario) r.set('updatedBy', usuario)
  r.set('updatedAt', ahora)

  // El N.º final se asigna recién al aprobarse; mientras tanto la propuesta
  // conserva su N.º provisorio en todas sus modificaciones.
  const qn = r.getString('quoteNumber')
  if (APROBADAS.indexOf(r.getString('proposalStatus')) >= 0 && qn.indexOf(PROVISORIO) === 0) {
    r.set('quoteNumber', siguienteNumero(e.app))
  }
}

// Después de guardar: una versión por cada cambio real (dos guardados sin
// cambios no duplican). Se conservan las últimas VERSIONES_POR_PROPUESTA.
function guardarVersion(app, r) {
  const data = JSON.parse(JSON.stringify(r))
  delete data.collectionId
  delete data.collectionName

  const firma = Object.assign({}, data)
  delete firma.updatedBy
  delete firma.updatedAt
  const hash = $security.sha256(JSON.stringify(firma))

  const ultima = app.findRecordsByFilter('quote_versions', 'quoteId = {:id}', '-created', 1, 0, { id: r.id })
  if (ultima.length && ultima[0].getString('hash') === hash) return

  let total = 0
  for (const it of data.proposalItems || []) total += (parseFloat(it.qty) || 0) * (parseFloat(it.price) || 0)

  const v = new Record(app.findCollectionByNameOrId('quote_versions'))
  v.set('quoteId', r.id)
  v.set('quoteNumber', r.getString('quoteNumber'))
  v.set('status', r.getString('proposalStatus'))
  v.set('savedBy', r.getString('updatedBy'))
  v.set('savedAt', r.getString('updatedAt'))
  v.set('total', total)
  v.set('currency', r.getString('currency'))
  v.set('hash', hash)
  v.set('data', data)
  app.save(v)

  const viejas = app.findRecordsByFilter('quote_versions', 'quoteId = {:id}', '-created', 0, VERSIONES_POR_PROPUESTA, { id: r.id })
  for (const x of viejas) app.delete(x)
}

module.exports = { antesDeGuardar, guardarVersion }
