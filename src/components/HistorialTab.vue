<script setup>
import { usePresupuesto } from '../stores/presupuesto.js'
const { state, loadBudgetByNum, deleteBudget, exportHistorialExcel } = usePresupuesto()
</script>

<template>
  <div>
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-base font-bold text-text">Historial</h2>
      <button @click="exportHistorialExcel" class="px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition cursor-pointer">Exportar</button>
    </div>

    <div v-if="!state.budgetList.length" class="text-center py-16 text-text-dim">
      <span class="block mb-3 flex justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
      </span>
      <p class="text-sm">No hay presupuestos guardados aún.</p>
    </div>

    <table v-else class="w-full">
      <thead>
        <tr class="bg-slate-800 text-white text-[11px] uppercase tracking-wider">
          <th class="py-2.5 px-3 rounded-l-lg">N°</th>
          <th class="py-2.5 px-3 text-left">Cliente</th>
          <th class="py-2.5 px-3 text-left">Fecha</th>
          <th class="py-2.5 px-3 text-center">Estado</th>
          <th class="py-2.5 px-3 text-right">Total</th>
          <th class="py-2.5 px-3 rounded-r-lg"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="b in state.budgetList" :key="b.quoteNumber" class="border-b border-gray-100 hover:bg-gray-50/50 transition">
          <td class="py-2.5 px-3 text-sm font-mono">{{ b.quoteNumber }}</td>
          <td class="py-2.5 px-3 text-sm">{{ b.client || '-' }}</td>
          <td class="py-2.5 px-3 text-sm text-text-muted">{{ b.date || '-' }}</td>
          <td class="py-2.5 px-3 text-center">
            <span class="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full"
              :class="b.status === 'adjudicada' ? 'bg-primary-light text-primary' : b.status === 'aprobada' ? 'bg-emerald-100 text-emerald-700' : b.status === 'rechazada' ? 'bg-red-100 text-red-700' : b.status === 'revision' ? 'bg-amber-100 text-amber-700' : b.status === 'enviada' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'">
              {{ b.statusLabel }}
            </span>
          </td>
          <td class="py-2.5 px-3 text-sm font-semibold text-right">{{ b.total }}</td>
          <td class="py-2.5 px-3 flex gap-1.5">
            <button @click="loadBudgetByNum(b.quoteNumber)" class="px-2.5 py-1 text-[11px] font-semibold bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition cursor-pointer">Cargar</button>
            <button @click="deleteBudget(b.quoteNumber)" class="px-2.5 py-1 text-[11px] font-semibold bg-gray-100 text-red-500 rounded-md hover:bg-red-50 transition cursor-pointer">Eliminar</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
