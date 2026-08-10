import { reactive, computed, toRefs } from 'vue'
import * as XLSX from 'xlsx'
import * as pb from './pocketbase.js'

let _key = 0
const uid = () => ++_key
let toastTimer = null

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

  quoteNumber: 'CT-PS-001-2026',
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
    migrateLocalToPB()
    dedupeQuotes()
    migrarEstadosViejos()
  } catch {
    pb.logoutUser()
    state.user = null
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

async function dedupeQuotes() {
  if (!state.dbConnected) return
  try {
    const quotes = await pb.getQuotes()
    const byNum = {}
    quotes.forEach(q => {
      if (!q.quoteNumber) return
      ;(byNum[q.quoteNumber] = byNum[q.quoteNumber] || []).push(q)
    })
    const score = r => {
      let s = 0
      ;(r.proposalItems || []).forEach(i => { if (Number(i.price) > 0) s += 2 })
      ;(r.propuestaSections || []).forEach(sec => { if (sec.content) s += 2 })
      if (r.awardAmount) s += 1
      if (r.proposalStatus) s += 1
      return s
    }
    let removed = 0
    for (const group of Object.values(byNum)) {
      if (group.length < 2) continue
      group.sort((a, b) => score(b) - score(a))
      for (const dup of group.slice(1)) {
        await pb.deleteQuote(dup.id).catch(() => {})
        removed++
      }
    }
    if (removed) { loadHistorial(); loadDashboardData() }
  } catch (_) { /* best-effort */ }
}

async function migrateLocalToPB() {
  try {
    const [pbQuotes, pbClients, pbCatalog] = await Promise.all([
      pb.getQuotes().catch(() => []),
      pb.getClients().catch(() => []),
      pb.getCatalog().catch(() => []),
    ])
    const pbQuoteNums = new Set(pbQuotes.map(q => q.quoteNumber).filter(Boolean))
    const pbClientKeys = new Set(pbClients.map(c => c.name + '|' + (c.email || '')))
    const pbCatalogKeys = new Set(pbCatalog.map(c => c.name))

    // Migrate local budgets not in PB
    const localList = JSON.parse(localStorage.getItem('presto_list') || '[]')
    for (const item of localList) {
      if (pbQuoteNums.has(item.quoteNumber)) continue
      const key = 'presto_' + item.quoteNumber.replace(/\//g, '_')
      const data = JSON.parse(localStorage.getItem(key))
      if (data) await pb.saveQuote(data).catch(() => {})
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

function generateQuoteNumber() {
  const saved = JSON.parse(localStorage.getItem('presto_counter') || '0')
  const n = saved + 1
  state.quoteNumber = `CT-PS-${String(n).padStart(3, '0')}-${new Date().getFullYear()}`
  localStorage.setItem('presto_counter', JSON.stringify(n))
}

function resetBudget() {
  const defaults = {
    quoteNumber: '', quoteRev: '01', quoteDate: new Date().toISOString().slice(0, 10), validUntil: '',
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
    createdBy: '',
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
  generateQuoteNumber()
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

function saveBudget() {
  persistBudget()
  generateQuoteNumber()
}

function persistBudget() {
  const key = 'presto_' + state.quoteNumber.replace(/\//g, '_')
  const prevLS = JSON.parse(localStorage.getItem(key) || 'null')
  const data = withTrace(collectData(), prevLS)
  state.createdBy = data.createdBy
  let list = JSON.parse(localStorage.getItem('presto_list') || '[]')
  if (!list.find(x => x.quoteNumber === data.quoteNumber)) {
    list.push({ quoteNumber: data.quoteNumber, client: data.clientName || data.client, date: data.quoteDate, savedAt: new Date().toISOString() })
    localStorage.setItem('presto_list', JSON.stringify(list))
  }
  localStorage.setItem(key, JSON.stringify(data))
  if (state.dbConnected) {
    pb.getQuoteByNum(data.quoteNumber)
      .then(prev => {
        const final = withTrace(data, prev)
        localStorage.setItem(key, JSON.stringify(final))
        return pb.saveQuote(final).catch(() => {})
      })
      .catch(() => pb.saveQuote(data).catch(() => {}))
      .finally(() => { loadHistorial(); loadDashboardData() })
  } else {
    loadHistorial()
    loadDashboardData()
  }
  toast('Guardado ✓')
}

function aprobarPropuesta() {
  const user = who()
  if (state.proposalStatus !== 'en_revision') { toast('Solo se puede aprobar cuando está en revisión'); return }
  if (state.aprobaciones.some(a => a.by === user)) { toast('Ya aprobaste esta propuesta'); return }
  if (state.createdBy && state.createdBy === user) { toast('El creador no puede aprobar su propia propuesta'); return }
  state.aprobaciones.push({ by: user, at: new Date().toISOString() })
  if (aprobacionInfo.value.count >= 2) {
    state.proposalStatus = 'aprobada'
    toast('Propuesta aprobada por la revisión interna ✓')
  } else {
    toast('Aprobación registrada (' + aprobacionInfo.value.count + '/2)')
  }
  persistBudget()
}

// --- Transiciones de estado ---

function enviarARevision() {
  const desde = state.proposalStatus
  if (desde !== 'borrador' && desde !== 'modificacion' && desde !== 'rectificacion') return
  if (desde === 'modificacion' || desde === 'rectificacion') state.aprobaciones = []
  state.proposalStatus = 'en_revision'
  persistBudget()
  toast('Propuesta enviada a revisión interna ✓')
}

function solicitarCambios() {
  if (state.proposalStatus !== 'en_revision') return
  state.aprobaciones = []
  state.proposalStatus = 'modificacion'
  persistBudget()
  toast('Se solicitaron cambios al creador')
}

function enviarACliente() {
  if (state.proposalStatus !== 'aprobada') return
  state.ultimoTotalEnviado = proposalTotal.value
  state.proposalStatus = 'enviada'
  persistBudget()
  toast('Propuesta enviada al cliente ✓')
}

function rectificarPropuesta() {
  if (state.proposalStatus !== 'enviada') return
  state.proposalStatus = 'rectificacion'
  persistBudget()
  toast('Rectificación del cliente registrada')
}

async function reenviarACliente() {
  if (state.proposalStatus !== 'rectificacion') return
  const totalActual = proposalTotal.value
  let totalPrev = null
  if (state.dbConnected) {
    try {
      const prev = await pb.getQuoteByNum(state.quoteNumber)
      if (prev) totalPrev = (prev.proposalItems || []).reduce((s, i) => s + (parseFloat(i.qty) || 0) * (parseFloat(i.price) || 0), 0)
    } catch (_) {}
  }
  if (totalPrev === null) {
    const key = 'presto_' + state.quoteNumber.replace(/\//g, '_')
    const prev = JSON.parse(localStorage.getItem(key) || 'null')
    if (prev) totalPrev = (prev.proposalItems || []).reduce((s, i) => s + (parseFloat(i.qty) || 0) * (parseFloat(i.price) || 0), 0)
  }
  if (totalPrev !== null && Math.abs(totalActual - totalPrev) > 0.01) {
    state.aprobaciones = []
    state.proposalStatus = 'en_revision'
    persistBudget()
    toast('El monto cambió — requiere nueva revisión interna')
    return
  }
  state.proposalStatus = 'enviada'
  persistBudget()
  toast('Propuesta reenviada al cliente ✓')
}

function adjudicarPropuesta() {
  if (state.proposalStatus !== 'enviada') return
  state.proposalStatus = 'adjudicada'
  persistBudget()
  toast('Propuesta adjudicada ✓')
}

function rechazarPropuesta() {
  if (state.proposalStatus !== 'enviada') return
  state.proposalStatus = 'rechazada'
  persistBudget()
  toast('Propuesta rechazada')
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

async function loadBudgetByNum(qn) {
  let data = null
  if (state.dbConnected) {
    try {
      const pbRecord = await pb.getQuoteByNum(qn)
      if (pbRecord) {
        data = { ...pbRecord }
        if (data.clientName && !data.client) data.client = data.clientName
      }
    } catch (_) { /* fallback to localStorage */ }
  }
  if (!data) {
    const key = 'presto_' + qn.replace(/\//g, '_')
    data = JSON.parse(localStorage.getItem(key))
  }
  if (!data) return
  Object.assign(state, {
    quoteNumber: data.quoteNumber || '',
    quoteRev: data.quoteRev || '01',
    quoteDate: data.quoteDate || '',
    validUntil: data.validUntil || '',
    currency: data.currency || '$',
    contactPerson: data.contactPerson || '',
    proposalStatus: data.proposalStatus || 'borrador',
    awardAmount: data.awardAmount || null,
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
    taxRate: data.taxRate || 19,
    aprobaciones: (data.aprobaciones || []).map(a => ({ ...a })),
    createdBy: data.createdBy || '',
    ultimoTotalEnviado: data.ultimoTotalEnviado || 0,
    costeoMarkup: data.costeoMarkup || 20,
    costeoMarginMode: data.costeoMarginMode || 'venta',
  })
  // migrate old budgets without propuestaSections
  if (data.propuestaSections && data.propuestaSections.length) {
    state.propuestaSections = data.propuestaSections.map(s => ({ ...s }))
  } else {
    const oldLabels = ['PRESENTACIÓN', 'SERVICIO', 'OBJETIVO', 'ALCANCE DEL SERVICIO', 'VENTAJAS Y DIFERENCIADORES', 'NOTAS / CONDICIONES', 'ENTREGABLES']
    const oldKeys = ['presentacion', 'servicio', 'objetivo', 'alcance', 'ventajas', 'notes', 'entregables']
    state.propuestaSections = oldLabels.map((l, i) => ({ id: uid(), label: l, content: data[oldKeys[i]] || '' }))
  }
  state.printSections = data.printSections || {}
  // ensure each section has a printSection entry
  state.propuestaSections.forEach(s => {
    if (state.printSections[s.id] === undefined) state.printSections[s.id] = true
  })
  if (!state.proposalItems.length) addProposalItem()
  if (data.costeo) {
    state.costeoCategories.forEach(cat => {
      const saved = data.costeo.find(c => c.id === cat.id)
      if (saved && saved.items.length) cat.items = saved.items.map(i => ({ ...i, _key: uid() }))
    })
  }
  if (data.costeoGroups) {
    state.costeoGroups = data.costeoGroups.map(g => ({ ...g, id: uid() }))
  }
  if (data.ganttTasks) {
    state.ganttPhases = data.ganttPhases && data.ganttPhases.length ? [...data.ganttPhases] : ['CAPTURA DE DATOS', 'ANÁLISIS DE DATOS']
    state.ganttUnit = data.ganttUnit || 'day'
    state.ganttSpan = data.ganttSpan || 14
    state.ganttTasks = data.ganttTasks.map(t => ({ ...t, id: uid() }))
  }
  state.loadVersion++
  state.activeTab = 'propuesta'
}

async function loadBudget() {
  const list = JSON.parse(localStorage.getItem('presto_list') || '[]')
  if (!list.length) { alert('No hay presupuestos guardados.'); return }
  const msg = 'Presupuestos guardados:\n' + list.map((x, i) => `${i + 1}. ${x.quoteNumber} - ${x.client || '?'} (${x.date})`).join('\n') + '\n\nN° a cargar:'
  const idx = parseInt(prompt(msg)) - 1
  if (!isNaN(idx) && idx >= 0 && idx < list.length) await loadBudgetByNum(list[idx].quoteNumber)
}

function deleteBudget(qn) {
  if (!confirm(`¿Eliminar ${qn}?`)) return
  localStorage.removeItem('presto_' + qn.replace(/\//g, '_'))
  let list = JSON.parse(localStorage.getItem('presto_list') || '[]')
  list = list.filter(x => x.quoteNumber !== qn)
  localStorage.setItem('presto_list', JSON.stringify(list))
  if (state.dbConnected) pb.deleteQuoteByNum(qn).catch(() => {})
  loadHistorial()
  loadDashboardData()
}

function loadHistorial() {
  if (state.dbConnected) {
    pb.getQuotes().then(quotes => {
      const list = quotes.map(q => {
        const status = normalizeStatus(q.proposalStatus)
        const total = (q.proposalItems || []).reduce((s, i) => s + (parseFloat(i.qty) || 0) * (parseFloat(i.price) || 0), 0)
        return {
          quoteNumber: q.quoteNumber, client: q.clientName || q.client || '-', date: q.quoteDate || '-',
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
      quoteNumber: 'CT-PS-001-2026', quoteDate: '2026-07-15', clientName: 'Constructora Los Andes',
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
      quoteNumber: 'CT-PS-002-2026', quoteDate: '2026-07-20', clientName: 'Mina El Teniente',
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
      quoteNumber: 'CT-PS-003-2026', quoteDate: '2026-07-10', clientName: 'Edifica SpA',
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
      quoteNumber: 'CT-PS-004-2026', quoteDate: '2026-07-22', clientName: 'Puentes del Sur',
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
      quoteNumber: 'CT-PS-005-2026', quoteDate: '2026-07-18', clientName: 'Hormigones Nacionales',
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
      quoteNumber: 'CT-PS-006-2026', quoteDate: '2026-07-05', clientName: 'Arquidiseño Ltda',
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

  // Backup current counter and set to 6
  const savedCounter = JSON.parse(localStorage.getItem('presto_counter') || '0')
  localStorage.setItem('presto_counter', '6')
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

  // Restore counter (set to last number so new quotes continue from 7)
  localStorage.setItem('presto_counter', JSON.stringify(Math.max(6, savedCounter)))

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
function deleteClient(id) {
  if (state.dbConnected) {
    pb.deleteClient(id).catch(() => fallbackDeleteClient(id))
  } else { fallbackDeleteClient(id) }
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
function deleteCatalogItem(id) {
  if (state.dbConnected) {
    pb.deleteCatalogItem(id).catch(() => fallbackDeleteCatalogItem(id))
  } else { fallbackDeleteCatalogItem(id) }
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
  const n = state.ganttPhases.length + 1
  state.ganttPhases.push(`FASE ${String(n).padStart(2, '0')}`)
}
function removeGanttPhase(idx) {
  const phase = state.ganttPhases[idx]
  if (!phase) return
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
function deleteProyecto(id) {
  if (state.dbConnected) {
    pb.deleteProyecto(id).catch(() => fallbackDeleteProyecto(id))
  } else { fallbackDeleteProyecto(id) }
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
function deleteIngreso(id) {
  if (state.dbConnected) {
    pb.deleteIngreso(id).catch(() => fallbackDeleteIngreso(id))
  } else { fallbackDeleteIngreso(id) }
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
function deleteEgreso(id) {
  if (state.dbConnected) {
    pb.deleteEgreso(id).catch(() => fallbackDeleteEgreso(id))
  } else { fallbackDeleteEgreso(id) }
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

export function usePresupuesto() {
  return {
    state,
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
    addGanttTask, removeGanttTask, addGanttPhase, removeGanttPhase, syncGanttSpan, trimGanttTasks, recalcGanttDeps,
    addPropuestaSection, removePropuestaSection, movePropuestaSection, syncPropuestaSections,
    saveBudget, loadBudget, loadBudgetByNum, deleteBudget, loadHistorial, loadDashboardData, seedSampleData, loadClients, saveClient, deleteClient, loadCatalog, saveCatalogItem, deleteCatalogItem,
    aprobarPropuesta, enviarARevision, solicitarCambios, enviarACliente, rectificarPropuesta, reenviarACliente, adjudicarPropuesta, rechazarPropuesta,
    loadProyectos, saveProyecto, deleteProyecto,
    loadIngresos, saveIngreso, deleteIngreso,
    loadEgresos, saveEgreso, deleteEgreso,
    crearProyectoDesdePropuesta, proyectoStats,
    exportCosteoExcel, exportHistorialExcel, exportIngresosExcel, exportEgresosExcel, toast, dbLogin, resetBudget, generateQuoteNumber,
  }
}
