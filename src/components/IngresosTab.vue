<script setup>
import { ref } from 'vue'
import { usePresupuesto } from '../stores/presupuesto.js'
const { state, saveIngreso, deleteIngreso, exportIngresosExcel, fmtMoney, fmtMulti, computed } = usePresupuesto()

const form = ref(newIngreso())

function newIngreso() {
  return {
    fecha: new Date().toISOString().slice(0, 10),
    proyectoId: '', proyecto: '', concepto: '', monto: null, moneda: '$',
    estado: 'programado', metodo: 'Transferencia', comprobante: '', nota: '',
  }
}

const METODOS = ['Transferencia', 'Cheque', 'Efectivo', 'Pago en línea', 'Otro']

function onProyectoChange() {
  const p = state.proyectos.find(x => x.id === form.value.proyectoId)
  form.value.proyecto = p ? p.nombre : ''
}
function submitForm() {
  if (!form.value.concepto) return
  if (!(Number(form.value.monto) > 0)) { alert('Ingresa un monto válido.'); return }
  const p = state.proyectos.find(x => x.id === form.value.proyectoId)
  saveIngreso({ ...form.value, proyecto: form.value.proyectoId ? (p ? p.nombre : '') : '', monto: Number(form.value.monto), id: Date.now() + '' })
  form.value = newIngreso()
}
function confirmDelete(id) {
  if (confirm('¿Eliminar este ingreso?')) deleteIngreso(id)
}
function toggleEstado(r) {
  r.estado = r.estado === 'recibido' ? 'programado' : 'recibido'
  saveIngreso({ ...r })
}
</script>

<template>
  <div class="p-3 sm:p-6 space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-bold text-text">Ingresos</h1>
      <div class="flex gap-2">
        <button @click="exportIngresosExcel" class="px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition cursor-pointer">Exportar</button>
      </div>
    </div>

    <!-- Summary -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-4 shadow-sm">
        <p class="text-[10px] text-emerald-700 uppercase font-semibold tracking-wider">Total recibido</p>
        <p class="text-lg font-bold text-emerald-700 mt-1">{{ fmtMulti(computed.finKpis.value.recibido) }}</p>
      </div>
      <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-sm">
        <p class="text-[10px] text-amber-700 uppercase font-semibold tracking-wider">Por cobrar</p>
        <p class="text-lg font-bold text-amber-700 mt-1">{{ fmtMulti(computed.finKpis.value.programado) }}</p>
      </div>
      <div class="bg-surface border border-border rounded-xl p-4 shadow-sm">
        <p class="text-[10px] text-text-muted uppercase font-semibold tracking-wider">Registros</p>
        <p class="text-lg font-bold text-text mt-1">{{ state.ingresos.length }}</p>
      </div>
    </div>

    <!-- Form -->
    <div class="bg-surface border border-border rounded-xl p-4 shadow-sm space-y-3">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <input v-model="form.fecha" type="date" class="px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-primary bg-surface" />
        <select v-model="form.proyectoId" @change="onProyectoChange" class="px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-primary bg-surface lg:col-span-1">
          <option value="">— Sin proyecto —</option>
          <option v-for="p in state.proyectos" :key="p.id" :value="p.id">{{ p.nombre }}</option>
        </select>
        <input v-model="form.concepto" placeholder="Concepto *" class="px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-primary bg-surface" />
        <input v-model="form.comprobante" placeholder="Comprobante / Factura" class="px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-primary bg-surface" />
        <input v-model.number="form.monto" type="number" placeholder="Monto *" class="px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-primary bg-surface" />
        <select v-model="form.moneda" class="px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-primary bg-surface">
          <option value="$">$</option>
          <option value="US$">US$</option>
          <option value="€">€</option>
          <option value="UF">UF</option>
        </select>
        <select v-model="form.estado" class="px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-primary bg-surface">
          <option value="programado">Programado</option>
          <option value="recibido">Recibido</option>
        </select>
        <select v-model="form.metodo" class="px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-primary bg-surface">
          <option v-for="m in METODOS" :key="m" :value="m">{{ m }}</option>
        </select>
        <input v-model="form.nota" placeholder="Nota…" class="px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-primary bg-surface" />
        <button @click="submitForm" class="px-3 py-1.5 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition cursor-pointer">+ Agregar ingreso</button>
      </div>
    </div>

    <!-- List -->
    <div v-if="!state.ingresos.length" class="text-center py-16 text-text-dim">
      <p class="text-sm">No hay ingresos registrados.</p>
    </div>

    <div v-else class="bg-surface border border-border rounded-xl shadow-sm overflow-x-auto">
      <table class="w-full text-xs min-w-[720px]">
        <thead>
          <tr class="bg-bg-app text-text-muted uppercase tracking-wider text-[10px]">
            <th class="py-2 px-3 text-left font-semibold">Fecha</th>
            <th class="py-2 px-3 text-left font-semibold">Proyecto</th>
            <th class="py-2 px-3 text-left font-semibold">Concepto</th>
            <th class="py-2 px-3 text-right font-semibold">Monto</th>
            <th class="py-2 px-3 text-center font-semibold">Estado</th>
            <th class="py-2 px-3 text-left font-semibold">Método</th>
            <th class="py-2 px-3 text-left font-semibold">Comprobante</th>
            <th class="py-2 px-3"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in state.ingresos" :key="r.id" class="border-b border-border-light hover:bg-bg-app/50 transition">
            <td class="py-2 px-3 text-text-muted">{{ r.fecha || '-' }}</td>
            <td class="py-2 px-3 max-w-[160px] truncate" :title="r.proyecto">{{ r.proyecto || '—' }}</td>
            <td class="py-2 px-3 max-w-[200px] truncate" :title="r.concepto">{{ r.concepto }}</td>
            <td class="py-2 px-3 text-right font-semibold">{{ fmtMoney(r.monto, r.moneda) }}</td>
            <td class="py-2 px-3 text-center">
              <button @click="toggleEstado(r)" :title="'Cambiar a ' + (r.estado === 'recibido' ? 'programado' : 'recibido')"
                class="inline-flex text-[9px] font-semibold px-2 py-0.5 rounded-full cursor-pointer border"
                :class="r.estado === 'recibido' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200'">
                {{ r.estado === 'recibido' ? 'Recibido' : 'Programado' }}
              </button>
            </td>
            <td class="py-2 px-3 text-text-muted">{{ r.metodo || '-' }}</td>
            <td class="py-2 px-3 text-text-dim">{{ r.comprobante || '-' }}</td>
            <td class="py-2 px-3">
              <button @click="confirmDelete(r.id)" class="text-text-dim hover:text-danger transition text-xs px-1 cursor-pointer" title="Eliminar">✕</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
