<script setup>
import { usePresupuesto } from '../stores/presupuesto.js'
const { state, loadBudgetByNum, deleteBudget, exportHistorialExcel, crearProyectoDesdePropuesta, resetBudget } = usePresupuesto()

function nuevaPropuesta() {
  state.activeTab = 'propuesta'
  resetBudget()
}
function editar(qn) {
  loadBudgetByNum(qn)
  state.activeSection = 'propuestas'
}

function fmtStamp(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm} ${hh}:${mi}`
}

// --- Aprobación interna (2 administradores distintos, nunca el creador) ---

const yo = () => (state.user && (state.user.name || state.user.email)) || ''

function aprobadores(b) {
  return new Set((b.aprobaciones || []).map(a => a.by))
}
function requiereAprobacion(b) {
  return b.status === 'en_revision'
}
function puedoAprobarla(b) {
  return requiereAprobacion(b) && !aprobadores(b).has(yo()) && b.createdBy !== yo()
}
function detalleAprobaciones(b) {
  const lista = (b.aprobaciones || []).map(a => a.by + ' · ' + fmtStamp(a.at))
  if (!lista.length) return 'Nadie la ha aprobado todavía. Requiere 2 administradores distintos.'
  return 'Aprobada por:\n' + lista.join('\n')
}

function statusClass(s) {
  return {
    borrador: 'bg-gray-100 text-gray-600',
    en_revision: 'bg-amber-100 text-amber-700',
    modificacion: 'bg-orange-100 text-orange-700',
    aprobada: 'bg-emerald-100 text-emerald-700',
    enviada: 'bg-blue-100 text-blue-700',
    rectificacion: 'bg-violet-100 text-violet-700',
    adjudicada: 'bg-primary-light text-primary',
    rechazada: 'bg-red-100 text-red-700',
  }[s] || 'bg-gray-100 text-gray-600'
}
</script>

<template>
  <div>
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-base font-bold text-text">Propuestas</h2>
      <div class="flex gap-2">
        <button @click="nuevaPropuesta" class="px-3 py-1.5 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition cursor-pointer">+ Nueva propuesta</button>
        <button @click="exportHistorialExcel" class="px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition cursor-pointer">Exportar</button>
      </div>
    </div>

    <div v-if="!state.budgetList.length" class="text-center py-16 text-text-dim">
      <span class="block mb-3 flex justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
      </span>
      <p class="text-sm">No hay presupuestos guardados aún.</p>
    </div>

    <div v-else class="overflow-x-auto">
      <table class="w-full min-w-[900px]">
        <thead>
          <tr class="bg-slate-800 text-white text-[11px] uppercase tracking-wider">
            <th class="py-2.5 px-3 rounded-l-lg">N°</th>
            <th class="py-2.5 px-3 text-left">Cliente</th>
            <th class="py-2.5 px-3 text-left">Fecha</th>
            <th class="py-2.5 px-3 text-center">Estado</th>
            <th class="py-2.5 px-3 text-right">Total</th>
            <th class="py-2.5 px-3 text-left">Creado por</th>
            <th class="py-2.5 px-3 text-left">Modificado</th>
            <th class="py-2.5 px-3 rounded-r-lg"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="b in state.budgetList" :key="b.quoteNumber"
            class="border-b border-border hover:bg-surface/50 transition"
            :class="requiereAprobacion(b) ? 'bg-amber-50' : ''">
            <td class="py-2.5 px-3 text-sm font-mono">{{ b.quoteNumber }}</td>
            <td class="py-2.5 px-3 text-sm">{{ b.client || '-' }}</td>
            <td class="py-2.5 px-3 text-sm text-text-muted">{{ b.date || '-' }}</td>
            <td class="py-2.5 px-3 text-center">
              <span class="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full" :class="statusClass(b.status)">
                {{ b.statusLabel }}
              </span>
              <!-- Pendiente de aprobación: es una acción que alguien debe hacer,
                   así que la lista tiene que cantarlo aunque nadie haya votado. -->
              <span v-if="requiereAprobacion(b)"
                class="mt-1 inline-flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 ring-1 ring-amber-300 whitespace-nowrap"
                :title="detalleAprobaciones(b)">
                <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                Requiere aprobación · {{ aprobadores(b).size }}/2
              </span>
              <span v-else-if="(b.aprobaciones || []).length"
                class="mt-1 inline-flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded-full"
                :class="aprobadores(b).size >= 2 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'"
                :title="detalleAprobaciones(b)">
                <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                {{ aprobadores(b).size >= 2 ? 'Aprobada' : aprobadores(b).size + '/2' }}
              </span>
            </td>
            <td class="py-2.5 px-3 text-sm font-semibold text-right">{{ b.total }}</td>
            <td class="py-2.5 px-3 text-[11px] text-text-muted whitespace-nowrap">
              <span v-if="b.createdBy">{{ b.createdBy }}<span v-if="b.createdAt" class="text-text-dim"> · {{ fmtStamp(b.createdAt) }}</span></span>
              <span v-else class="text-text-dim">—</span>
            </td>
            <td class="py-2.5 px-3 text-[11px] text-text-muted whitespace-nowrap">
              <span v-if="b.updatedBy">{{ b.updatedBy }}<span v-if="b.updatedAt" class="text-text-dim"> · {{ fmtStamp(b.updatedAt) }}</span></span>
              <span v-else class="text-text-dim">—</span>
            </td>
            <td class="py-2.5 px-3 flex gap-1.5">
              <!-- En revisión la acción no es "editar" sino entrar a revisarla y
                   votar, así que el botón cambia de nombre y de peso visual. -->
              <button v-if="requiereAprobacion(b)" @click="editar(b.quoteNumber)"
                :title="puedoAprobarla(b) ? 'Ingresar para revisar y aprobar' : 'Ingresar (tú no puedes aprobar esta propuesta)'"
                class="px-2.5 py-1 text-[11px] font-semibold bg-amber-500 text-white rounded-md hover:bg-amber-600 transition cursor-pointer">Ingresar</button>
              <button v-else @click="editar(b.quoteNumber)" class="px-2.5 py-1 text-[11px] font-semibold bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition cursor-pointer">Editar</button>
              <button v-if="b.status === 'adjudicada'" @click="crearProyectoDesdePropuesta(b.quoteNumber)"
                class="px-2.5 py-1 text-[11px] font-semibold bg-primary-light text-primary rounded-md hover:bg-primary hover:text-white transition cursor-pointer">→ Proyecto</button>
              <button @click="deleteBudget(b.quoteNumber)" class="px-2.5 py-1 text-[11px] font-semibold bg-gray-100 text-red-500 rounded-md hover:bg-red-50 transition cursor-pointer">Eliminar</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
