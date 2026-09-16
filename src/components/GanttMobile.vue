<script setup>
// La Carta Gantt en un teléfono. La grilla necesita ~700 px de ancho: a 390 px
// se veía solo la columna de tareas y las barras quedaban fuera de la pantalla.
// Acá cada tarea es una tarjeta con sus días y una barra proporcional, y se
// edita igual que en la tabla (mismas funciones del store).
import { usePresupuesto } from '../stores/presupuesto.js'

const props = defineProps({ conAgregarSeccion: { type: Boolean, default: true } })

const { state, addGanttTask, removeGanttTask, addGanttPhase, renameGanttPhase, removeGanttPhase, syncGanttSpan } = usePresupuesto()

const PHASE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']
const UNIDADES = { hour: ['hora', 'horas'], day: ['día', 'días'], week: ['semana', 'semanas'], month: ['mes', 'meses'], year: ['año', 'años'] }

const color = pi => PHASE_COLORS[pi % PHASE_COLORS.length]
const tareasDe = phase => state.ganttTasks.filter(t => t.phase === phase)
const unidad = n => (UNIDADES[state.ganttUnit] || UNIDADES.day)[n === 1 ? 0 : 1]
const duracion = t => Math.max(1, (t.endDay || t.startDay || 1) - (t.startDay || 1) + 1)

function onRenamePhase(pi, e) {
  renameGanttPhase(pi, e.target.value)
  e.target.value = state.ganttPhases[pi] ?? ''
}

function barStyle(t) {
  const span = state.ganttSpan || 14
  if (!t.startDay) return { display: 'none' }
  const fin = t.endDay || t.startDay
  return {
    left: ((t.startDay - 1) / span * 100) + '%',
    width: Math.max(4, (fin - t.startDay + 1) / span * 100) + '%',
  }
}
</script>

<template>
  <div class="space-y-3">
    <div v-for="(phase, pi) in state.ganttPhases" :key="pi" class="border border-border rounded-xl bg-surface overflow-hidden">
      <div class="flex items-center gap-2 px-3 py-2 bg-bg-app/60 border-b border-border">
        <span class="w-1.5 h-4 rounded-full shrink-0" :style="{ background: color(pi) }"></span>
        <input type="text" :value="phase" @change="onRenamePhase(pi, $event)" @keydown.enter="$event.target.blur()"
          class="flex-1 min-w-0 bg-transparent border-b border-dashed border-border outline-none focus:border-primary text-xs font-bold text-text" />
        <button @click="removeGanttPhase(pi)" class="text-danger hover:text-red-600 text-base px-1 shrink-0 transition cursor-pointer" title="Eliminar sección">&times;</button>
      </div>

      <div class="p-2 space-y-2">
        <div v-for="t in tareasDe(phase)" :key="t.id" class="border border-border-light rounded-lg p-2 bg-surface">
          <div class="flex items-center gap-2">
            <input type="text" v-model="t.name" placeholder="Tarea…"
              class="flex-1 min-w-0 px-2 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-primary bg-surface" />
            <button @click="removeGanttTask(t.id)" class="text-danger hover:text-red-600 text-base px-1 shrink-0 transition cursor-pointer" title="Eliminar tarea">&times;</button>
          </div>
          <div class="flex items-center gap-2 mt-2">
            <label class="text-[10px] text-text-dim flex items-center gap-1">
              Del
              <input type="number" v-model.number="t.startDay" min="1" max="365" @change="syncGanttSpan(true)"
                class="w-14 px-1.5 py-1 border border-border rounded text-xs text-right outline-none focus:border-primary" />
            </label>
            <label class="text-[10px] text-text-dim flex items-center gap-1">
              al
              <input type="number" v-model.number="t.endDay" min="1" max="365" @change="syncGanttSpan(true)"
                class="w-14 px-1.5 py-1 border border-border rounded text-xs text-right outline-none focus:border-primary" />
            </label>
            <span class="ml-auto text-[10px] font-semibold text-text-muted whitespace-nowrap">{{ duracion(t) }} {{ unidad(duracion(t)) }}</span>
          </div>
          <div class="relative h-2 mt-2 rounded-full bg-bg-app overflow-hidden">
            <div class="absolute top-0 bottom-0 rounded-full" :style="{ ...barStyle(t), background: color(pi) }"></div>
          </div>
        </div>

        <button @click="addGanttTask(phase)"
          class="w-full py-1.5 text-xs text-text-muted border border-dashed border-border rounded-lg hover:bg-bg-app transition cursor-pointer">+ Tarea</button>
      </div>
    </div>

    <button v-if="props.conAgregarSeccion" @click="addGanttPhase()"
      class="w-full py-2 text-xs text-text-muted border border-dashed border-border rounded-xl hover:bg-surface transition cursor-pointer">+ Agregar sección</button>
    <p class="text-[10px] text-text-dim">{{ state.ganttSpan }} {{ unidad(state.ganttSpan) }} en total</p>
  </div>
</template>
