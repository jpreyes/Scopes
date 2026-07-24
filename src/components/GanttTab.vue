<script setup>
import { usePresupuesto } from '../stores/presupuesto.js'
import { computed } from 'vue'

const { state, addGanttTask, removeGanttTask, addGanttPhase, removeGanttPhase, syncGanttSpan, trimGanttTasks } = usePresupuesto()

function moveGanttTask(id, dir) {
  const idx = state.ganttTasks.findIndex(t => t.id === id)
  if (idx === -1) return
  const target = idx + dir
  if (target < 0 || target >= state.ganttTasks.length) return
  const tmp = state.ganttTasks[target]
  state.ganttTasks[target] = state.ganttTasks[idx]
  state.ganttTasks[idx] = tmp
  syncGanttSpan(true)
}

const unitLabels = { hour: 'Horas', day: 'Días', week: 'Semanas', month: 'Meses', year: 'Años' }
const PHASE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function calcHeaders(span, unit) {
  if (unit === 'month' || unit === 'year') {
    const label = unit === 'month' ? 'MES' : 'AÑO'
    return {
      top: Array.from({ length: span }, (_, i) => ({ label: `${label} ${String(i+1).padStart(2, '0')}`, colspan: 1 })),
      mid: [], bot: [],
      totalUnits: span,
    }
  }

  if (unit === 'week') {
    const top = []; let rem = span; let mIdx = 0
    while (rem > 0) {
      const weeks = Math.min(mIdx % 2 === 0 ? 5 : 4, rem) // aproximación: meses alternan ~4-5 sem
      top.push({ label: `MES ${mIdx+1}`, colspan: weeks })
      rem -= weeks; mIdx++
    }
    const mid = Array.from({ length: span }, (_, i) => ({ label: `SEM ${i+1}`, colspan: 1 }))
    return { top, mid, bot: mid, totalUnits: span }
  }

  if (unit === 'hour') {
    const days = Math.ceil(span / 24); const top = []; let rem = span
    for (let d = 0; d < days && rem > 0; d++) {
      const h = Math.min(24, rem); top.push({ label: `DÍA ${d+1}`, colspan: h }); rem -= h
    }
    const bot = Array.from({ length: span }, (_, i) => ({ label: `${i+1}h`, colspan: 1 }))
    return { top, mid: bot, bot, totalUnits: span }
  }

  // day unit – use real month lengths
  let remaining = span
  const monthGroups = []
  while (remaining > 0) {
    const m = monthGroups.length
    const daysInMonth = MONTH_DAYS[m % 12]
    const used = Math.min(daysInMonth, remaining)
    monthGroups.push({ month: m, days: used, label: `MES ${m+1}` })
    remaining -= used
  }

  const top = monthGroups.map(mg => ({ label: mg.label, colspan: mg.days }))

  const mid = []
  let dayOffset = 1
  for (const mg of monthGroups) {
    let weekStart = 1
    while (weekStart <= mg.days) {
      const weekEnd = Math.min(weekStart + 6, mg.days)
      const colspan = weekEnd - weekStart + 1
      const globalWeek = Math.ceil(dayOffset / 7)
      mid.push({ label: `SEM ${globalWeek}`, colspan })
      weekStart += 7
    }
    dayOffset += mg.days
  }

  const bot = Array.from({ length: span }, (_, i) => ({ label: `${i+1}`, colspan: 1 }))

  return { top, mid, bot, totalUnits: span }
}

const headers = computed(() => calcHeaders(state.ganttSpan || 14, state.ganttUnit || 'day'))

function calcBarStyle(t) {
  const span = state.ganttSpan || 14
  if (!t.startDay) return {}
  const end = t.endDay || t.startDay
  const left = ((t.startDay - 1) / span) * 100
  const width = Math.max(3, (end - t.startDay + 1) / span * 100)
  return { left: left + '%', width: width + '%' }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between flex-wrap gap-2 mb-4">
      <h2 class="text-base font-bold text-text">CARTA GANTT</h2>
      <div class="flex items-center gap-2 flex-wrap">
        <select v-model="state.ganttUnit" @change="state.ganttSpan = state.ganttUnit === 'hour' ? 24 : state.ganttUnit === 'month' ? 3 : state.ganttUnit === 'year' ? 1 : 14; syncGanttSpan(true)"
          class="px-2 py-1 border border-gray-200 rounded-lg text-xs bg-white outline-none focus:border-primary">
          <option v-for="(l, k) in unitLabels" :key="k" :value="k">{{ l }}</option>
        </select>
        <input type="number" :value="state.ganttSpan" @change="trimGanttTasks($event.target.valueAsNumber || 1)"
          class="w-16 px-2 py-1 border border-gray-200 rounded-lg text-xs text-right outline-none focus:border-primary" />
        <span class="text-xs text-text-muted">{{ unitLabels[state.ganttUnit] || 'Unidades' }}</span>
        <button @click="addGanttPhase()"
          class="px-3 py-1 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition cursor-pointer">+ Sección</button>
      </div>
    </div>

    <div class="overflow-x-auto border border-gray-200 rounded-xl">
      <table class="w-full text-xs border-collapse">
        <thead>
          <tr class="bg-slate-800 text-white">
              <th class="py-2 px-3 text-left font-bold w-48 sticky left-0 bg-slate-800 z-10 border-r border-white/10" rowspan="3">TAREA</th>
            <th v-for="h in headers.top" :key="h.label" :colspan="h.colspan"
              class="py-2 px-3 text-center font-bold">{{ h.label }}</th>
          </tr>
          <tr class="bg-slate-700 text-white/80">
            <th v-for="h in headers.mid" :key="h.label" :colspan="h.colspan"
              class="py-1.5 px-2 text-center font-semibold text-[10px]">{{ h.label }}</th>
          </tr>
          <tr class="bg-slate-600 text-white/60">
            <th v-for="h in headers.bot" :key="h.label" :colspan="h.colspan || 1"
              class="py-1 px-1 text-center text-[9px] font-mono">{{ h.label }}</th>
          </tr>
        </thead>
          <tbody>
            <template v-for="(phase, pi) in state.ganttPhases" :key="phase">
              <tr class="bg-gray-100">
                <td class="py-2 px-3 font-bold text-text text-xs sticky left-0 bg-gray-100 z-10 w-48">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-slate-500 font-mono text-[10px] mr-1">{{ pi+1 }}.</span>
                    <input type="text" v-model="state.ganttPhases[pi]"
                      class="bg-transparent border-b border-dashed border-gray-300 outline-none focus:border-primary text-xs font-bold flex-1 min-w-0" />
                    <button @click="removeGanttPhase(pi)" class="text-red-400 hover:text-red-600 text-sm px-1 shrink-0 transition cursor-pointer">&times;</button>
                  </div>
                </td>
                <td :colspan="headers.totalUnits"></td>
              </tr>
              <tr v-for="(t, ti) in state.ganttTasks.filter(x => x.phase === phase)" :key="t.id" class="border-b border-gray-100 hover:bg-gray-50/50 transition">
                <td class="py-1.5 px-2 sticky left-0 bg-white z-10 w-48">
                  <div class="flex items-center gap-1 min-w-0">
                    <span class="text-text-dim font-mono text-[10px] w-6 shrink-0 text-right">{{ pi+1 }}.{{ ti+1 }}</span>
                    <button @click="moveGanttTask(t.id, -1)" :disabled="ti === 0" class="text-gray-300 hover:text-gray-600 disabled:opacity-20 transition cursor-pointer text-[10px] px-0.5" title="Subir">&#9650;</button>
                    <button @click="moveGanttTask(t.id, 1)" :disabled="ti >= state.ganttTasks.filter(x => x.phase === phase).length - 1" class="text-gray-300 hover:text-gray-600 disabled:opacity-20 transition cursor-pointer text-[10px] px-0.5" title="Bajar">&#9660;</button>
                    <input type="number" v-model.number="t.startDay" min="1" max="365" @change="syncGanttSpan(true)"
                      class="w-10 px-1 py-1 text-center text-[10px] border border-gray-100 rounded outline-none focus:border-primary bg-transparent" placeholder="Ini" />
                    <span class="text-gray-300">→</span>
                    <input type="number" v-model.number="t.endDay" min="1" max="365" @change="syncGanttSpan(true)"
                      class="w-10 px-1 py-1 text-center text-[10px] border border-gray-100 rounded outline-none focus:border-primary bg-transparent" placeholder="Fin" />
                    <input type="text" v-model="t.name" placeholder="Tarea…"
                      class="flex-1 min-w-0 px-2 py-1 text-xs border border-transparent rounded outline-none focus:border-primary bg-transparent" />
                    <button @click="removeGanttTask(t.id)" class="text-red-400 hover:text-red-600 text-xs px-1 shrink-0 transition cursor-pointer">&times;</button>
                  </div>
                </td>
              <td class="relative py-1.5 px-0" :colspan="headers.totalUnits">
                <div class="relative h-6 w-full">
                  <div v-for="d in headers.totalUnits" :key="d"
                    class="absolute top-0 bottom-0 border-l border-gray-100"
                    :style="{ left: ((d - 1) / headers.totalUnits * 100) + '%', width: (100 / headers.totalUnits) + '%' }"></div>
                  <div v-if="t.startDay && t.endDay"
                    class="absolute top-1 h-4 rounded-sm text-[9px] text-white flex items-center px-1.5 font-semibold overflow-hidden whitespace-nowrap"
                    :style="{
                      ...calcBarStyle(t),
                      background: PHASE_COLORS[pi % PHASE_COLORS.length],
                    }">
                    {{ t.name }}
                  </div>
                </div>
              </td>
            </tr>
            <tr>
              <td class="py-1 px-3 w-48">
                <button @click="addGanttTask(phase)" class="text-xs text-text-dim hover:text-primary transition cursor-pointer">+ Tarea</button>
              </td>
              <td :colspan="headers.totalUnits"></td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <div class="mt-3 flex gap-4 text-[10px] text-text-dim">
      <span>Unidad: {{ unitLabels[state.ganttUnit] }} — {{ state.ganttSpan }} {{ unitLabels[state.ganttUnit]?.toLowerCase() }} en total</span>
    </div>
  </div>
</template>
