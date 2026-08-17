<script setup>
import { computed as vueComputed } from 'vue'
import { usePresupuesto } from '../stores/presupuesto.js'
import { SECTIONS, MAS_GROUPS } from '../nav.js'
const { computed, goSection } = usePresupuesto()

/**
 * Los grupos ya filtrados: a un usuario sin permisos de administrador el
 * segundo grupo le queda vacío, y un grupo vacío no debe dejar su separador
 * flotando.
 */
const groups = vueComputed(() =>
  MAS_GROUPS
    .map(g => g.items
      .map(id => SECTIONS.find(s => s.id === id))
      .filter(s => s && (!s.adminOnly || computed.isAdmin.value)))
    .filter(items => items.length)
)
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-lg font-bold text-text">Más</h1>

    <div class="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
      <template v-for="(items, gi) in groups" :key="gi">
        <div v-if="gi > 0" class="h-2 bg-bg-app border-y border-border"></div>
        <button v-for="sec in items" :key="sec.id"
          class="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors cursor-pointer hover:bg-bg-app active:bg-bg-app border-b border-border-light last:border-b-0"
          @click="goSection(sec.id)">
          <span v-html="sec.icon" class="shrink-0 text-text-dim"></span>
          <span class="flex-1 min-w-0 truncate text-sm font-medium text-text">{{ sec.label }}</span>
          <span class="shrink-0 text-text-dim">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </span>
        </button>
      </template>
    </div>
  </div>
</template>
