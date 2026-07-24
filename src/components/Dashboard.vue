<script setup>
import { usePresupuesto } from '../stores/presupuesto.js'
const { state, loadBudgetByNum, seedSampleData } = usePresupuesto()
const d = state.dashboardData
</script>

<template>
  <div class="p-3 sm:p-6 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-bold text-text">Dashboard</h1>
      <button v-if="!d.total" @click="seedSampleData"
        class="px-3 py-1.5 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition cursor-pointer">
        Cargar datos de ejemplo
      </button>
    </div>

    <!-- Stats cards -->
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <div class="bg-surface border border-border rounded-xl p-4 shadow-sm">
        <p class="text-xs text-text-muted uppercase font-semibold tracking-wider">Total</p>
        <p class="text-2xl font-bold text-text mt-1">{{ d.total }}</p>
      </div>
      <div class="bg-surface border border-border rounded-xl p-4 shadow-sm">
        <p class="text-xs text-text-muted uppercase font-semibold tracking-wider">Borrador</p>
        <p class="text-2xl font-bold text-text mt-1">{{ d.counts.borrador || 0 }}</p>
      </div>
      <div class="bg-surface border border-border rounded-xl p-4 shadow-sm">
        <p class="text-xs text-text-muted uppercase font-semibold tracking-wider">Enviadas</p>
        <p class="text-2xl font-bold text-blue-600 mt-1">{{ d.counts.enviada || 0 }}</p>
      </div>
      <div class="bg-surface border border-border rounded-xl p-4 shadow-sm">
        <p class="text-xs text-text-muted uppercase font-semibold tracking-wider">Revisión</p>
        <p class="text-2xl font-bold text-amber-600 mt-1">{{ d.counts.revision || 0 }}</p>
      </div>
      <div class="bg-surface border border-border rounded-xl p-4 shadow-sm">
        <p class="text-xs text-text-muted uppercase font-semibold tracking-wider">Aprobadas</p>
        <p class="text-2xl font-bold text-emerald-600 mt-1">{{ d.counts.aprobada || 0 }}</p>
      </div>
      <div class="bg-surface border border-border rounded-xl p-4 shadow-sm">
        <p class="text-xs text-text-muted uppercase font-semibold tracking-wider">Adjudicadas</p>
        <p class="text-2xl font-bold text-primary mt-1">{{ d.counts.adjudicada || 0 }}</p>
      </div>
    </div>

    <!-- Award total + Rechazadas -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div class="bg-gradient-to-br from-primary-light to-surface border border-primary-border rounded-xl p-4 shadow-sm">
        <p class="text-xs text-primary uppercase font-semibold tracking-wider">Monto Adjudicado</p>
        <p class="text-2xl font-bold text-primary mt-1">{{ d.totalAwardAmount }}</p>
      </div>
      <div class="bg-surface border border-border rounded-xl p-4 shadow-sm">
        <p class="text-xs text-text-muted uppercase font-semibold tracking-wider">Rechazadas</p>
        <p class="text-2xl font-bold text-red-500 mt-1">{{ d.counts.rechazada || 0 }}</p>
      </div>
      <div class="bg-surface border border-border rounded-xl p-4 shadow-sm">
        <p class="text-xs text-text-muted uppercase font-semibold tracking-wider">Tasa de Éxito</p>
        <p class="text-2xl font-bold text-text mt-1">
          {{ d.total ? Math.round((d.counts.aprobada + d.counts.adjudicada) / d.total * 100) : 0 }}%
        </p>
      </div>
    </div>

    <!-- Recent proposals -->
    <div class="bg-surface border border-border rounded-xl shadow-sm">
      <div class="px-4 py-3 border-b border-border">
        <h2 class="text-sm font-bold text-text">Recientes</h2>
      </div>
      <div v-if="!d.recent.length" class="px-4 py-8 text-center text-text-dim text-sm">No hay propuestas aún.</div>
      <table v-else class="w-full text-xs">
        <thead>
          <tr class="bg-bg-app text-text-muted uppercase tracking-wider text-[10px]">
            <th class="py-2 px-4 text-left font-semibold">N°</th>
            <th class="py-2 px-4 text-left font-semibold">Cliente</th>
            <th class="py-2 px-4 text-left font-semibold">Fecha</th>
            <th class="py-2 px-4 text-center font-semibold">Estado</th>
            <th class="py-2 px-4 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in d.recent" :key="r.quoteNumber" class="border-b border-border-light hover:bg-bg-app/50 transition cursor-pointer"
            @click="loadBudgetByNum(r.quoteNumber); state.activeSection = 'propuestas'; state.activeTab = 'propuesta'">
            <td class="py-2.5 px-4 font-mono text-text">{{ r.quoteNumber }}</td>
            <td class="py-2.5 px-4 text-text-muted">{{ r.client }}</td>
            <td class="py-2.5 px-4 text-text-muted">{{ r.date }}</td>
            <td class="py-2.5 px-4 text-center">
              <span class="inline-flex text-[9px] font-semibold px-2 py-0.5 rounded-full"
                :class="r.status === 'adjudicada' ? 'bg-primary-light text-primary' : r.status === 'aprobada' ? 'bg-emerald-100 text-emerald-700' : r.status === 'rechazada' ? 'bg-red-100 text-red-700' : r.status === 'revision' ? 'bg-amber-100 text-amber-700' : r.status === 'enviada' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'">
                {{ r.statusLabel }}
              </span>
            </td>
            <td class="py-2.5 px-4 text-right font-semibold text-text">{{ r.total }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
