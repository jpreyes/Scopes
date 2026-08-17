<script setup>
import { ref, computed } from 'vue'
import { usePresupuesto } from '../stores/presupuesto.js'
const { state, saveProyecto, deleteProyecto, crearProyectoDesdePropuesta, proyectoStats, fmtMoney, fmtMulti } = usePresupuesto()

const view = ref('tabla')
const editingId = ref(null)
const form = ref(newProyecto())

function newProyecto() {
  return {
    nombre: '', quoteNumber: '', clientName: '', status: 'activo',
    startDate: new Date().toISOString().slice(0, 10), endDate: '',
    awardAmount: null, currency: '$', responsable: '', notes: '',
  }
}

const STATUS = [
  { id: 'activo', label: 'Activo', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  { id: 'en_pausa', label: 'En pausa', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  { id: 'finalizado', label: 'Finalizado', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  { id: 'cancelado', label: 'Cancelado', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
]

function statusInfo(s) { return STATUS.find(x => x.id === s) || STATUS[0] }
const byStatus = id => state.proyectos.filter(p => p.status === id)

function openAdd() { editingId.value = '__new__'; form.value = newProyecto() }
function openEdit(p) { editingId.value = p.id; form.value = { ...p } }
function cancelForm() { editingId.value = null }
function submitForm() {
  if (!form.value.nombre) return
  saveProyecto({ ...form.value, id: editingId.value === '__new__' ? Date.now() + '' : editingId.value })
  editingId.value = null
}
function confirmDelete(id) {
  if (confirm('¿Eliminar este proyecto? Los ingresos y egresos asociados se conservan.')) deleteProyecto(id)
}
function onQuoteChange() {
  const q = state.budgetList.find(x => x.quoteNumber === form.value.quoteNumber)
  if (!q) return
  form.value.clientName = q.client === '-' ? '' : q.client
  if (!form.value.nombre) form.value.nombre = q.client === '-' ? q.quoteNumber : q.client + ' — ' + q.quoteNumber
  if (q.awardAmount) form.value.awardAmount = q.awardAmount
  form.value.currency = q.currency || '$'
}

/**
 * Cambiar de estado sin arrastrar. `dragstart`/`drop` son HTML5 y no existen
 * en táctil, así que en un teléfono el kanban era decorativo: se veía, no se
 * podía usar. El selector queda también en escritorio, donde de todos modos es
 * menos trabajo que arrastrar una tarjeta entre cuatro columnas.
 */
function cambiarEstado(p, status) {
  if (!status || p.status === status) return
  saveProyecto({ ...p, status })
}

// --- Kanban drag ---
let kanbanDragId = null
function kanbanDragStart(e, id) {
  kanbanDragId = id
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', id)
}
function kanbanDrop(e, status) {
  e.preventDefault()
  const id = e.dataTransfer.getData('text/plain') || kanbanDragId
  const p = state.proyectos.find(x => x.id === id)
  if (p) cambiarEstado(p, status)
  kanbanDragId = null
}

// --- Calendario / timeline ---
const timeline = computed(() => {
  const withDates = state.proyectos.filter(p => p.startDate)
  if (!withDates.length) return null
  const DAY = 86400000
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const parse = s => { const d = new Date(s + 'T00:00:00'); return isNaN(d) ? null : d }
  let min = new Date(Math.min(...withDates.map(p => parse(p.startDate)).map(d => d.getTime())))
  let max = new Date(Math.max(...withDates.map(p => parse(p.endDate) || parse(p.startDate)).map(d => d.getTime())))
  if (max < today) max = today
  if (max.getTime() === min.getTime()) { max = new Date(min.getTime() + 30 * DAY) }
  const spanDays = Math.max(1, Math.round((max - min) / DAY))
  const monthTicks = []
  const cursor = new Date(min.getFullYear(), min.getMonth(), 1)
  while (cursor <= max) {
    monthTicks.push(new Date(cursor))
    cursor.setMonth(cursor.getMonth() + 1)
  }
  const fmtDay = d => String(d.getDate()).padStart(2, '0')
  const fmtMonth = d => ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][d.getMonth()]
  const projects = withDates.map(p => {
    const s = parse(p.startDate)
    const e = parse(p.endDate) || s
    const left = Math.max(0, Math.round((s - min) / DAY) / spanDays * 100)
    const width = Math.max(1.5, Math.round((e - s) / DAY) / spanDays * 100)
    return { p, left, width, startLabel: fmtDay(s) + ' ' + fmtMonth(s), endLabel: p.endDate ? fmtDay(e) + ' ' + fmtMonth(e) : '—' }
  })
  return {
    min, max, spanDays,
    monthTicks: monthTicks.map((m, i) => {
      const first = i === 0 ? min : m
      const next = i + 1 < monthTicks.length ? monthTicks[i + 1] : new Date(max.getTime() + 1)
      const left = Math.round((first - min) / DAY) / spanDays * 100
      const width = Math.max(2, Math.round((next - first) / DAY) / spanDays * 100)
      return { label: fmtMonth(m), left, width }
    }),
    projects,
  }
})

const calendar = computed(() => timeline.value?.projects || [])
const calendarTicks = computed(() => timeline.value?.monthTicks || [])
const hasCalendar = computed(() => !!timeline.value)
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between flex-wrap gap-2">
      <h1 class="text-lg font-bold text-text">Proyectos</h1>
      <div class="flex items-center gap-2">
        <div class="flex bg-surface border border-border rounded-lg p-0.5">
          <button v-for="v in [{ id: 'tabla', label: 'Tabla' }, { id: 'kanban', label: 'Kanban' }, { id: 'calendario', label: 'Calendario' }]" :key="v.id"
            @click="view = v.id"
            class="px-3 py-1 text-xs font-semibold rounded-md transition cursor-pointer"
            :class="view === v.id ? 'bg-primary text-white' : 'text-text-muted hover:text-text'">
            {{ v.label }}
          </button>
        </div>
        <button @click="openAdd" class="px-3 py-1.5 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition cursor-pointer">+ Nuevo proyecto</button>
      </div>
    </div>

    <!-- Form -->
    <div v-if="editingId !== null" class="bg-surface border border-border rounded-xl p-4 shadow-sm space-y-3">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input v-model="form.nombre" placeholder="Nombre del proyecto *" class="px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-primary bg-surface sm:col-span-2" />
        <select v-model="form.status" class="px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-primary bg-surface">
          <option v-for="s in STATUS" :key="s.id" :value="s.id">{{ s.label }}</option>
        </select>
        <select v-model="form.quoteNumber" @change="onQuoteChange" class="px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-primary bg-surface sm:col-span-2">
          <option value="">— Propuesta vinculada —</option>
          <option v-for="q in state.budgetList" :key="q.quoteNumber" :value="q.quoteNumber">
            {{ q.quoteNumber }} · {{ q.client }} · {{ q.statusLabel }}
          </option>
        </select>
        <input v-model="form.clientName" placeholder="Cliente" class="px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-primary bg-surface" />
        <input v-model="form.startDate" type="date" class="px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-primary bg-surface" />
        <input v-model="form.endDate" type="date" class="px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-primary bg-surface" />
        <input v-model.number="form.awardAmount" type="number" placeholder="Monto adjudicado" class="px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-primary bg-surface" />
        <select v-model="form.currency" class="px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-primary bg-surface">
          <option value="$">$</option>
          <option value="US$">US$</option>
          <option value="€">€</option>
          <option value="UF">UF</option>
        </select>
        <input v-model="form.responsable" placeholder="Responsable" class="px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-primary bg-surface" />
        <textarea v-model="form.notes" placeholder="Notas…" rows="2" class="px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-primary bg-surface sm:col-span-3 resize-none"></textarea>
      </div>
      <div class="flex gap-2">
        <button @click="submitForm" class="px-3 py-1.5 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition cursor-pointer">Guardar</button>
        <button @click="cancelForm" class="px-3 py-1.5 text-xs font-semibold text-text-muted border border-border rounded-lg hover:bg-bg-app transition cursor-pointer">Cancelar</button>
      </div>
    </div>

    <!-- Empty -->
    <div v-if="!state.proyectos.length" class="text-center py-16 text-text-dim">
      <p class="text-sm">No hay proyectos aún. Crea uno nuevo o conviértelo desde una propuesta adjudicada en Historial.</p>
    </div>

    <!-- VIEW: Tabla (cards) -->
    <template v-else-if="view === 'tabla'">
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        <div v-for="p in state.proyectos" :key="p.id"
          class="bg-surface border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0 flex-1">
              <p class="text-sm font-bold text-text truncate">{{ p.nombre }}</p>
              <p v-if="p.clientName" class="text-xs text-text-muted truncate">{{ p.clientName }}</p>
            </div>
            <div class="flex gap-1 shrink-0" @click.stop>
              <button @click="openEdit(p)" class="text-text-dim hover:text-text transition text-xs px-1 cursor-pointer" title="Editar">✎</button>
              <button @click="confirmDelete(p.id)" class="text-text-dim hover:text-danger transition text-xs px-1 cursor-pointer" title="Eliminar">✕</button>
            </div>
          </div>
          <div class="mt-2 flex items-center justify-between">
            <span class="inline-flex text-[9px] font-semibold px-2 py-0.5 rounded-full" :class="statusInfo(p.status).color">{{ statusInfo(p.status).label }}</span>
            <span v-if="p.quoteNumber" class="text-[10px] font-mono text-text-dim">{{ p.quoteNumber }}</span>
          </div>
          <div class="mt-3 space-y-1 text-[11px]">
            <div class="flex justify-between"><span class="text-text-muted">Adjudicado</span><span class="font-semibold text-text">{{ fmtMoney(p.awardAmount, p.currency) }}</span></div>
            <div class="flex justify-between"><span class="text-text-muted">Recibido</span><span class="font-semibold text-emerald-600">{{ fmtMulti(proyectoStats(p.id).recibido) }}</span></div>
            <div class="flex justify-between"><span class="text-text-muted">Pagado</span><span class="font-semibold text-red-500">{{ fmtMulti(proyectoStats(p.id).pagado) }}</span></div>
          </div>
          <div class="mt-3 pt-2 border-t border-border-light flex items-center justify-between text-[10px] text-text-dim">
            <span>{{ p.startDate || '—' }}{{ p.endDate ? ' → ' + p.endDate : '' }}</span>
            <span v-if="p.responsable" class="truncate ml-2">{{ p.responsable }}</span>
          </div>
          <div v-if="p.updatedBy" class="mt-1.5 text-[9px] text-text-dim">
            Mod: {{ p.updatedBy }}{{ p.updatedAt ? ' · ' + new Date(p.updatedAt).toLocaleDateString('es-CL') : '' }}
          </div>
        </div>
      </div>
    </template>

    <!-- VIEW: Kanban -->
    <template v-else-if="view === 'kanban'">
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div v-for="st in STATUS" :key="st.id"
          @dragover.prevent @drop="kanbanDrop($event, st.id)"
          class="bg-bg-app/60 border border-border rounded-xl p-2.5 min-h-[200px]">
          <div class="flex items-center gap-2 px-2 py-1.5 mb-2">
            <span class="w-2 h-2 rounded-full shrink-0" :class="st.dot"></span>
            <span class="text-xs font-bold text-text uppercase tracking-wider">{{ st.label }}</span>
            <span class="text-[10px] font-semibold bg-surface border border-border px-1.5 py-0.5 rounded-full text-text-muted">{{ byStatus(st.id).length }}</span>
          </div>
          <div class="space-y-2">
            <div v-for="p in byStatus(st.id)" :key="p.id" draggable="true" @dragstart="kanbanDragStart($event, p.id)"
              class="bg-surface border border-border rounded-xl p-3 shadow-sm cursor-grab hover:shadow-md hover:border-primary/40 transition">
              <div class="flex items-start justify-between gap-2">
                <p class="text-xs font-bold text-text leading-snug">{{ p.nombre }}</p>
                <div class="flex gap-1 shrink-0" @click.stop>
                  <button @click="openEdit(p)" class="text-text-dim hover:text-text transition text-[10px] px-0.5 cursor-pointer" title="Editar">✎</button>
                  <button @click="confirmDelete(p.id)" class="text-text-dim hover:text-danger transition text-[10px] px-0.5 cursor-pointer" title="Eliminar">✕</button>
                </div>
              </div>
              <p v-if="p.clientName" class="text-[10px] text-text-muted truncate mt-0.5">{{ p.clientName }}</p>
              <!-- `:value` + `@change` y no `v-model`: el estado lo manda el
                   registro guardado, no el <select>. -->
              <select :value="p.status" @change="cambiarEstado(p, $event.target.value)" @click.stop
                class="mt-2 w-full px-2 py-1 border border-border rounded-lg text-[10px] text-text-muted bg-surface outline-none focus:border-primary cursor-pointer"
                title="Cambiar estado">
                <option v-for="s in STATUS" :key="s.id" :value="s.id">{{ s.label }}</option>
              </select>
              <div class="mt-2 flex items-center justify-between text-[10px] text-text-dim">
                <span>{{ p.startDate || '—' }}{{ p.endDate ? ' → ' + p.endDate.slice(5) : '' }}</span>
                <span class="font-semibold text-text">{{ fmtMoney(p.awardAmount, p.currency) }}</span>
              </div>
              <div class="mt-1.5 flex items-center justify-between text-[9px]">
                <span class="text-emerald-600 font-semibold">R: {{ fmtMulti(proyectoStats(p.id).recibido) }}</span>
                <span class="text-red-500 font-semibold">P: {{ fmtMulti(proyectoStats(p.id).pagado) }}</span>
              </div>
            </div>
            <div v-if="!byStatus(st.id).length" class="text-[10px] text-text-dim text-center py-6 border border-dashed border-border rounded-xl">
              Arrastra proyectos aquí, o cambia el estado en la tarjeta
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- VIEW: Calendario (timeline) -->
    <template v-else>
      <div v-if="!hasCalendar" class="text-center py-16 text-text-dim">
        <p class="text-sm">Agrega fechas de inicio a los proyectos para ver el calendario.</p>
      </div>
      <div v-else class="bg-surface border border-border rounded-xl shadow-sm p-4 overflow-x-auto">
        <div class="min-w-[640px]">
          <!-- Month ticks -->
          <div class="relative h-7 border-b border-border mb-1">
            <div v-for="(m, i) in calendarTicks" :key="i" class="absolute top-0 text-[10px] font-semibold text-text-muted"
              :style="{ left: m.left + '%', width: m.width + '%' }">
              {{ m.label }}
            </div>
          </div>
          <div class="relative h-5 border-b border-border-light mb-3">
            <div v-for="(m, i) in calendarTicks" :key="i" class="absolute top-0 bottom-0 border-l border-border-light/60"
              :style="{ left: m.left + '%', width: m.width + '%' }"></div>
          </div>

          <!-- Bars -->
          <div class="space-y-2">
            <div v-for="row in calendar" :key="row.p.id" class="relative h-10">
              <div class="absolute inset-y-0 left-0 w-full flex items-center text-[11px] text-text-muted pr-2">
                <span class="truncate max-w-[220px] mr-2 font-medium text-text">{{ row.p.nombre }}</span>
                <span class="text-[9px] whitespace-nowrap">{{ row.startLabel }}{{ row.p.endDate ? ' → ' + row.endLabel : '' }}</span>
              </div>
              <div class="absolute top-1 bottom-1 rounded-md bg-primary/15 border border-primary/50 flex items-center px-2 overflow-hidden"
                :style="{ left: 'calc(' + row.left + '% + 10px)', width: 'calc(' + row.width + '% - 12px)', minWidth: '36px' }"
                :title="row.p.nombre + ' (' + row.startLabel + ' → ' + row.endLabel + ')'">
                <span class="text-[9px] font-semibold text-primary truncate">{{ row.p.status === 'finalizado' ? '✓ ' : '' }}{{ row.p.status === 'en_pausa' ? 'II ' : '' }}{{ row.p.status === 'cancelado' ? '✕ ' : '' }}{{ fmtMoney(row.p.awardAmount, row.p.currency) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
