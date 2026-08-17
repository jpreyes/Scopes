<script setup>
import { computed as vueComputed } from 'vue'
import { usePresupuesto } from '../stores/presupuesto.js'
import { SECTIONS } from '../nav.js'
const { state, computed, goSection } = usePresupuesto()

const visibleSections = vueComputed(() =>
  SECTIONS.filter(s => !s.adminOnly || computed.isAdmin.value)
)
</script>

<template>
  <!--
    Riel de escritorio. Bajo 768 px no existe —lo reemplaza <BottomNav />—, y
    ese `hidden` es literal: antes se encogía a `w-0` pero seguía en el flujo,
    con `sidebarOpen` en `true` por defecto se comía 224 px de una pantalla de
    390 y dejaba la app en 166.
  -->
  <aside
    class="hidden md:flex bg-surface border-r border-border flex-col shrink-0 transition-all duration-200 sticky top-0 h-screen overflow-y-auto"
    :class="state.sidebarOpen ? 'w-56' : 'w-14'">
    <nav class="flex-1 py-3 space-y-0.5 px-2 overflow-y-auto">
      <button v-for="sec in visibleSections" :key="sec.id"
        class="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors duration-150 cursor-pointer"
        :class="state.activeSection === sec.id ? 'bg-primary-light text-primary font-semibold' : 'text-text-muted hover:bg-bg-app hover:text-text'"
        :title="sec.label"
        @click="goSection(sec.id)">
        <span v-html="sec.icon" class="shrink-0"></span>
        <span v-show="state.sidebarOpen" class="truncate">{{ sec.label }}</span>
      </button>
    </nav>
  </aside>
</template>
