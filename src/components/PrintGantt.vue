<script setup>
import { computed } from 'vue'

const props = defineProps({ tasks: Array, span: Number, unit: { type: String, default: 'day' }, phases: { type: Array, default: () => [] } })

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const PHASE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

const headers = computed(() => {
  const span = props.span || 14
  const u = props.unit || 'day'
  if (u === 'month' || u === 'year') return { top: [], mid: [], bot: [], totalUnits: span }
  if (u === 'week') {
    const mid = Array.from({ length: span }, (_, i) => ({ label: `SEM ${i+1}`, colspan: 1 }))
    return { top: [], mid, bot: mid, totalUnits: span }
  }
  if (u === 'hour') {
    const bot = Array.from({ length: span }, (_, i) => ({ label: `${i+1}h`, colspan: 1 }))
    return { top: [], mid: bot, bot, totalUnits: span }
  }
  let remaining = span; const monthGroups = []
  while (remaining > 0) {
    const m = monthGroups.length; const used = Math.min(MONTH_DAYS[m % 12], remaining)
    monthGroups.push({ label: `MES ${m+1}`, days: used }); remaining -= used
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
})

function barStyle(t) {
  const span = props.span || 14
  if (!t.startDay) return {}
  return { left: ((t.startDay - 1) / span * 100) + '%', width: Math.max(3, ((t.endDay || t.startDay) - t.startDay + 1) / span * 100) + '%' }
}
</script>

<template>
  <table class="print-gantt">
    <thead>
      <tr><th rowspan="3">TAREA</th><th v-for="h in headers.top" :key="h.label" :colspan="h.colspan">{{ h.label }}</th></tr>
      <tr v-if="headers.mid.length"><th v-for="h in headers.mid" :key="h.label" :colspan="h.colspan">{{ h.label }}</th></tr>
      <tr v-if="headers.bot.length"><th v-for="h in headers.bot" :key="h.label" :colspan="h.colspan || 1">{{ h.label }}</th></tr>
    </thead>
    <tbody>
      <template v-for="(phase, pi) in props.phases.length ? props.phases : ['CAPTURA DE DATOS', 'ANÁLISIS DE DATOS']" :key="phase">
        <tr><td colspan="100" class="phase">{{ phase }}</td></tr>
        <tr v-for="t in tasks.filter(x => x.phase === phase)" :key="t.id">
          <td>{{ t.name }}</td>
          <td :colspan="headers.totalUnits">
            <div class="gantt-bar" :style="{ ...barStyle(t), background: PHASE_COLORS[pi % PHASE_COLORS.length] }"></div>
          </td>
        </tr>
      </template>
    </tbody>
  </table>
</template>

<style>
.print-gantt { width: 100%; border-collapse: collapse; font-size: 9pt; margin: 12px 0; }
.print-gantt th { background: var(--color-print-header); color: #fff; padding: 4px 6px; text-align: center; font-size: 8pt; }
.print-gantt td { padding: 3px 6px; border-bottom: 1px solid #ddd; font-size: 8pt; vertical-align: middle; }
.print-gantt .phase { font-weight: bold; background: #eee; padding: 6px; }
.gantt-bar { height: 14px; border-radius: 3px; position: relative; }
</style>
