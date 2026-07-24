<script setup>
import { usePresupuesto } from '../stores/presupuesto.js'
import RichTextEditor from './RichTextEditor.vue'
import { computed } from 'vue'

const { state, fmt, computed: storeComputed, addProposalItem, removeProposalItem, addPropuestaSection, removePropuestaSection, syncPropuestaSections } = usePresupuesto()

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const PHASE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

function calcGanttHeaders(span, unit) {
  if (unit === 'month' || unit === 'year') {
    const label = unit === 'month' ? 'MES' : 'AÑO'
    return { top: Array.from({ length: span }, (_, i) => ({ label: `${label} ${String(i+1).padStart(2, '0')}`, colspan: 1 })), mid: [], bot: [], totalUnits: span }
  }
  if (unit === 'week') {
    const top = []; let rem = span; let mIdx = 0
    while (rem > 0) { const w = Math.min(mIdx % 2 === 0 ? 5 : 4, rem); top.push({ label: `MES ${mIdx+1}`, colspan: w }); rem -= w; mIdx++ }
    const mid = Array.from({ length: span }, (_, i) => ({ label: `SEM ${i+1}`, colspan: 1 }))
    return { top, mid, bot: mid, totalUnits: span }
  }
  if (unit === 'hour') {
    const days = Math.ceil(span / 24); const top = []; let rem = span
    for (let d = 0; d < days && rem > 0; d++) { const h = Math.min(24, rem); top.push({ label: `DÍA ${d+1}`, colspan: h }); rem -= h }
    const bot = Array.from({ length: span }, (_, i) => ({ label: `${i+1}h`, colspan: 1 }))
    return { top, mid: bot, bot, totalUnits: span }
  }
  // day – real months
  let remaining = span; const monthGroups = []
  while (remaining > 0) {
    const m = monthGroups.length; const used = Math.min(MONTH_DAYS[m % 12], remaining)
    monthGroups.push({ month: m, days: used, label: `MES ${m+1}` }); remaining -= used
  }
  const top = monthGroups.map(mg => ({ label: mg.label, colspan: mg.days }))
  const mid = []; let dayOffset = 1
  for (const mg of monthGroups) {
    let ws = 1
    while (ws <= mg.days) { const we = Math.min(ws + 6, mg.days); mid.push({ label: `SEM ${Math.ceil(dayOffset/7)}`, colspan: we - ws + 1 }); ws += 7 }
    dayOffset += mg.days
  }
  const bot = Array.from({ length: span }, (_, i) => ({ label: `${i+1}`, colspan: 1 }))
  return { top, mid, bot, totalUnits: span }
}

const ganttHeaders = computed(() => calcGanttHeaders(state.ganttSpan || 14, state.ganttUnit || 'day'))

function ganttBarStyle(t) {
  const span = state.ganttSpan || 14
  if (!t.startDay) return {}
  const end = t.endDay || t.startDay
  return { left: ((t.startDay - 1) / span * 100) + '%', width: Math.max(3, (end - t.startDay + 1) / span * 100) + '%' }
}
</script>

<template>
  <div>
    <!-- Reference row -->
    <div class="flex flex-wrap gap-y-2 justify-between items-center bg-gradient-to-r from-gray-50 to-white border border-border/80 rounded-xl px-5 py-3.5 mb-4 shadow-sm">
      <div class="flex items-center gap-2 text-sm">
        <span class="font-bold text-text text-[11px] tracking-wider uppercase">Contacto:</span>
        <input type="text" v-model="state.contactPerson" class="border border-border rounded-lg px-2.5 py-1 text-sm w-48 sm:w-56 focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none transition" placeholder="Nombre contacto" />
      </div>
      <span class="text-xl sm:text-2xl font-extrabold text-text tracking-wider">{{ state.quoteNumber }}</span>
    </div>

    <!-- Meta row -->
    <div class="flex flex-wrap gap-3 px-4 py-3 bg-gradient-to-r from-gray-50/80 to-white border border-border/80 rounded-xl mb-5 shadow-sm">
      <div v-for="m in [
        { label: 'Fecha', key: 'quoteDate', type: 'date' },
        { label: 'Válido hasta', key: 'validUntil', type: 'date' },
        { label: 'Revisión', key: 'quoteRev', type: 'text' },
        { label: 'Moneda', key: 'currency', type: 'select', opts: ['$','US$','€','UF'] },
      ]" :key="m.key" class="flex items-center gap-1.5 text-xs">
        <span class="font-semibold text-text-muted uppercase">{{ m.label }}:</span>
        <select v-if="m.type==='select'" v-model="state[m.key]" class="border border-border rounded-lg px-2 py-1 text-xs bg-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10">
          <option v-for="o in m.opts" :key="o" :value="o">{{ o }}</option>
        </select>
        <input v-else :type="m.type" v-model="state[m.key]" class="border border-border rounded-lg px-2 py-1 text-xs bg-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
      </div>
    </div>

    <!-- Company / Client -->
    <div class="grid md:grid-cols-2 gap-5 mb-5">
      <div v-for="(blk, bi) in [
        { title: 'EMPRESA', fields: [
          { key: 'company' }, { key: 'companyAddr' }, { key: 'companyPhone' }, { key: 'companyEmail' },
          { key: 'companyResp', label: 'Responsable' }
        ]},
        { title: 'CLIENTE', fields: [
          { key: 'clientName', label: 'Nombre' }, { key: 'clientAddr' }, { key: 'clientPhone' },
          { key: 'clientEmail' }, { key: 'clientResp', label: 'Responsable' }
        ]},
      ]" :key="bi" class="bg-gradient-to-br from-gray-50/80 to-white border border-border/80 rounded-xl p-4 shadow-sm">
        <h3 class="text-[11px] font-bold text-text uppercase tracking-wider mb-3 flex items-center gap-2">
          <span class="w-1 h-4 bg-primary rounded-full inline-block"></span>
          {{ blk.title }}
        </h3>
        <input v-for="f in blk.fields" :key="f.key"
          v-model="state[f.key]"
          :placeholder="f.label || f.key.replace('company','').replace('client','') || f.key"
          class="w-full px-3 py-1.5 mb-2 border border-border rounded-lg text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition bg-surface/80" />
      </div>
    </div>

    <!-- Sections -->
    <div v-for="(s, si) in state.propuestaSections" :key="s.id"
      class="mb-2.5 p-4 bg-surface border border-border/80 border-l-4 border-l-primary rounded-xl shadow-sm">
      <div class="flex items-center justify-between gap-2 mb-2">
        <h3 class="text-sm font-bold text-text flex items-center gap-2 flex-1 min-w-0">
          <label class="flex items-center cursor-pointer shrink-0">
            <input type="checkbox" v-model="state.printSections[s.id]" class="accent-primary w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary" />
          </label>
          <input type="text" v-model="s.label" class="bg-transparent border-b border-dashed border-border outline-none focus:border-primary text-sm font-bold flex-1 min-w-0" />
        </h3>
        <button @click="removePropuestaSection(s.id)" class="text-danger hover:text-red-600 text-sm px-1 transition opacity-40 hover:opacity-100 leading-none cursor-pointer" title="Eliminar sección">&times;</button>
      </div>
      <RichTextEditor :key="'rte-' + s.id + '-' + state.loadVersion" v-model="s.content" />
    </div>
    <button @click="addPropuestaSection" class="mb-4 px-3 py-1.5 text-xs text-text-muted border border-dashed border-border rounded-lg hover:bg-gray-50 hover:border-primary-border transition cursor-pointer">+ Agregar sección</button>

    <!-- Items table -->
    <section class="mb-5">
      <h2 class="text-sm font-bold text-text mb-3 flex items-center gap-2">
        <span class="w-1 h-4 bg-emerald-500 rounded-full inline-block"></span>
        PROPUESTA ECONÓMICA
      </h2>
      <div class="border border-border/80 rounded-xl overflow-x-auto shadow-sm">
        <table class="w-full">
          <thead>
            <tr class="bg-gradient-to-r from-slate-800 to-slate-700 text-white text-[11px] uppercase tracking-wider">
              <th class="py-2.5 px-3 text-center w-14">ITEM</th>
              <th class="py-2.5 px-3 text-left">DESCRIPCIÓN</th>
              <th class="py-2.5 px-3 text-center w-20">CANT.</th>
              <th class="py-2.5 px-3 text-right w-28">P. UNITARIO</th>
              <th class="py-2.5 px-3 text-right w-28">TOTAL</th>
              <th class="w-8"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(it, i) in state.proposalItems" :key="i" class="border-b border-border-light hover:bg-gray-50/50 transition-colors">
              <td class="py-2 px-3 text-center text-xs text-text-dim font-mono">{{ i+1 }}.1</td>
              <td class="py-2 px-1"><input type="text" v-model="it.desc" class="w-full px-2 py-1.5 border border-transparent rounded text-sm outline-none focus:border-primary focus:bg-surface transition" placeholder="Descripción" /></td>
              <td class="py-2 px-1"><input type="number" v-model.number="it.qty" min="1" class="w-full px-2 py-1.5 border border-transparent rounded text-sm text-right outline-none focus:border-primary focus:bg-surface transition" /></td>
              <td class="py-2 px-1"><input type="number" v-model.number="it.price" min="0" class="w-full px-2 py-1.5 border border-transparent rounded text-sm text-right outline-none focus:border-primary focus:bg-surface transition" /></td>
              <td class="py-2 px-3 text-right text-sm font-semibold text-text">{{ fmt((it.qty||0)*(it.price||0)) }}</td>
              <td><button @click="removeProposalItem(i)" class="text-danger hover:text-red-600 text-lg px-1 transition opacity-50 hover:opacity-100 cursor-pointer">&times;</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <button @click="addProposalItem" class="mt-2 px-3 py-1.5 text-xs text-text-muted border border-dashed border-border rounded-lg hover:bg-gray-50 hover:border-primary-border transition cursor-pointer">+ Agregar item</button>
    </section>

    <!-- Totals -->
    <div class="ml-auto w-80 mb-5 bg-gradient-to-br from-gray-50/80 to-white border border-border/80 rounded-xl p-4 shadow-sm">
      <div class="flex justify-between py-1.5">
        <span class="text-sm text-text-muted">Subtotal</span>
        <span class="text-sm font-semibold text-text">{{ fmt(storeComputed.proposalSubtotal.value) }}</span>
      </div>
      <div class="flex justify-between items-center py-1.5">
        <span class="text-sm text-text-muted">IVA / Impuesto (%)</span>
        <input type="number" v-model.number="state.taxRate" min="0" max="100" step="0.01" class="w-16 px-2 py-1 border border-border rounded-lg text-right text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
      </div>
      <div class="flex justify-between py-1.5">
        <span class="text-sm text-text-muted">Monto Impuesto</span>
        <span class="text-sm font-semibold text-text">{{ fmt(storeComputed.proposalTax.value) }}</span>
      </div>
      <div class="flex justify-between py-3 mt-2 border-t-2 border-slate-800">
        <span class="text-base font-bold text-text">Total</span>
        <span class="text-xl font-bold text-text">{{ fmt(storeComputed.proposalTotal.value) }}</span>
      </div>
    </div>

    <!-- Gantt Chart -->
    <section class="mb-5">
      <h2 class="text-sm font-bold text-text mb-3 flex items-center gap-2">
        <span class="w-1 h-4 bg-violet-500 rounded-full inline-block"></span>
        CARTA GANTT
      </h2>
      <div class="overflow-x-auto border border-border/80 rounded-xl shadow-sm">
        <table class="w-full text-xs border-collapse">
          <thead>
            <tr class="bg-gradient-to-r from-slate-800 to-slate-700 text-white">
              <th class="py-2 px-3 text-left font-bold w-48 sticky left-0 bg-slate-800 z-10" rowspan="3">TAREA</th>
              <th v-for="h in ganttHeaders.top" :key="h.label" :colspan="h.colspan"
                class="py-2 px-3 text-center font-bold">{{ h.label }}</th>
            </tr>
            <tr class="bg-slate-700 text-white/80" v-if="ganttHeaders.mid.length">
              <th v-for="h in ganttHeaders.mid" :key="h.label" :colspan="h.colspan"
                class="py-1.5 px-2 text-center font-semibold text-[10px]">{{ h.label }}</th>
            </tr>
            <tr class="bg-slate-600 text-white/60" v-if="ganttHeaders.bot.length">
              <th v-for="h in ganttHeaders.bot" :key="h.label" :colspan="h.colspan || 1"
                class="py-1 px-1 text-center text-[9px] font-mono">{{ h.label }}</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(phase, pi) in state.ganttPhases" :key="phase">
              <tr class="bg-gray-100/80">
                <td class="py-2 px-3 font-bold text-text text-xs sticky left-0 bg-gray-100/80 z-10">
                  <div class="flex items-center justify-between gap-2">
                    <input type="text" v-model="state.ganttPhases[pi]"
                      class="bg-transparent border-b border-dashed border-border outline-none focus:border-primary text-xs font-bold flex-1 min-w-0" />
                    <button @click="removeGanttPhase(pi)" class="text-danger hover:text-red-600 text-sm px-1 shrink-0 transition cursor-pointer" title="Eliminar fase">&times;</button>
                  </div>
                </td>
                <td :colspan="ganttHeaders.totalUnits"></td>
              </tr>
              <tr v-for="t in state.ganttTasks.filter(x => x.phase === phase)" :key="t.id" class="border-b border-border-light hover:bg-gray-50/50 transition-colors">
                <td class="py-1.5 px-2 sticky left-0 bg-surface z-10">
                  <input type="text" v-model="t.name" placeholder="Tarea…"
                    class="w-full px-2 py-1 text-xs border border-transparent rounded outline-none focus:border-primary bg-transparent" />
                </td>
                <td class="relative py-1.5 px-0" :colspan="ganttHeaders.totalUnits">
                  <div class="relative h-6 w-full">
                    <div v-for="d in ganttHeaders.totalUnits" :key="d"
                      class="absolute top-0 bottom-0 border-l border-border-light"
                      :style="{ left: ((d - 1) / ganttHeaders.totalUnits * 100) + '%', width: (100 / ganttHeaders.totalUnits) + '%' }"></div>
                    <div v-if="t.startDay && t.endDay"
                      class="absolute top-1 h-4 rounded-sm text-[9px] text-white flex items-center px-1.5 font-semibold overflow-hidden whitespace-nowrap"
                      :style="{
                        ...ganttBarStyle(t),
                        background: PHASE_COLORS[pi % PHASE_COLORS.length],
                      }">
                      {{ t.name }}
                    </div>
                  </div>
                </td>
              </tr>
              <tr>
                <td class="py-1 px-3">
                  <button @click="addGanttTask(phase)" class="text-xs text-text-dim hover:text-primary transition cursor-pointer">+ Tarea</button>
                </td>
                <td :colspan="ganttHeaders.totalUnits"></td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      <button @click="addGanttPhase()" class="mt-2 px-3 py-1.5 text-xs text-text-muted border border-dashed border-border rounded-lg hover:bg-gray-50 hover:border-primary-border transition cursor-pointer">+ Agregar sección</button>
      <div class="mt-1.5 text-[10px] text-text-dim">
        <span>{{ state.ganttSpan }} {{ { hour: 'horas', day: 'días', week: 'semanas', month: 'meses', year: 'años' }[state.ganttUnit] || 'unidades' }} de alcance</span>
      </div>
    </section>

    <!-- Signatures -->
    <div class="grid md:grid-cols-2 gap-12 my-6 py-6 border-t border-b border-border/80 bg-gradient-to-r from-gray-50/50 to-white rounded-xl">
      <div v-for="sig in [
        { label: 'POR EMPRESA', key: 'companyRespSig' },
        { label: 'POR CLIENTE', key: 'clientRespSig' },
      ]" :key="sig.key" class="text-center">
        <label class="text-[11px] font-bold text-text uppercase tracking-wider">{{ sig.label }}</label>
        <div class="border-t-2 border-slate-300 mt-8 mb-2"></div>
        <input type="text" v-model="state[sig.key]" class="w-full text-center text-sm font-semibold border-none outline-none bg-transparent text-text" placeholder="Nombre responsable" />
        <span class="text-[11px] text-text-dim">Firma</span>
      </div>
    </div>

  </div>
</template>
