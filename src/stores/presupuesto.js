import { reactive, computed, toRefs } from 'vue'
import * as XLSX from 'xlsx'
import * as pb from './pocketbase.js'

let _key = 0
const uid = () => ++_key
// Los ids de secciones, tareas e ítems se guardan con la propuesta. Al cargar
// hay que llevar el contador por encima de todos ellos, o la próxima sección o
// tarea nueva nace con el id de una que ya existe.
function bumpUid(values) {
  for (const v of values) {
    const n = Number(v)
    if (Number.isFinite(n) && n > _key) _key = n
  }
}
function normalizeIds(list, field) {
  const seen = new Set()
  for (const x of list) {
    if (x[field] === undefined || x[field] === null || x[field] === '' || seen.has(x[field])) x[field] = uid()
    seen.add(x[field])
  }
  return list
}
let toastTimer = null

// --- Numeración ---
// Una propuesta nace con un N.º provisorio (PROV-XXXXXX) que conserva en todas
// sus modificaciones. El correlativo final CT-PS-NNN-AAAA lo asigna el SERVIDOR
// (pb_hooks/lib/quotes.js) cuando la propuesta queda aprobada. Antes el
// contador vivía en el localStorage de cada navegador y avanzaba en cada
// «Guardar»: cada guardado creaba una copia con otro número, y dos personas
// podían sacar el mismo número y pisarse la propuesta una a la otra.
const FINAL_NUMBER = /^CT-PS-\d+-\d{4}$/
function provisionalNumber() {
  const t = Date.now().toString(36).slice(-3)
  const r = Math.random().toString(36).slice(2, 5).padEnd(3, '0')
  return ('PROV-' + t + r).toUpperCase()
}
function isFinalNumber(qn) { return FINAL_NUMBER.test(qn || '') }

function toast(msg) {
  state.toast = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { state.toast = '' }, 2500)
}

function who() { return (state.user && (state.user.name || state.user.email)) || 'Anónimo' }

function withTrace(record, prev) {
  const now = new Date().toISOString()
  const user = who()
  return {
    ...record,
    createdBy: record.createdBy || prev?.createdBy || user,
    createdAt: record.createdAt || prev?.createdAt || now,
    updatedBy: user,
    updatedAt: now,
  }
}

function fmtAmount(amount, currency) {
  let sym = '$ ', dec = 0
  if (currency === 'UF') { sym = 'UF '; dec = 2 }
  else if (currency === 'US$') { sym = 'US$ '; dec = 2 }
  else if (currency === '€') { sym = '€ '; dec = 2 }
  const val = dec === 0
    ? Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    : Number(amount).toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return sym + val
}

function makeDefaultCosteo() {
  return [
    { id: 'personal', label: '1. PERSONAL', items: [
      { desc: 'Ingeniero Senior', qty: 1, days: 2, cost: 250000 },
      { desc: 'Ingeniero Junior', qty: 1, days: 2, cost: 150000 },
      { desc: 'Técnico Scanner', qty: 1, days: 2, cost: 120000 },
      { desc: 'Constructor Civil', qty: 1, days: 2, cost: 100000 },
    ]},
    { id: 'traslados', label: '2. TRASLADOS Y VIÁTICOS', items: [
      { desc: 'Pasajes aéreos', qty: 2, days: 1, cost: 150000 },
      { desc: 'Hotel', qty: 2, days: 2, cost: 75000 },
      { desc: 'Viáticos', qty: 3, days: 2, cost: 50000 },
      { desc: 'Combustible / Peajes', qty: 1, days: 1, cost: 80000 },
      { desc: 'Hidratación', qty: 3, days: 2, cost: 5000 },
    ]},
    { id: 'equipos', label: '3. EQUIPOS E INSUMOS', items: [
      { desc: 'Profometer PM8000', qty: 1, days: 2, cost: 60000 },
      { desc: 'Esclerómetro ZC3-A', qty: 1, days: 2, cost: 35000 },
      { desc: 'Ultrasónico Pundit 200', qty: 1, days: 2, cost: 55000 },
      { desc: 'Escáner láser 3D', qty: 1, days: 2, cost: 120000 },
      { desc: 'Equipo carbonatación', qty: 1, days: 1, cost: 25000 },
    ]},
    { id: 'epp', label: '4. EPP / OTROS', items: [
      { desc: 'Mascarilla 3M + filtros', qty: 3, days: 1, cost: 15000 },
      { desc: 'Guantes de seguridad', qty: 3, days: 1, cost: 8000 },
      { desc: 'Lentes de seguridad', qty: 3, days: 1, cost: 5000 },
      { desc: 'Protector auditivo', qty: 3, days: 1, cost: 7000 },
      { desc: 'Casco 3M', qty: 3, days: 1, cost: 12000 },
    ]},
  ].map(cat => ({ ...cat, items: cat.items.map(it => ({ ...it, _key: uid(), sale: Math.round(it.cost * 1.2) })) }))
}

const state = reactive({
  dbConnected: false,
  user: null,
  activeSection: 'dashboard',
  sidebarOpen: true,
  // Solo aplica dentro de la sección Propuestas; al entrar ahí el Sidebar lo
  // pone en 'historial' (la lista).
  activeTab: 'propuesta',
  tabs: [
    { id: 'propuesta', label: 'Documento' },
    { id: 'gantt', label: 'Carta Gantt' },
    { id: 'costeo', label: 'Costeo Interno' },
  ],

  // `quoteId` es el id del registro en PocketBase: se guarda por id, nunca por
  // N.º. Vacío = propuesta que todavía no llega al servidor.
  quoteId: '',
  quoteNumber: provisionalNumber(),
  quoteRev: '01',
  quoteDate: '',
  validUntil: '',
  proposalStatus: 'borrador',
  awardAmount: null,
  projectNotes: '',
  currency: '$',
  contactPerson: '',

  company: 'Predikta Solutions SpA',
  companyAddr: 'Santiago, Chile',
  companyPhone: '+56 9 1234 5678',
  companyEmail: 'contacto@predikta.cl',
  companyResp: '',
  companyRespSig: '',

  clientName: '',
  clientAddr: '',
  clientPhone: '',
  clientEmail: '',
  clientResp: '',
  clientRespSig: '',

  headerClient: '',
  subheader: '',
  coverBg: 'image2.png',

  presentacion: '', servicio: '', objetivo: '', alcance: '', ventajas: '',
  notes: '', entregables: '',
  propuestaSections: [
    { id: uid(), label: 'PRESENTACIÓN', content: '' },
    { id: uid(), label: 'SERVICIO', content: '' },
    { id: uid(), label: 'OBJETIVO', content: '' },
    { id: uid(), label: 'ALCANCE DEL SERVICIO', content: '' },
    { id: uid(), label: 'VENTAJAS Y DIFERENCIADORES', content: '' },
    { id: uid(), label: 'NOTAS / CONDICIONES', content: '' },
    { id: uid(), label: 'ENTREGABLES', content: '' },
  ],

  proposalItems: [],
  taxRate: 19,
  aprobaciones: [],
  createdBy: '',
  createdAt: '',
  ultimoTotalEnviado: 0,

  costeoMarkup: 20,
  costeoMarginMode: 'venta', // 'venta' | 'utilidad'
  costeoCategories: makeDefaultCosteo(),
  costeoGroups: [
    { id: uid(), name: 'Personal', itemKeys: [] },
    { id: uid(), name: 'Equipos e Insumos', itemKeys: [] },
    { id: uid(), name: 'Traslados y Viáticos', itemKeys: [] },
  ],

  printSections: {},

  ganttPhases: ['CAPTURA DE DATOS', 'ANÁLISIS DE DATOS'],
  ganttUnit: 'day',
  ganttSpan: 14,
  ganttTasks: [],

  loadVersion: 0,
  budgetList: [],
  dashboardData: { total: 0, counts: {}, totalAwardAmount: '$ 0', recent: [] },
  clients: [],
  catalog: [],
  proyectos: [],
  ingresos: [],
  egresos: [],
  toast: '',
})

// Conecta con PocketBase usando el token del USUARIO logueado (las reglas de
// todas las colecciones son `@request.auth.id != ""`). Sin sesión de usuario no
// hay conexión y la app queda en modo localStorage.
async function dbLogin() {
  if (!pb.restoreUserToken()) { state.dbConnected = false; return }
  try {
    state.user = await pb.refreshUser()
    state.dbConnected = true
    // Ya no corre `dedupeQuotes()`: borraba en silencio, en cada login, toda
    // propuesta que compartiera N.º con otra — y dos propuestas distintas
    // compartían N.º justamente por el contador por navegador. Ahora el N.º es
    // único en el servidor.
    migrateLocalToPB()
    migrarEstadosViejos()
  } catch (e) {
    // Solo un rechazo del servidor cierra la sesión. Un fallo de red no: el
    // teléfono cambia de wifi a datos y la petición muere con la señal
    // completa, y tratar eso como "tu sesión ya no vale" es la otra mitad de
    // por qué había que escribir la clave tan seguido. Sin conexión la app ya
    // sabe funcionar contra localStorage, así que se queda dentro y
    // desconectada, que es un estado que existe y está previsto.
    if (e && (e.status === 401 || e.status === 403)) {
      pb.logoutUser()
      state.user = null
    }
    state.dbConnected = false
  }
}

async function migrarEstadosViejos() {
  if (!state.dbConnected) return
  try {
    const quotes = await pb.getQuotes()
    const cambios = quotes.filter(q => q.proposalStatus === 'revision')
    for (const q of cambios) {
      await pb.saveQuote({ ...q, proposalStatus: 'en_revision' }).catch(() => {})
    }
    if (cambios.length) { loadHistorial(); loadDashboardData() }
  } catch (_) { /* best-effort */ }
}

async function migrateLocalToPB() {
  try {
    const [pbClients, pbCatalog] = await Promise.all([
      pb.getClients().catch(() => []),
      pb.getCatalog().catch(() => []),
    ])
    const pbClientKeys = new Set(pbClients.map(c => c.name + '|' + (c.email || '')))
    const pbCatalogKeys = new Set(pbCatalog.map(c => c.name))

    // Solo sube las propuestas guardadas SIN conexión (`_pending`). Antes subía
    // cualquier copia local cuyo N.º no estuviera en el servidor, y cada
    // navegador guarda copia de todo lo que abrió: una propuesta borrada por
    // otra persona, o renumerada al aprobarse, volvía a aparecer.
    const localList = JSON.parse(localStorage.getItem('presto_list') || '[]')
    for (const item of localList) {
      const data = readLocal(item.quoteNumber)
      if (!data || !data._pending) continue
      const body = { ...data }
      delete body._pending
      try {
        const saved = body.id && body.id.length === 15
          ? await pb.updateQuote(body.id, body)
          : await pb.createQuote(body)
        writeLocal(saved, item.quoteNumber)
      } catch (_) { /* queda pendiente para el próximo login */ }
    }

    // Migrate local clients not in PB
    const localClients = JSON.parse(localStorage.getItem('presto_clients') || '[]')
    for (const c of localClients) {
      if (pbClientKeys.has(c.name + '|' + (c.email || ''))) continue
      await pb.saveClient(c).catch(() => {})
    }

    // Migrate local catalog items not in PB
    const localCatalog = JSON.parse(localStorage.getItem('presto_catalog') || '[]')
    for (const item of localCatalog) {
      if (pbCatalogKeys.has(item.name)) continue
      await pb.saveCatalogItem(item).catch(() => {})
    }

    // Migrate local finanzas records not in PB
    const pbProyectos = await pb.getProyectos().catch(() => [])
    const pbIngresos = await pb.getIngresos().catch(() => [])
    const pbEgresos = await pb.getEgresos().catch(() => [])
    const pbProyKeys = new Set(pbProyectos.map(p => p.nombre))
    const pbIngKeys = new Set(pbIngresos.map(i => i.fecha + '|' + i.concepto + '|' + i.monto))
    const pbEgrKeys = new Set(pbEgresos.map(e => e.fecha + '|' + e.concepto + '|' + e.monto))

    const localProyectos = JSON.parse(localStorage.getItem('presto_proyectos') || '[]')
    for (const p of localProyectos) {
      if (pbProyKeys.has(p.nombre)) continue
      await pb.saveProyecto(p).catch(() => {})
    }
    const localIngresos = JSON.parse(localStorage.getItem('presto_ingresos') || '[]')
    for (const i of localIngresos) {
      if (pbIngKeys.has(i.fecha + '|' + i.concepto + '|' + i.monto)) continue
      await pb.saveIngreso(i).catch(() => {})
    }
    const localEgresos = JSON.parse(localStorage.getItem('presto_egresos') || '[]')
    for (const e of localEgresos) {
      if (pbEgrKeys.has(e.fecha + '|' + e.concepto + '|' + e.monto)) continue
      await pb.saveEgreso(e).catch(() => {})
    }
  } catch (_) { /* silent fail — migration is best-effort */ }
}

const proposalSubtotal = computed(() => state.proposalItems.reduce((s, i) => s + (i.qty || 0) * (i.price || 0), 0))
const proposalTax = computed(() => proposalSubtotal.value * (state.taxRate / 100))
const proposalTotal = computed(() => proposalSubtotal.value + proposalTax.value)

const costeoTotalCost = computed(() => {
  let t = 0
  state.costeoCategories.forEach(c => c.items.forEach(i => { t += (i.qty || 0) * (i.days || 0) * (i.cost || 0) }))
  return t
})

const costeoTotalSale = computed(() => {
  let t = 0
  state.costeoCategories.forEach(c => c.items.forEach(i => {
    t += (i.qty || 0) * (i.days || 0) * (i.sale || 0)
  }))
  return t
})

const costeoUtilidad = computed(() => costeoTotalSale.value - costeoTotalCost.value)
const costeoMargen = computed(() => costeoTotalSale.value ? ((costeoTotalSale.value - costeoTotalCost.value) / costeoTotalSale.value * 100).toFixed(1) : '0')
const selectedCount = computed(() => {
  return state.costeoGroups.reduce((s, g) => s + g.itemKeys.length, 0)
})

function sumByCurrency(list, field) {
  const m = {}
  list.forEach(r => {
    const v = Number(r[field]) || 0
    if (!v) return
    const cur = r.moneda || '$'
    m[cur] = (m[cur] || 0) + v
  })
  return m
}

function fmtMoney(amount, currency) { return fmtAmount(Number(amount) || 0, currency || '$') }

function fmtMulti(map) {
  const entries = Object.entries(map || {}).filter(([, v]) => v).sort((a, b) => b[1] - a[1])
  if (!entries.length) return '$ 0'
  return entries.map(([cur, v]) => fmtAmount(v, cur)).join('  ·  ')
}

const isAdmin = computed(() => state.user?.role === 'admin')

const finKpis = computed(() => {
  const recibido = sumByCurrency(state.ingresos.filter(r => r.estado === 'recibido'), 'monto')
  const programado = sumByCurrency(state.ingresos.filter(r => r.estado === 'programado'), 'monto')
  const pagado = sumByCurrency(state.egresos.filter(r => r.estado === 'pagado'), 'monto')
  const pendiente = sumByCurrency(state.egresos.filter(r => r.estado === 'pendiente'), 'monto')
  const utilidad = {}
  new Set([...Object.keys(recibido), ...Object.keys(pagado)]).forEach(k => {
    utilidad[k] = (recibido[k] || 0) - (pagado[k] || 0)
  })
  return {
    recibido, programado, pagado, pendiente, utilidad,
    proyectosActivos: state.proyectos.filter(p => p.status === 'activo').length,
    proyectosTotal: state.proyectos.length,
  }
})

function findItemByKey(key) {
  for (const cat of state.costeoCategories)
    for (const it of cat.items)
      if (it._key === key) return it
  return null
}

function groupTotal(groupId) {
  const group = state.costeoGroups.find(g => g.id === groupId)
  if (!group) return 0
  return group.itemKeys.reduce((sum, key) => {
    const item = findItemByKey(key)
    return sum + (item ? (item.qty||0) * (item.days||0) * (item.sale||0) : 0)
  }, 0)
}

function groupsTotal() {
  return state.costeoGroups.reduce((s, g) => s + groupTotal(g.id), 0)
}

function fmt(amount) { return fmtAmount(amount, state.currency) }

function addCosteoGroup(name) {
  if (!name) return
  state.costeoGroups.push({ id: uid(), name, itemKeys: [] })
}
function removeCosteoGroup(id) {
  state.costeoGroups = state.costeoGroups.filter(g => g.id !== id)
}
function addItemToGroup(groupId, itemKey) {
  const group = state.costeoGroups.find(g => g.id === groupId)
  if (!group || group.itemKeys.includes(itemKey)) return
  group.itemKeys.push(itemKey)
}
function removeItemFromGroup(groupId, idx) {
  const group = state.costeoGroups.find(g => g.id === groupId)
  if (!group) return
  group.itemKeys.splice(idx, 1)
}

function addProposalItem() {
  state.proposalItems.push({ desc: '', qty: 1, price: 0 })
}
function removeProposalItem(i) {
  if (state.proposalItems.length <= 1) {
    const it = state.proposalItems[0]
    Object.assign(it, { desc: '', qty: 1, price: 0 })
    return
  }
  state.proposalItems.splice(i, 1)
}

function recalcSales() {
  const mk = state.costeoMarkup / 100
  state.costeoCategories.forEach(c => c.items.forEach(i => {
    const cost = i.cost || 0
    if (state.costeoMarginMode === 'utilidad') {
      i.sale = mk >= 1 ? 0 : Math.round(cost / (1 - mk))
    } else {
      i.sale = Math.round(cost * (1 + mk))
    }
  }))
}

function addCosteoCategory() {
  state.costeoCategories.push({
    id: uid() + '',
    label: 'NUEVA CATEGORÍA',
    items: [{ desc: '', qty: 1, days: 1, cost: 0, sale: 0, _key: uid() }],
  })
}
function removeCosteoCategory(id) {
  state.costeoCategories = state.costeoCategories.filter(c => c.id !== id)
}
function addCosteoItem(cat) {
  cat.items.push({ desc: '', qty: 1, days: 1, cost: 0, sale: 0, _key: uid() })
}
function removeCosteoItem(cat, i) {
  if (cat.items.length <= 1) {
    const it = cat.items[0]
    Object.assign(it, { desc: '', qty: 1, days: 1, cost: 0, sale: 0 })
    return
  }
  cat.items.splice(i, 1)
}

function syncSelectedToProposal() {
  state.proposalItems = []
  state.costeoGroups.forEach(g => {
    if (!g.itemKeys.length) return
    const total = groupTotal(g.id)
    if (!total) return
    state.proposalItems.push({
      desc: g.name,
      qty: 1,
      price: total,
    })
  })
  if (!state.proposalItems.length) addProposalItem()
  state.activeTab = 'propuesta'
}

const lsKey = qn => 'presto_' + String(qn).replace(/\//g, '_')
function readLocal(qn) {
  try { return JSON.parse(localStorage.getItem(lsKey(qn)) || 'null') } catch (_) { return null }
}
// localStorage es solo respaldo: si se llena (las imágenes van en base64), el
// guardado en el servidor no puede caerse por eso.
function writeLocal(data, oldNumber) {
  try {
    let list = JSON.parse(localStorage.getItem('presto_list') || '[]')
    if (oldNumber && oldNumber !== data.quoteNumber) {
      localStorage.removeItem(lsKey(oldNumber))
      list = list.filter(x => x.quoteNumber !== oldNumber)
    }
    if (!list.find(x => x.quoteNumber === data.quoteNumber)) {
      list.push({ quoteNumber: data.quoteNumber, client: data.clientName || data.client, date: data.quoteDate, savedAt: new Date().toISOString() })
    }
    localStorage.setItem('presto_list', JSON.stringify(list))
    localStorage.setItem(lsKey(data.quoteNumber), JSON.stringify(data))
  } catch (_) { /* cuota llena */ }
}

function resetBudget() {
  const defaults = {
    quoteId: '', quoteNumber: provisionalNumber(), quoteRev: '01', quoteDate: new Date().toISOString().slice(0, 10), validUntil: '',
    proposalStatus: 'borrador', awardAmount: null, projectNotes: '',
    currency: '$', contactPerson: '',
    clientName: '', clientAddr: '', clientPhone: '', clientEmail: '',
    clientResp: '', clientRespSig: '',
    headerClient: '', subheader: '',
    propuestaSections: [
      { id: uid(), label: 'PRESENTACIÓN', content: '' },
      { id: uid(), label: 'SERVICIO', content: '' },
      { id: uid(), label: 'OBJETIVO', content: '' },
      { id: uid(), label: 'ALCANCE DEL SERVICIO', content: '' },
      { id: uid(), label: 'VENTAJAS Y DIFERENCIADORES', content: '' },
      { id: uid(), label: 'NOTAS / CONDICIONES', content: '' },
      { id: uid(), label: 'ENTREGABLES', content: '' },
    ],
    proposalItems: [{ desc: '', qty: 1, price: 0 }],
    aprobaciones: [],
    createdBy: '', createdAt: '',
    ultimoTotalEnviado: 0,
    costeoCategories: [],
    costeoGroups: [],
    printSections: { economica: true, gantt: true },
    ganttPhases: ['CAPTURA DE DATOS', 'ANÁLISIS DE DATOS'],
    ganttUnit: 'day', ganttSpan: 14,
    ganttTasks: [],
    loadVersion: 0,
  }
  // Preserve company info
  const company = { company: state.company, companyAddr: state.companyAddr, companyPhone: state.companyPhone, companyEmail: state.companyEmail, companyResp: state.companyResp, companyRespSig: state.companyRespSig }
  Object.assign(state, defaults, company)
  state.propuestaSections.forEach(s => { if (state.printSections[s.id] === undefined) state.printSections[s.id] = true })
}

function collectData() {
  return {
    ...state.quoteNumber && { quoteNumber: state.quoteNumber },
    quoteRev: state.quoteRev, quoteDate: state.quoteDate, validUntil: state.validUntil,
    proposalStatus: state.proposalStatus, awardAmount: state.awardAmount, projectNotes: state.projectNotes,
    currency: state.currency, contactPerson: state.contactPerson,
    company: state.company, companyAddr: state.companyAddr,
    companyPhone: state.companyPhone, companyEmail: state.companyEmail,
    companyResp: state.companyResp, companyRespSig: state.companyRespSig,
    clientName: state.clientName, clientAddr: state.clientAddr,
    clientPhone: state.clientPhone, clientEmail: state.clientEmail,
    clientResp: state.clientResp, clientRespSig: state.clientRespSig,
    headerClient: state.headerClient,
    subheader: state.subheader,
    propuestaSections: JSON.parse(JSON.stringify(state.propuestaSections.map(s => ({ ...s })))),
    proposalItems: JSON.parse(JSON.stringify(state.proposalItems)),
    taxRate: state.taxRate,
    aprobaciones: JSON.parse(JSON.stringify(state.aprobaciones)),
    ultimoTotalEnviado: state.ultimoTotalEnviado || 0,
    costeoMarkup: state.costeoMarkup,
    costeoMarginMode: state.costeoMarginMode,
    costeo: state.costeoCategories.map(c => ({
      id: c.id, label: c.label,
      items: c.items.map(i => ({ ...i }))
    })),
    costeoGroups: JSON.parse(JSON.stringify(state.costeoGroups)),
    printSections: { ...state.printSections },
    ganttPhases: [...state.ganttPhases],
    ganttUnit: state.ganttUnit,
    ganttSpan: state.ganttSpan,
    ganttTasks: JSON.parse(JSON.stringify(state.ganttTasks)),
  }
}

// Guardar ya no avanza el N.º: una propuesta es el mismo registro de principio
// a fin, y el N.º final le llega recién al aprobarse.
function saveBudget() {
  return persistBudget()
}

// Contenido = todo lo que no es flujo (estado, votos, N.º, trazabilidad). Sirve
// para saber si otra persona cambió la propuesta o solo votó.
const CONTENT_KEYS = [
  'quoteRev', 'quoteDate', 'validUntil', 'currency', 'contactPerson', 'projectNotes',
  'company', 'companyAddr', 'companyPhone', 'companyEmail', 'companyResp', 'companyRespSig',
  'clientName', 'clientAddr', 'clientPhone', 'clientEmail', 'clientResp', 'clientRespSig',
  'headerClient', 'subheader', 'propuestaSections', 'proposalItems', 'taxRate',
  'costeoMarkup', 'costeoMarginMode', 'costeo', 'costeoGroups', 'printSections',
  'ganttPhases', 'ganttUnit', 'ganttSpan', 'ganttTasks',
]
function stable(v) {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']'
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort()
      .map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}'
  }
  return JSON.stringify(v ?? null)
}
function contentSig(rec) { return stable(CONTENT_KEYS.map(k => rec[k] ?? null)) }

const createdIds = {}      // N.º provisorio → id: dos «Guardar» seguidos no crean dos registros
const knownUpdatedAt = {}  // id → `updatedAt` de lo que este navegador cargó o guardó por última vez
const loadedSig = {}       // id → firma del contenido de eso mismo
function rememberLoaded(rec) {
  knownUpdatedAt[rec.id] = rec.updatedAt || ''
  loadedSig[rec.id] = contentSig(rec)
}

function hhmm(iso) {
  const d = new Date(iso)
  if (isNaN(d)) return ''
  return d.toLocaleDateString('es-CL') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}

let saveChain = Promise.resolve()

// Los guardados van en fila: el segundo espera al primero, que es el que trae
// el id del registro recién creado. El aviso de éxito sale cuando el servidor
// confirmó, no antes: antes decía «Guardado ✓» aunque el servidor rechazara.
function persistBudget(okMsg = 'Guardado ✓') {
  const snap = collectData()
  const ref = { id: state.quoteId, number: state.quoteNumber }
  const run = saveChain.then(() => doPersist(snap, ref, okMsg))
  saveChain = run.catch(() => {})
  return run
}

async function doPersist(snap, ref, okMsg) {
  const user = who()
  const now = new Date().toISOString()
  const isOpen = id => (id && state.quoteId === id) || (!state.quoteId && state.quoteNumber === ref.number)

  if (!state.dbConnected) {
    const id = ref.id || createdIds[ref.number] || undefined
    const prev = readLocal(ref.number)
    writeLocal({
      ...snap, id,
      createdBy: prev?.createdBy || state.createdBy || user, createdAt: prev?.createdAt || state.createdAt || now,
      updatedBy: user, updatedAt: now, _pending: true,
    })
    if (isOpen(id) && !state.createdBy) { state.createdBy = user; state.createdAt = now }
    loadHistorial(); loadDashboardData()
    toast(okMsg + ' (sin conexión: se sube al volver)')
    return null
  }

  let id = ref.id || createdIds[ref.number] || ''
  try {
    if (id) {
      const cur = await pb.getQuote(id, 'id,updatedAt,updatedBy').catch(e => { if (e.status === 404) return null; throw e })
      if (!cur) {
        id = '' // la borraron mientras estaba abierta: guardar la vuelve a crear
      } else if (knownUpdatedAt[id] && cur.updatedAt && cur.updatedAt !== knownUpdatedAt[id]) {
        const ok = confirm(`${cur.updatedBy || 'Otra persona'} guardó esta propuesta el ${hhmm(cur.updatedAt)}, después de que la abriste.\n\n`
          + 'Si guardas ahora, tus cambios reemplazan los suyos (los suyos quedan en el historial de versiones).\n\n¿Guardar igual?')
        if (!ok) { toast('No se guardó'); return null }
      }
    }
    // `createdBy`/`createdAt` se mandan solo al crear; al actualizar los
    // conserva el servidor (pb_hooks/lib/quotes.js), que además pone
    // `updatedBy` desde la sesión.
    let saved
    if (id) {
      saved = await pb.updateQuote(id, { ...snap, updatedBy: user, updatedAt: now })
    } else {
      saved = await pb.createQuote({ ...snap, createdBy: user, createdAt: now, updatedBy: user, updatedAt: now })
      createdIds[ref.number] = saved.id
    }
    rememberLoaded(saved)
    if (isOpen(saved.id)) {
      state.quoteId = saved.id
      state.quoteNumber = saved.quoteNumber
      state.createdBy = saved.createdBy || ''
      state.createdAt = saved.createdAt || ''
    }
    writeLocal(saved, ref.number)
    const numerada = saved.quoteNumber !== ref.number && isFinalNumber(saved.quoteNumber)
    toast(numerada ? `${okMsg} — N.º asignado: ${saved.quoteNumber}` : okMsg)
    return saved
  } catch (e) {
    console.error('[guardar]', e)
    toast('No se pudo guardar: ' + (e.message || 'error del servidor'))
    return null
  } finally {
    loadHistorial()
    loadDashboardData()
  }
}

async function aprobarPropuesta() {
  const user = who()
  if (state.proposalStatus !== 'en_revision') { toast('Solo se puede aprobar cuando está en revisión'); return }
  // Antes de votar se mira el servidor: otro revisor pudo votar, o alguien
  // cambiar el contenido, mientras esta pestaña estaba abierta. Votar sobre la
  // copia vieja borraba el voto del otro al guardar.
  const id = state.quoteId
  if (state.dbConnected && id) {
    let cur = null
    try { cur = await pb.getQuote(id) } catch (_) { /* sin red: se vota con lo que hay */ }
    if (cur && cur.updatedAt !== knownUpdatedAt[id]) {
      if (contentSig(cur) !== loadedSig[id]) {
        applyIdentity(cur); applyContent(cur); rememberLoaded(cur)
        toast(`${cur.updatedBy || 'Otra persona'} cambió la propuesta mientras la tenías abierta. Se recargó: revísala y vuelve a aprobar.`)
        return
      }
      const ya = new Set(state.aprobaciones.map(a => a.by))
      ;(cur.aprobaciones || []).forEach(a => { if (!ya.has(a.by)) state.aprobaciones.push({ ...a }) })
      if (cur.proposalStatus !== 'en_revision') {
        applyIdentity(cur); rememberLoaded(cur)
        toast('La propuesta ya no está en revisión: ' + (STATUS_LABELS[cur.proposalStatus] || cur.proposalStatus))
        return
      }
      knownUpdatedAt[id] = cur.updatedAt
    }
  }
  if (state.aprobaciones.some(a => a.by === user)) { toast('Ya aprobaste esta propuesta'); return }
  if (state.createdBy && state.createdBy === user) { toast('El creador no puede aprobar su propia propuesta'); return }
  state.aprobaciones.push({ by: user, at: new Date().toISOString() })
  if (aprobacionInfo.value.count >= 2) {
    state.proposalStatus = 'aprobada'
    persistBudget('Propuesta aprobada por la revisión interna ✓')
  } else {
    persistBudget('Aprobación registrada (' + aprobacionInfo.value.count + '/2)')
  }
}

// --- Transiciones de estado ---

function enviarARevision() {
  const desde = state.proposalStatus
  if (desde !== 'borrador' && desde !== 'modificacion' && desde !== 'rectificacion') return
  if (desde === 'modificacion' || desde === 'rectificacion') state.aprobaciones = []
  state.proposalStatus = 'en_revision'
  persistBudget('Propuesta enviada a revisión interna ✓')
}

function solicitarCambios() {
  if (state.proposalStatus !== 'en_revision') return
  state.aprobaciones = []
  state.proposalStatus = 'modificacion'
  persistBudget('Se solicitaron cambios al creador')
}

function enviarACliente() {
  if (state.proposalStatus !== 'aprobada') return
  state.ultimoTotalEnviado = proposalTotal.value
  state.proposalStatus = 'enviada'
  persistBudget('Propuesta enviada al cliente ✓')
}

function rectificarPropuesta() {
  if (state.proposalStatus !== 'enviada') return
  state.proposalStatus = 'rectificacion'
  persistBudget('Rectificación del cliente registrada')
}

// Se compara contra el total que efectivamente se le mandó al cliente
// (`ultimoTotalEnviado`). Contra el registro guardado no servía: bastaba con
// apretar «Guardar» antes de reenviar para que el monto nuevo pasara sin revisión.
async function reenviarACliente() {
  if (state.proposalStatus !== 'rectificacion') return
  const totalActual = proposalTotal.value
  let totalPrev = state.ultimoTotalEnviado || null
  if (totalPrev === null && state.dbConnected && state.quoteId) {
    try {
      const prev = await pb.getQuote(state.quoteId, 'proposalItems,taxRate')
      const sub = (prev.proposalItems || []).reduce((s, i) => s + (parseFloat(i.qty) || 0) * (parseFloat(i.price) || 0), 0)
      totalPrev = sub * (1 + (Number(prev.taxRate) || 0) / 100)
    } catch (_) {}
  }
  if (totalPrev !== null && Math.abs(totalActual - totalPrev) > 0.01) {
    state.aprobaciones = []
    state.proposalStatus = 'en_revision'
    persistBudget('El monto cambió — requiere nueva revisión interna')
    return
  }
  state.ultimoTotalEnviado = totalActual
  state.proposalStatus = 'enviada'
  persistBudget('Propuesta reenviada al cliente ✓')
}

function adjudicarPropuesta() {
  if (state.proposalStatus !== 'enviada') return
  state.proposalStatus = 'adjudicada'
  persistBudget('Propuesta adjudicada ✓')
}

function rechazarPropuesta() {
  if (state.proposalStatus !== 'enviada') return
  state.proposalStatus = 'rechazada'
  persistBudget('Propuesta rechazada')
}

const aprobacionInfo = computed(() => {
  const unicos = new Set(state.aprobaciones.map(a => a.by))
  return {
    lista: state.aprobaciones.map(a => ({ ...a })),
    count: unicos.size,
    listaParaEnviar: unicos.size >= 2,
  }
})

// Se puede descargar una propuesta en cualquier estado, pero mientras no haya
// pasado la aprobación interna el archivo sale con marca de agua. Los estados
// posteriores a la aprobación cuentan como aprobados aunque no tengan votos
// registrados: las propuestas anteriores al workflow no los tienen.
const ESTADOS_YA_APROBADOS = ['aprobada', 'enviada', 'rectificacion', 'adjudicada']
const aprobadaInternamente = computed(() =>
  aprobacionInfo.value.count >= 2 || ESTADOS_YA_APROBADOS.includes(state.proposalStatus))

// Lo que identifica a la propuesta y su flujo: N.º, estado, votos, autoría.
function applyIdentity(data) {
  Object.assign(state, {
    quoteId: data.id && String(data.id).length === 15 ? data.id : '',
    quoteNumber: data.quoteNumber || provisionalNumber(),
    proposalStatus: data.proposalStatus || 'borrador',
    awardAmount: data.awardAmount || null,
    aprobaciones: (data.aprobaciones || []).map(a => ({ ...a })),
    createdBy: data.createdBy || '',
    createdAt: data.createdAt || '',
    ultimoTotalEnviado: data.ultimoTotalEnviado || 0,
  })
}

// Reemplaza TODO el contenido del editor. Antes el costeo, los grupos y la
// Gantt solo se reemplazaban si la propuesta cargada los traía —y el costeo,
// solo en las categorías que coincidieran por id con las que ya había en
// pantalla—: lo que no calzaba quedaba de la propuesta abierta antes y, al
// guardar, se escribía encima. Además los ítems del costeo recibían un `_key`
// nuevo en cada carga, y los grupos, que los referencian por `_key`, quedaban
// apuntando a ítems que ya no existían. Así aparecía «otro costeo montado» en
// una propuesta que nadie había tocado.
function applyContent(data) {
  Object.assign(state, {
    quoteRev: data.quoteRev || '01',
    quoteDate: data.quoteDate || '',
    validUntil: data.validUntil || '',
    currency: data.currency || '$',
    contactPerson: data.contactPerson || '',
    projectNotes: data.projectNotes || '',
    company: data.company || '', companyAddr: data.companyAddr || '',
    companyPhone: data.companyPhone || '', companyEmail: data.companyEmail || '',
    companyResp: data.companyResp || '', companyRespSig: data.companyRespSig || '',
    clientName: data.clientName || data.client || '', clientAddr: data.clientAddr || '',
    clientPhone: data.clientPhone || '', clientEmail: data.clientEmail || '',
    clientResp: data.clientResp || '', clientRespSig: data.clientRespSig || '',
    headerClient: data.headerClient || '',
    subheader: data.subheader || '',
    proposalItems: (data.proposalItems || []).map(x => ({ ...x })),
    // `??` y no `||`: un IVA o un margen en 0 es un valor, no un vacío.
    taxRate: data.taxRate ?? 19,
    costeoMarkup: data.costeoMarkup ?? 20,
    costeoMarginMode: data.costeoMarginMode || 'venta',
  })

  let sections
  if (data.propuestaSections && data.propuestaSections.length) {
    sections = data.propuestaSections.map(s => ({ ...s }))
  } else {
    // propuestas anteriores a las secciones libres
    const oldLabels = ['PRESENTACIÓN', 'SERVICIO', 'OBJETIVO', 'ALCANCE DEL SERVICIO', 'VENTAJAS Y DIFERENCIADORES', 'NOTAS / CONDICIONES', 'ENTREGABLES']
    const oldKeys = ['presentacion', 'servicio', 'objetivo', 'alcance', 'ventajas', 'notes', 'entregables']
    sections = oldLabels.map((l, i) => ({ id: null, label: l, content: data[oldKeys[i]] || '' }))
  }
  const costeo = (Array.isArray(data.costeo) ? data.costeo : []).map(c => ({
    id: c.id, label: c.label, items: (c.items || []).map(i => ({ ...i })),
  }))
  const items = costeo.flatMap(c => c.items)
  const groups = (data.costeoGroups || []).map(g => ({ ...g, itemKeys: [...(g.itemKeys || [])] }))
  const tasks = (data.ganttTasks || []).map(t => ({ ...t }))

  bumpUid([...sections.map(s => s.id), ...items.map(i => i._key), ...groups.map(g => g.id), ...tasks.map(t => t.id), ...costeo.map(c => c.id)])
  normalizeIds(sections, 'id')
  normalizeIds(items, '_key')
  normalizeIds(groups, 'id')
  normalizeIds(tasks, 'id')

  state.propuestaSections = sections
  state.printSections = { ...(data.printSections || {}) }
  sections.forEach(s => { if (state.printSections[s.id] === undefined) state.printSections[s.id] = true })
  if (state.printSections.economica === undefined) state.printSections.economica = true
  if (state.printSections.gantt === undefined) state.printSections.gantt = true

  state.costeoCategories = costeo
  state.costeoGroups = groups

  const phases = data.ganttPhases && data.ganttPhases.length ? [...data.ganttPhases] : ['CAPTURA DE DATOS', 'ANÁLISIS DE DATOS']
  // Tareas cuya sección ya no existe: quedaron así al renombrar una sección
  // con el editor viejo. Se les devuelve su sección en vez de dejarlas ocultas.
  tasks.forEach(t => { if (t.phase && !phases.includes(t.phase)) phases.push(t.phase) })
  state.ganttPhases = phases
  state.ganttUnit = data.ganttUnit || 'day'
  state.ganttSpan = data.ganttSpan || 14
  state.ganttTasks = tasks

  if (!state.proposalItems.length) addProposalItem()
  state.loadVersion++
}

async function loadBudgetByNum(qn) {
  let data = null
  if (state.dbConnected) {
    try { data = await pb.getQuoteByNum(qn) } catch (_) { /* sin red: copia local */ }
  }
  if (!data) data = readLocal(qn)
  if (!data) { toast('No se encontró la propuesta ' + qn); return }
  applyIdentity(data)
  applyContent(data)
  if (state.quoteId) rememberLoaded(data)
  state.activeTab = 'propuesta'
}

async function loadBudget() {
  const list = JSON.parse(localStorage.getItem('presto_list') || '[]')
  if (!list.length) { alert('No hay presupuestos guardados.'); return }
  const msg = 'Presupuestos guardados:\n' + list.map((x, i) => `${i + 1}. ${x.quoteNumber} - ${x.client || '?'} (${x.date})`).join('\n') + '\n\nN° a cargar:'
  const idx = parseInt(prompt(msg)) - 1
  if (!isNaN(idx) && idx >= 0 && idx < list.length) await loadBudgetByNum(list[idx].quoteNumber)
}

// Se espera a que el servidor confirme el borrado ANTES de recargar la lista:
// recargarla en el mismo suspiro traía de vuelta la propuesta —todavía no
// borrada— y había que apretar Eliminar dos veces.
async function deleteBudget(qn) {
  if (!confirm(`¿Eliminar ${qn}?`)) return
  localStorage.removeItem(lsKey(qn))
  let list = JSON.parse(localStorage.getItem('presto_list') || '[]')
  localStorage.setItem('presto_list', JSON.stringify(list.filter(x => x.quoteNumber !== qn)))
  if (state.dbConnected) {
    const item = state.budgetList.find(x => x.quoteNumber === qn)
    try {
      if (item && item.id) await pb.deleteQuote(item.id)
      else await pb.deleteQuoteByNum(qn)
    } catch (e) {
      toast('No se pudo eliminar: ' + (e.message || 'error del servidor'))
      loadHistorial()
      return
    }
  }
  // Si la borrada era la que está abierta, deja de tener registro: un guardado
  // posterior la crea de nuevo en vez de fallar contra un id que ya no existe.
  if (state.quoteNumber === qn) state.quoteId = ''
  loadHistorial()
  loadDashboardData()
  toast('Propuesta eliminada')
}

function loadHistorial() {
  if (state.dbConnected) {
    pb.getQuotes().then(quotes => {
      const list = quotes.map(q => {
        const status = normalizeStatus(q.proposalStatus)
        const total = (q.proposalItems || []).reduce((s, i) => s + (parseFloat(i.qty) || 0) * (parseFloat(i.price) || 0), 0)
        return {
          id: q.id, quoteNumber: q.quoteNumber, client: q.clientName || q.client || '-', date: q.quoteDate || '-',
          subheader: q.subheader || '',
          total: fmtAmount(total, q.currency || '$'),
          currency: q.currency || '$',
          status, statusLabel: STATUS_LABELS[status] || 'Borrador',
          statusColor: STATUS_COLORS[status] || 'bg-gray-400',
          awardAmount: q.awardAmount || null,
          createdBy: q.createdBy || '', createdAt: q.createdAt || '',
          updatedBy: q.updatedBy || '', updatedAt: q.updatedAt || '',
          aprobaciones: q.aprobaciones || [],
        }
      })
      state.budgetList = list.sort((a, b) => (b.date === '-' ? '' : b.date).localeCompare(a.date === '-' ? '' : a.date) || String(b.quoteNumber).localeCompare(String(a.quoteNumber)))
    }).catch(() => loadHistorialFallback())
  } else { loadHistorialFallback() }
}
function loadHistorialFallback() {
  const list = JSON.parse(localStorage.getItem('presto_list') || '[]')
  state.budgetList = list.slice().reverse().map(item => {
    const full = JSON.parse(localStorage.getItem('presto_' + item.quoteNumber.replace(/\//g, '_')))
    const total = full ? full.proposalItems.reduce((s, i) => s + (parseFloat(i.qty) || 0) * (parseFloat(i.price) || 0), 0) : 0
    const status = normalizeStatus(full?.proposalStatus || 'borrador')
    return {
      ...item,
      total: fmtAmount(total, full?.currency || '$'),
      currency: full?.currency || '$',
      status,
      statusLabel: STATUS_LABELS[status] || 'Borrador',
      statusColor: STATUS_COLORS[status] || 'bg-gray-400',
      awardAmount: full?.awardAmount || null,
      createdBy: full?.createdBy || '', createdAt: full?.createdAt || '',
      updatedBy: full?.updatedBy || '', updatedAt: full?.updatedAt || '',
      aprobaciones: full?.aprobaciones || [],
    }
  })
}

const STATUS_LABELS = {
  borrador: 'Borrador',
  en_revision: 'En Revisión',
  modificacion: 'Requiere cambios',
  aprobada: 'Aprobada',
  enviada: 'Enviada',
  rectificacion: 'Rectificación',
  adjudicada: 'Adjudicada',
  rechazada: 'Rechazada',
  revision: 'En Revisión',
}
const STATUS_COLORS = {
  borrador: 'bg-gray-400',
  en_revision: 'bg-amber-500',
  modificacion: 'bg-orange-500',
  aprobada: 'bg-emerald-500',
  enviada: 'bg-blue-500',
  rectificacion: 'bg-violet-500',
  adjudicada: 'bg-primary',
  rechazada: 'bg-red-500',
  revision: 'bg-amber-500',
}

function normalizeStatus(s) { return s === 'revision' ? 'en_revision' : s || 'borrador' }

function loadDashboardData() {
  if (state.dbConnected) {
    pb.getQuotes().then(quotes => processDashboard(quotes)).catch(() => loadDashboardFallback())
  } else { loadDashboardFallback() }
}
function processDashboard(quotes) {
  const counts = { borrador: 0, en_revision: 0, modificacion: 0, aprobada: 0, enviada: 0, rectificacion: 0, adjudicada: 0, rechazada: 0 }
  let totalAwardAmount = 0
  const recent = []
  quotes.forEach(q => {
    const status = normalizeStatus(q.proposalStatus)
    counts[status] = (counts[status] || 0) + 1
    if (q.awardAmount) totalAwardAmount += Number(q.awardAmount)
    const total = (q.proposalItems || []).reduce((s, i) => s + (parseFloat(i.qty) || 0) * (parseFloat(i.price) || 0), 0)
    recent.push({
      quoteNumber: q.quoteNumber, client: q.clientName || '-', date: q.quoteDate || '-',
      status, statusLabel: STATUS_LABELS[status] || 'Borrador',
      total: fmtAmount(total, q.currency || '$'),
    })
  })
  recent.sort((a, b) => new Date(b.date) - new Date(a.date))
  state.dashboardData = { total: quotes.length, counts, totalAwardAmount: fmtAmount(totalAwardAmount, '$'), recent: recent.slice(0, 6) }
}
function loadDashboardFallback() {
  const list = JSON.parse(localStorage.getItem('presto_list') || '[]')
  const counts = { borrador: 0, en_revision: 0, modificacion: 0, aprobada: 0, enviada: 0, rectificacion: 0, adjudicada: 0, rechazada: 0 }
  let totalAwardAmount = 0
  const recent = []

  list.slice().reverse().forEach(item => {
    const key = 'presto_' + item.quoteNumber.replace(/\//g, '_')
    const full = JSON.parse(localStorage.getItem(key))
    if (!full) return
    const status = normalizeStatus(full.proposalStatus || 'borrador')
    counts[status] = (counts[status] || 0) + 1
    if (full.awardAmount) totalAwardAmount += Number(full.awardAmount)
    const total = full.proposalItems.reduce((s, i) => s + (parseFloat(i.qty) || 0) * (parseFloat(i.price) || 0), 0)
    recent.push({
      quoteNumber: item.quoteNumber,
      client: item.client || '-',
      date: item.date || '-',
      status,
      statusLabel: STATUS_LABELS[status] || 'Borrador',
      total: fmtAmount(total, full?.currency || '$'),
    })
  })

  recent.sort((a, b) => new Date(b.date) - new Date(a.date))
  state.dashboardData = {
    total: list.length,
    counts,
    totalAwardAmount: fmtAmount(totalAwardAmount, '$'),
    recent: recent.slice(0, 6),
  }
}

async function seedSampleData() {
  // Seed clients
  const sampleClients = [
    { id: 'c1', name: 'Carlos Muñoz', company: 'Constructora Los Andes', email: 'carlos@clandes.cl', phone: '+56 9 8111 0001', address: 'Av. Libertador 1500, Santiago', notes: 'Cliente frecuente - obras civiles' },
    { id: 'c2', name: 'Roberto Ávila', company: 'Mina El Teniente', email: 'ravila@codelco.cl', phone: '+56 9 8222 0002', address: 'Rancagua, Región del Libertador', notes: 'Contacto directo en operaciones' },
    { id: 'c3', name: 'Pablo Rojas', company: 'Edifica SpA', email: 'projas@edifica.cl', phone: '+56 9 8333 0003', address: 'Nueva Costanera 3200, Vitacura', notes: 'Proyectos inmobiliarios' },
    { id: 'c4', name: 'Andrés Salinas', company: 'Puentes del Sur', email: 'asalinas@puentessur.cl', phone: '+56 9 8444 0004', address: 'Talca, Región del Maule', notes: 'Obras de infraestructura vial' },
    { id: 'c5', name: 'Luis Vega', company: 'Hormigones Nacionales', email: 'lvega@hormigon.cl', phone: '+56 9 8555 0005', address: 'Panamericana Norte 5000, Quilicura', notes: 'Planta de hormigón' },
    { id: 'c6', name: 'Camila Flores', company: 'Arquidiseño Ltda', email: 'cflores@arquidiseno.cl', phone: '+56 9 8666 0006', address: 'Providencia 2450, Santiago', notes: 'Oficina de arquitectura' },
  ]
  localStorage.setItem('presto_clients', JSON.stringify(sampleClients))

  // Seed catalog
  const sampleCatalog = [
    { id: 'cat1', name: 'Ingeniero Senior', price: 350000, unit: 'día', category: 'Personal', tipo: 'recurso' },
    { id: 'cat2', name: 'Ingeniero Junior', price: 200000, unit: 'día', category: 'Personal', tipo: 'recurso' },
    { id: 'cat3', name: 'Técnico Especializado', price: 120000, unit: 'día', category: 'Personal', tipo: 'recurso' },
    { id: 'cat4', name: 'Scanner de Armadura PM8000', price: 80000, unit: 'día', category: 'Equipos', tipo: 'recurso' },
    { id: 'cat5', name: 'Ultrasonido Pundit 200', price: 75000, unit: 'día', category: 'Equipos', tipo: 'recurso' },
    { id: 'cat6', name: 'Esclerómetro ZC3-A', price: 45000, unit: 'día', category: 'Equipos', tipo: 'recurso' },
    { id: 'cat7', name: 'Ensayo de Carbonatación', price: 35000, unit: 'und', category: 'Ensayos', tipo: 'producto' },
    { id: 'cat8', name: 'Extracción de Testigos', price: 90000, unit: 'und', category: 'Ensayos', tipo: 'producto' },
    { id: 'cat9', name: 'Informe Técnico', price: 500000, unit: 'global', category: 'Informes', tipo: 'producto' },
    { id: 'cat10', name: 'Modelación BIM', price: 650000, unit: 'global', category: 'Informes', tipo: 'producto' },
    { id: 'cat11', name: 'Pasaje Aéreo Nacional', price: 120000, unit: 'und', category: 'Viáticos', tipo: 'producto' },
    { id: 'cat12', name: 'Hotel', price: 75000, unit: 'noche', category: 'Viáticos', tipo: 'producto' },
  ]
  localStorage.setItem('presto_catalog', JSON.stringify(sampleCatalog))

  const samples = [
    {
      quoteNumber: 'DEMO-001-2026', quoteDate: '2026-07-15', clientName: 'Constructora Los Andes',
      subheader: 'INSPECCIÓN DE LOSA EDIFICIO CORPORATIVO', proposalStatus: 'adjudicada', awardAmount: 12500000,
      contactPerson: 'Carlos Muñoz', companyResp: 'Juan Pérez', companyRespSig: 'Juan Pérez',
      clientResp: 'Carlos Muñoz', clientRespSig: 'Carlos Muñoz',
      proposalItems: [
        { desc: 'Personal Técnico', qty: 1, price: 6500000 },
        { desc: 'Equipos Especializados', qty: 1, price: 3800000 },
        { desc: 'Traslados y Viáticos', qty: 1, price: 2200000 },
      ],
      propuestaSections: [
        { label: 'PRESENTACIÓN', content: '<p>Presentamos nuestra propuesta técnica para la inspección de losa del edificio corporativo de Constructora Los Andes, comprometiéndonos a entregar un servicio de excelencia.</p>' },
        { label: 'ALCANCE', content: '<p>El servicio incluye inspección visual, ensayos no destructivos, extracción de testigos y análisis estructural de la losa del edificio corporativo.</p>' },
        { label: 'ENTREGABLES', content: '<ul><li>Informe técnico detallado</li><li>Planos con resultados</li><li>Recomendaciones estructurales</li></ul>' },
      ],
      ganttTasks: [
        { name: 'Inspección en terreno', phase: 'CAPTURA DE DATOS', startDay: 1, endDay: 3 },
        { name: 'Ensayos de laboratorio', phase: 'CAPTURA DE DATOS', startDay: 2, endDay: 5 },
        { name: 'Análisis estructural', phase: 'ANÁLISIS DE DATOS', startDay: 5, endDay: 8 },
        { name: 'Entrega de informes', phase: 'ANÁLISIS DE DATOS', startDay: 8, endDay: 10 },
      ],
    },
    {
      quoteNumber: 'DEMO-002-2026', quoteDate: '2026-07-20', clientName: 'Mina El Teniente',
      subheader: 'ESTUDIO DE SUELOS SECTOR NORTE', proposalStatus: 'revision',
      contactPerson: 'Roberto Ávila', companyResp: 'María Soto', companyRespSig: 'María Soto',
      clientResp: 'Roberto Ávila', clientRespSig: '',
      proposalItems: [
        { desc: 'Estudio de Suelos', qty: 1, price: 5200000 },
        { desc: 'Análisis Químico', qty: 1, price: 1900000 },
        { desc: 'Informe Geotécnico', qty: 1, price: 1100000 },
      ],
      propuestaSections: [
        { label: 'PRESENTACIÓN', content: '<p>Proponemos la realización de un estudio de suelos completo en el sector norte de la mina.</p>' },
        { label: 'METODOLOGÍA', content: '<p>Se realizarán calicatas, ensayos SPT, y análisis de laboratorio según norma NCh.</p>' },
      ],
      ganttTasks: [
        { name: 'Trabajo en terreno', phase: 'CAPTURA DE DATOS', startDay: 1, endDay: 5 },
        { name: 'Ensayos de laboratorio', phase: 'CAPTURA DE DATOS', startDay: 4, endDay: 8 },
        { name: 'Informe final', phase: 'ANÁLISIS DE DATOS', startDay: 8, endDay: 12 },
      ],
    },
    {
      quoteNumber: 'DEMO-003-2026', quoteDate: '2026-07-10', clientName: 'Edifica SpA',
      subheader: 'INSPECCIÓN TÉCNICA DE OBRA', proposalStatus: 'aprobada', awardAmount: 5800000,
      contactPerson: 'Pablo Rojas', companyResp: 'Juan Pérez',
      proposalItems: [
        { desc: 'Inspección Técnica', qty: 1, price: 3500000 },
        { desc: 'Informe Semanal', qty: 4, price: 575000 },
      ],
      propuestaSections: [
        { label: 'PRESENTACIÓN', content: '<p>Servicio de inspección técnica de obra para el proyecto Nueva Sede Edifica SpA.</p>' },
        { label: 'SERVICIO', content: '<p>Incluye revisión de avance, control de calidad, y elaboración de informes semanales.</p>' },
      ],
      ganttTasks: [
        { name: 'Inspección inicial', phase: 'CAPTURA DE DATOS', startDay: 1, endDay: 2 },
        { name: 'Seguimiento semanal', phase: 'CAPTURA DE DATOS', startDay: 3, endDay: 14 },
        { name: 'Informe final', phase: 'ANÁLISIS DE DATOS', startDay: 14, endDay: 15 },
      ],
    },
    {
      quoteNumber: 'DEMO-004-2026', quoteDate: '2026-07-22', clientName: 'Puentes del Sur',
      subheader: 'LEVANTAMIENTO TOPOGRÁFICO PUENTE MAULE', proposalStatus: 'borrador',
      contactPerson: 'Andrés Salinas',
      proposalItems: [
        { desc: 'Topografía', qty: 1, price: 1800000 },
        { desc: 'Modelación Digital', qty: 1, price: 1100000 },
      ],
      propuestaSections: [
        { label: 'PRESENTACIÓN', content: '<p>Propuesta para levantamiento topográfico del Puente Maule.</p>' },
        { label: 'EQUIPO', content: '<p>Contaremos con estación total, GPS diferencial, y drone para fotogrametría.</p>' },
      ],
      ganttTasks: [
        { name: 'Trabajo en terreno', phase: 'CAPTURA DE DATOS', startDay: 1, endDay: 3 },
        { name: 'Procesamiento', phase: 'ANÁLISIS DE DATOS', startDay: 4, endDay: 6 },
      ],
    },
    {
      quoteNumber: 'DEMO-005-2026', quoteDate: '2026-07-18', clientName: 'Hormigones Nacionales',
      subheader: 'ENSAYOS DE CALIDAD DE HORMIGÓN', proposalStatus: 'enviada',
      contactPerson: 'Luis Vega', companyResp: 'María Soto',
      proposalItems: [
        { desc: 'Scanner de Armadura', qty: 3, price: 450000 },
        { desc: 'Ultrasonido', qty: 5, price: 380000 },
        { desc: 'Esclerometría', qty: 10, price: 180000 },
      ],
      propuestaSections: [
        { label: 'PRESENTACIÓN', content: '<p>Programa de ensayos de calidad de hormigón para la planta de Hormigones Nacionales.</p>' },
        { label: 'ENSAYOS', content: '<p>Se realizarán ensayos de esclerometría, ultrasonido, y scanner de armadura según normativa vigente.</p>' },
        { label: 'PLAZOS', content: '<p>Los resultados preliminares se entregarán en 5 días hábiles.</p>' },
      ],
      ganttTasks: [
        { name: 'Toma de muestras', phase: 'CAPTURA DE DATOS', startDay: 1, endDay: 3 },
        { name: 'Ensayos en laboratorio', phase: 'CAPTURA DE DATOS', startDay: 3, endDay: 7 },
        { name: 'Elaboración de informes', phase: 'ANÁLISIS DE DATOS', startDay: 7, endDay: 10 },
      ],
    },
    {
      quoteNumber: 'DEMO-006-2026', quoteDate: '2026-07-05', clientName: 'Arquidiseño Ltda',
      subheader: 'CONSULTORÍA ESTRUCTURAL PROYECTO HABITACIONAL', proposalStatus: 'rechazada',
      contactPerson: 'Camila Flores',
      proposalItems: [
        { desc: 'Consultoría Estructural', qty: 1, price: 1500000 },
        { desc: 'Revisión de Planos', qty: 1, price: 600000 },
      ],
      propuestaSections: [
        { label: 'PRESENTACIÓN', content: '<p>Servicios de consultoría estructural para proyecto habitacional.</p>' },
        { label: 'SERVICIOS', content: '<p>Incluye revisión de planos, cálculo estructural, y memoria de cálculo.</p>' },
      ],
      ganttTasks: [
        { name: 'Revisión de antecedentes', phase: 'CAPTURA DE DATOS', startDay: 1, endDay: 2 },
        { name: 'Modelación estructural', phase: 'ANÁLISIS DE DATOS', startDay: 3, endDay: 5 },
      ],
    },
  ]

  // N.º DEMO-…: fuera de la numeración real (el servidor solo renumera los
  // PROV-…). Con los CT-PS-001… de antes, cargar los ejemplos pisaba las
  // propuestas reales que tuvieran esos números.
  const now = Date.now()

  samples.forEach((s, si) => {
    // Build sections with ids
    const sections = s.propuestaSections.map(sec => ({
      id: uid(), label: sec.label, content: sec.content,
    }))

    // Build costeo categories
    const costeo = [
      { id: 'personal', label: '1. PERSONAL', items: [
        { desc: 'Ingeniero Senior', qty: 1, days: si % 3 + 2, cost: 250000, _key: uid(), sale: 300000 },
        { desc: 'Ingeniero Junior', qty: 1, days: si % 3 + 1, cost: 150000, _key: uid(), sale: 180000 },
        { desc: 'Técnico', qty: 2, days: si % 3 + 1, cost: 80000, _key: uid(), sale: 96000 },
      ]},
      { id: 'equipos', label: '2. EQUIPOS', items: [
        { desc: 'Scanner PM8000', qty: 1, days: si % 2 + 1, cost: 60000, _key: uid(), sale: 72000 },
        { desc: 'Ultrasonido', qty: 1, days: si % 2 + 1, cost: 55000, _key: uid(), sale: 66000 },
      ]},
    ]

    // Build gantt tasks with ids and uid phase
    const ganttTasks = s.ganttTasks.map(t => ({
      id: uid(), name: t.name, phase: t.phase, startDay: t.startDay, endDay: t.endDay, dependsOn: null,
    }))

    const data = {
      quoteNumber: s.quoteNumber, quoteRev: '01', quoteDate: s.quoteDate,
      validUntil: '', currency: '$', contactPerson: s.contactPerson || '',
      company: 'Predikta Solutions SpA', companyAddr: 'Santiago, Chile',
      companyPhone: '+56 9 1234 5678', companyEmail: 'contacto@predikta.cl',
      companyResp: s.companyResp || '', companyRespSig: s.companyRespSig || '',
      client: s.clientName, clientAddr: '', clientPhone: '', clientEmail: '',
      clientResp: s.clientResp || '', clientRespSig: s.clientRespSig || '',
      headerClient: s.clientName, subheader: s.subheader,
      propuestaSections: sections,
      proposalItems: JSON.parse(JSON.stringify(s.proposalItems)),
      taxRate: 19,
      costeoMarkup: 20, costeoMarginMode: 'venta',
      costeo: costeo,
      costeoGroups: [
        { id: uid(), name: 'Personal', itemKeys: costeo[0].items.map(i => i._key) },
        { id: uid(), name: s.clientName.length > 15 ? s.clientName.substring(0, 15) : s.clientName, itemKeys: costeo[1].items.map(i => i._key) },
      ],
      printSections: { economia: true, gantt: true },
      ganttPhases: ['CAPTURA DE DATOS', 'ANÁLISIS DE DATOS'],
      ganttUnit: 'day', ganttSpan: Math.max(14, ...ganttTasks.map(t => t.endDay)),
      ganttTasks,
      proposalStatus: s.proposalStatus,
      awardAmount: s.awardAmount || null,
      projectNotes: '',
    }
    sections.forEach(sec => { data.printSections[sec.id] = true })

    const key = 'presto_' + s.quoteNumber.replace(/\//g, '_')
    localStorage.setItem(key, JSON.stringify(data))
  })

  // Create presto_list
  const list = samples.map(s => ({
    quoteNumber: s.quoteNumber, client: s.clientName, date: s.quoteDate,
    savedAt: new Date(now + samples.indexOf(s) * 1000).toISOString(),
  }))
  localStorage.setItem('presto_list', JSON.stringify(list))

  if (state.dbConnected) {
    for (const c of sampleClients) await pb.saveClient(c).catch(() => {})
    for (const item of sampleCatalog) await pb.saveCatalogItem(item).catch(() => {})
    for (const s of samples) {
      const key = 'presto_' + s.quoteNumber.replace(/\//g, '_')
      const data = JSON.parse(localStorage.getItem(key))
      if (data) await pb.saveQuote(data).catch(() => {})
    }
  }

  loadHistorial()
  loadClients()
  loadCatalog()
  loadDashboardData()
  toast('Datos de ejemplo cargados ✓')
}
function loadClients() {
  if (state.dbConnected) {
    pb.getClients().then(items => { state.clients = items.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')) }).catch(() => {
      state.clients = JSON.parse(localStorage.getItem('presto_clients') || '[]')
    })
  } else {
    state.clients = JSON.parse(localStorage.getItem('presto_clients') || '[]')
  }
}
async function saveClient(client) {
  if (state.dbConnected) {
    try {
      const saved = await pb.saveClient(client)
      if (saved && saved.id && saved.id !== client.id) client.id = saved.id
      loadClients()
    } catch { fallbackSaveClient(client) }
  } else { fallbackSaveClient(client) }
}
function fallbackSaveClient(client) {
  const list = JSON.parse(localStorage.getItem('presto_clients') || '[]')
  const idx = list.findIndex(c => c.id === client.id)
  if (idx >= 0) { list[idx] = client } else { list.push(client) }
  localStorage.setItem('presto_clients', JSON.stringify(list))
  loadClients()
  toast('Cliente guardado ✓')
}
// Igual que con las propuestas: primero el servidor, después la lista. Antes
// no se recargaba nada al borrar con éxito y el registro seguía en pantalla.
async function deleteClient(id) {
  if (!state.dbConnected) { fallbackDeleteClient(id); return }
  try { await pb.deleteClient(id) } catch (_) { fallbackDeleteClient(id); return }
  loadClients()
  toast('Cliente eliminado ✓')
}
function fallbackDeleteClient(id) {
  const list = JSON.parse(localStorage.getItem('presto_clients') || '[]')
  localStorage.setItem('presto_clients', JSON.stringify(list.filter(c => c.id !== id)))
  loadClients()
  toast('Cliente eliminado ✓')
}
function loadCatalog() {
  if (state.dbConnected) {
    pb.getCatalog().then(items => { state.catalog = items.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')) }).catch(() => {
      state.catalog = JSON.parse(localStorage.getItem('presto_catalog') || '[]')
    })
  } else {
    state.catalog = JSON.parse(localStorage.getItem('presto_catalog') || '[]')
  }
}
async function saveCatalogItem(item) {
  if (state.dbConnected) {
    try {
      const saved = await pb.saveCatalogItem(item)
      if (saved && saved.id && saved.id !== item.id) item.id = saved.id
      loadCatalog()
    } catch { fallbackSaveCatalogItem(item) }
  } else { fallbackSaveCatalogItem(item) }
}
function fallbackSaveCatalogItem(item) {
  const list = JSON.parse(localStorage.getItem('presto_catalog') || '[]')
  const idx = list.findIndex(c => c.id === item.id)
  if (idx >= 0) { list[idx] = item } else { list.push(item) }
  localStorage.setItem('presto_catalog', JSON.stringify(list))
  loadCatalog()
  toast('Producto guardado ✓')
}
async function deleteCatalogItem(id) {
  if (!state.dbConnected) { fallbackDeleteCatalogItem(id); return }
  try { await pb.deleteCatalogItem(id) } catch (_) { fallbackDeleteCatalogItem(id); return }
  loadCatalog()
  toast('Producto eliminado ✓')
}
function fallbackDeleteCatalogItem(id) {
  const list = JSON.parse(localStorage.getItem('presto_catalog') || '[]')
  localStorage.setItem('presto_catalog', JSON.stringify(list.filter(c => c.id !== id)))
  loadCatalog()
  toast('Producto eliminado ✓')
}
function addPropuestaSection() {
  const n = state.propuestaSections.length + 1
  state.propuestaSections.push({ id: uid(), label: `SECCIÓN ${String(n).padStart(2, '0')}`, content: '' })
}
function removePropuestaSection(id) {
  state.propuestaSections = state.propuestaSections.filter(s => s.id !== id)
}
function movePropuestaSection(fromIdx, toIdx) {
  const arr = state.propuestaSections
  if (fromIdx < 0 || fromIdx >= arr.length || toIdx < 0 || toIdx >= arr.length) return
  const [item] = arr.splice(fromIdx, 1)
  arr.splice(toIdx, 0, item)
}

function syncPropuestaSections() {
  const oldKeys = ['presentacion', 'servicio', 'objetivo', 'alcance', 'ventajas', 'notes', 'entregables']
  state.propuestaSections.forEach((s, i) => {
    if (i < oldKeys.length && state[oldKeys[i]] !== undefined && !s.content) {
      s.content = state[oldKeys[i]] || ''
    }
    if (i < oldKeys.length) state[oldKeys[i]] = s.content
  })
}

function addGanttTask(phase) {
  const p = phase || (state.ganttPhases.length ? state.ganttPhases[0] : '')
  const last = state.ganttTasks.reduce((m, t) => Math.max(m, t.endDay), 0)
  state.ganttTasks.push({ id: uid(), name: '', phase: p, startDay: last + 1, endDay: last + 2, dependsOn: null })
  syncGanttSpan(true)
}
function removeGanttTask(id) {
  state.ganttTasks = state.ganttTasks.filter(t => t.id !== id)
  state.ganttTasks.forEach(t => { if (t.dependsOn === id) t.dependsOn = null })
  syncGanttSpan(true)
}
function recalcGanttDeps() {
  state.ganttTasks.forEach(t => {
    if (!t.dependsOn) return
    const parent = state.ganttTasks.find(x => x.id === t.dependsOn)
    if (!parent || !parent.endDay) return
    const minStart = parent.endDay + 1
    if (!t.startDay || t.startDay < minStart) t.startDay = minStart
    if (!t.endDay || t.endDay < t.startDay) t.endDay = t.startDay + 1
  })
}
function addGanttPhase() {
  let n = state.ganttPhases.length + 1
  while (state.ganttPhases.includes(`FASE ${String(n).padStart(2, '0')}`)) n++
  state.ganttPhases.push(`FASE ${String(n).padStart(2, '0')}`)
}
// Las tareas cuelgan de su sección por el NOMBRE, así que renombrar tiene que
// arrastrarlas. Antes el input escribía el nombre nuevo solo en la sección y
// sus tareas quedaban apuntando al viejo: dejaban de verse. Ponerle el nombre
// de otra sección que ya existe UNE las dos: es la forma de devolver a su lugar
// las tareas que el editor viejo dejó colgando de un nombre a medio escribir
// (hay propuestas con una sección «i» que era «INFORME FINAL»). Devuelve false
// si el nombre no se aceptó (vacío) para que el input vuelva atrás.
function renameGanttPhase(idx, name) {
  const old = state.ganttPhases[idx]
  const nuevo = (name || '').trim()
  if (!nuevo) return false
  if (nuevo === old) return true
  state.ganttTasks.forEach(t => { if (t.phase === old) t.phase = nuevo })
  if (state.ganttPhases.some((p, i) => i !== idx && p === nuevo)) {
    state.ganttPhases.splice(idx, 1)
    toast(`Tareas movidas a «${nuevo}»`)
  } else {
    state.ganttPhases[idx] = nuevo
  }
  return true
}
function removeGanttPhase(idx) {
  const phase = state.ganttPhases[idx]
  if (phase === undefined) return
  const n = state.ganttTasks.filter(t => t.phase === phase).length
  if (n && !confirm(`La sección «${phase}» tiene ${n} tarea(s). ¿Eliminarla junto con sus tareas?`)) return
  state.ganttPhases.splice(idx, 1)
  state.ganttTasks = state.ganttTasks.filter(t => t.phase !== phase)
}
function syncGanttSpan(force) {
  const max = state.ganttTasks.reduce((m, t) => Math.max(m, t.endDay || 0), 0)
  if (!max) { state.ganttSpan = 14; return }
  if (force || max > state.ganttSpan) {
    state.ganttSpan = max
  }
}
function trimGanttTasks(span) {
  const lost = state.ganttTasks.filter(t => (t.startDay || 0) > span || (t.endDay || 0) > span)
  if (lost.length && !confirm(`${lost.length} tarea(s) fuera del rango visual se perderán. ¿Continuar?`)) return false
  state.ganttTasks = state.ganttTasks.filter(t => (t.startDay || 0) <= span && (t.endDay || 0) <= span)
  state.ganttSpan = span
  return true
}

// --- Catálogo → propuesta económica ---

function addCatalogItemToProposal(item) {
  const row = { desc: item.name, qty: 1, price: Number(item.price) || 0 }
  // La tabla siempre arranca con una fila vacía: se ocupa esa en vez de dejarla colgando.
  const only = state.proposalItems.length === 1 ? state.proposalItems[0] : null
  if (only && !only.desc && !Number(only.price)) Object.assign(only, row)
  else state.proposalItems.push(row)
}

// --- Historial de versiones (las escribe el servidor en cada guardado) ---

async function listVersions() {
  if (!state.dbConnected || !state.quoteId) return []
  return await pb.getQuoteVersions(state.quoteId)
}

// Restaurar trae de vuelta el CONTENIDO: textos, ítems, costeo, Gantt, datos
// del cliente. El N.º, el estado del flujo y las aprobaciones siguen como
// están: volver a una redacción anterior no deshace una aprobación ni un envío.
// Restaurar también es un guardado, así que se puede deshacer restaurando la
// versión de antes.
async function restoreVersion(versionId) {
  const v = await pb.getQuoteVersion(versionId)
  applyContent(v.data || {})
  return await persistBudget('Versión del ' + hhmm(v.savedAt || v.created) + ' restaurada ✓')
}

// --- Finanzas: proyectos / ingresos / egresos ---

function loadProyectos() {
  if (state.dbConnected) {
    pb.getProyectos().then(items => { state.proyectos = items.slice().sort((a, b) => (b.startDate || '').localeCompare(a.startDate || '')) }).catch(() => {
      state.proyectos = JSON.parse(localStorage.getItem('presto_proyectos') || '[]')
    })
  } else {
    state.proyectos = JSON.parse(localStorage.getItem('presto_proyectos') || '[]')
  }
}
async function saveProyecto(proyecto) {
  const prev = state.proyectos.find(p => p.id === proyecto.id)
  const data = withTrace(proyecto, prev)
  if (state.dbConnected) {
    try {
      const saved = await pb.saveProyecto(data)
      if (saved && saved.id && saved.id !== data.id) data.id = saved.id
      loadProyectos()
    } catch { fallbackSaveProyecto(data) }
  } else { fallbackSaveProyecto(data) }
}
function fallbackSaveProyecto(proyecto) {
  const list = JSON.parse(localStorage.getItem('presto_proyectos') || '[]')
  const idx = list.findIndex(p => p.id === proyecto.id)
  if (idx >= 0) { list[idx] = proyecto } else { list.push(proyecto) }
  localStorage.setItem('presto_proyectos', JSON.stringify(list))
  loadProyectos()
  toast('Proyecto guardado ✓')
}
async function deleteProyecto(id) {
  if (!state.dbConnected) { fallbackDeleteProyecto(id); return }
  try { await pb.deleteProyecto(id) } catch (_) { fallbackDeleteProyecto(id); return }
  loadProyectos()
  toast('Proyecto eliminado ✓')
}
function fallbackDeleteProyecto(id) {
  const list = JSON.parse(localStorage.getItem('presto_proyectos') || '[]')
  localStorage.setItem('presto_proyectos', JSON.stringify(list.filter(p => p.id !== id)))
  loadProyectos()
  toast('Proyecto eliminado ✓')
}

function loadIngresos() {
  if (state.dbConnected) {
    pb.getIngresos().then(items => { state.ingresos = items.slice().sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')) }).catch(() => {
      state.ingresos = JSON.parse(localStorage.getItem('presto_ingresos') || '[]')
    })
  } else {
    state.ingresos = JSON.parse(localStorage.getItem('presto_ingresos') || '[]')
  }
}
async function saveIngreso(ingreso) {
  if (state.dbConnected) {
    try {
      const saved = await pb.saveIngreso(ingreso)
      if (saved && saved.id && saved.id !== ingreso.id) ingreso.id = saved.id
      loadIngresos()
    } catch { fallbackSaveIngreso(ingreso) }
  } else { fallbackSaveIngreso(ingreso) }
}
function fallbackSaveIngreso(ingreso) {
  const list = JSON.parse(localStorage.getItem('presto_ingresos') || '[]')
  const idx = list.findIndex(r => r.id === ingreso.id)
  if (idx >= 0) { list[idx] = ingreso } else { list.push(ingreso) }
  localStorage.setItem('presto_ingresos', JSON.stringify(list))
  loadIngresos()
  toast('Ingreso guardado ✓')
}
async function deleteIngreso(id) {
  if (!state.dbConnected) { fallbackDeleteIngreso(id); return }
  try { await pb.deleteIngreso(id) } catch (_) { fallbackDeleteIngreso(id); return }
  loadIngresos()
  toast('Ingreso eliminado ✓')
}
function fallbackDeleteIngreso(id) {
  const list = JSON.parse(localStorage.getItem('presto_ingresos') || '[]')
  localStorage.setItem('presto_ingresos', JSON.stringify(list.filter(r => r.id !== id)))
  loadIngresos()
  toast('Ingreso eliminado ✓')
}

function loadEgresos() {
  if (state.dbConnected) {
    pb.getEgresos().then(items => { state.egresos = items.slice().sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')) }).catch(() => {
      state.egresos = JSON.parse(localStorage.getItem('presto_egresos') || '[]')
    })
  } else {
    state.egresos = JSON.parse(localStorage.getItem('presto_egresos') || '[]')
  }
}
async function saveEgreso(egreso) {
  if (state.dbConnected) {
    try {
      const saved = await pb.saveEgreso(egreso)
      if (saved && saved.id && saved.id !== egreso.id) egreso.id = saved.id
      loadEgresos()
    } catch { fallbackSaveEgreso(egreso) }
  } else { fallbackSaveEgreso(egreso) }
}
function fallbackSaveEgreso(egreso) {
  const list = JSON.parse(localStorage.getItem('presto_egresos') || '[]')
  const idx = list.findIndex(r => r.id === egreso.id)
  if (idx >= 0) { list[idx] = egreso } else { list.push(egreso) }
  localStorage.setItem('presto_egresos', JSON.stringify(list))
  loadEgresos()
  toast('Egreso guardado ✓')
}
async function deleteEgreso(id) {
  if (!state.dbConnected) { fallbackDeleteEgreso(id); return }
  try { await pb.deleteEgreso(id) } catch (_) { fallbackDeleteEgreso(id); return }
  loadEgresos()
  toast('Egreso eliminado ✓')
}
function fallbackDeleteEgreso(id) {
  const list = JSON.parse(localStorage.getItem('presto_egresos') || '[]')
  localStorage.setItem('presto_egresos', JSON.stringify(list.filter(r => r.id !== id)))
  loadEgresos()
  toast('Egreso eliminado ✓')
}

function crearProyectoDesdePropuesta(qn) {
  const item = state.budgetList.find(x => x.quoteNumber === qn)
  if (!item) return
  const now = new Date().toISOString()
  const user = who()
  const proyecto = {
    id: Date.now() + '',
    nombre: (item.client && item.client !== '-' ? item.client + ' — ' : '') + item.quoteNumber,
    quoteNumber: item.quoteNumber,
    clientName: item.client === '-' ? '' : item.client,
    status: 'activo',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    awardAmount: item.awardAmount || null,
    currency: item.currency || '$',
    responsable: '',
    notes: '',
    createdBy: user, createdAt: now, updatedBy: user, updatedAt: now,
  }
  saveProyecto(proyecto)
  state.activeSection = 'proyectos'
  toast('Proyecto creado desde ' + qn + ' ✓')
}

function proyectoStats(proyectoId) {
  const recibido = sumByCurrency(state.ingresos.filter(r => r.proyectoId === proyectoId && r.estado === 'recibido'), 'monto')
  const pagado = sumByCurrency(state.egresos.filter(r => r.proyectoId === proyectoId && r.estado === 'pagado'), 'monto')
  return { recibido, pagado }
}

function exportIngresosExcel() {
  if (!state.ingresos.length) { alert('No hay datos.'); return }
  const data = [['Fecha', 'Proyecto', 'Concepto', 'Monto', 'Moneda', 'Estado', 'Método', 'Comprobante', 'Nota']]
  state.ingresos.forEach(r => data.push([r.fecha || '', r.proyecto || '', r.concepto || '', Number(r.monto) || 0, r.moneda || '$', r.estado || '', r.metodo || '', r.comprobante || '', r.nota || '']))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Ingresos')
  XLSX.writeFile(wb, 'Ingresos.xlsx')
}

function exportEgresosExcel() {
  if (!state.egresos.length) { alert('No hay datos.'); return }
  const data = [['Fecha', 'Proyecto', 'Categoría', 'Concepto', 'Monto', 'Moneda', 'Beneficiario', 'Estado', 'Comprobante', 'Nota']]
  state.egresos.forEach(r => data.push([r.fecha || '', r.proyecto || '', r.categoria || '', r.concepto || '', Number(r.monto) || 0, r.moneda || '$', r.beneficiario || '', r.estado || '', r.comprobante || '', r.nota || '']))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Egresos')
  XLSX.writeFile(wb, 'Egresos.xlsx')
}

function exportCosteoExcel() {
  const wsData = [
    ['COSTEO INTERNO', state.quoteNumber],
    ['Cliente:', state.clientName],
    [],
    ['GRUPO', 'TOTAL'],
  ]
  state.costeoGroups.forEach(g => {
    if (!g.itemKeys.length) return
    wsData.push([g.name, fmtAmount(groupTotal(g.id), state.currency)])
  })
  wsData.push([])
  wsData.push(['TOTAL GENERAL', fmtAmount(groupsTotal(), state.currency)])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wsData), 'Costeo')
  XLSX.writeFile(wb, `Costeo_${state.quoteNumber.replace(/\//g, '-')}.xlsx`)
}

function exportHistorialExcel() {
  if (!state.budgetList.length) { alert('No hay datos.'); return }
  const data = [['N° Presupuesto', 'Cliente', 'Fecha', 'Total']]
  state.budgetList.forEach(i => data.push([i.quoteNumber, i.client, i.date, i.total]))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Historial')
  XLSX.writeFile(wb, 'Historial_Presupuestos.xlsx')
}

/**
 * Único punto de entrada a las secciones: el riel de escritorio, la barra
 * inferior del teléfono y la página «Más» pasan los tres por acá. Entrar a
 * Propuestas siempre cae en la lista, nunca en el formulario que quedó abierto
 * la vez anterior.
 */
function goSection(id) {
  state.activeSection = id
  if (id === 'propuestas') state.activeTab = 'historial'
}

export function usePresupuesto() {
  return {
    state,
    goSection,
    computed: {
      proposalSubtotal, proposalTax, proposalTotal,
      costeoTotalCost, costeoTotalSale, costeoUtilidad, costeoMargen, selectedCount,
      finKpis, aprobacionInfo, aprobadaInternamente, isAdmin,
    },
    fmt,
    fmtMoney, fmtMulti,
    addProposalItem, removeProposalItem,
    recalcSales, addCosteoCategory, removeCosteoCategory, addCosteoItem, removeCosteoItem,
    addCosteoGroup, removeCosteoGroup, addItemToGroup, removeItemFromGroup, findItemByKey, groupTotal,
    syncSelectedToProposal,
    addGanttTask, removeGanttTask, addGanttPhase, renameGanttPhase, removeGanttPhase, syncGanttSpan, trimGanttTasks, recalcGanttDeps,
    addPropuestaSection, removePropuestaSection, movePropuestaSection, syncPropuestaSections,
    addCatalogItemToProposal, listVersions, restoreVersion, isFinalNumber,
    saveBudget, loadBudget, loadBudgetByNum, deleteBudget, loadHistorial, loadDashboardData, seedSampleData, loadClients, saveClient, deleteClient, loadCatalog, saveCatalogItem, deleteCatalogItem,
    aprobarPropuesta, enviarARevision, solicitarCambios, enviarACliente, rectificarPropuesta, reenviarACliente, adjudicarPropuesta, rechazarPropuesta,
    loadProyectos, saveProyecto, deleteProyecto,
    loadIngresos, saveIngreso, deleteIngreso,
    loadEgresos, saveEgreso, deleteEgreso,
    crearProyectoDesdePropuesta, proyectoStats,
    exportCosteoExcel, exportHistorialExcel, exportIngresosExcel, exportEgresosExcel, toast, dbLogin, resetBudget,
  }
}
