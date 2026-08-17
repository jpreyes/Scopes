<script setup>
import { computed as vueComputed } from 'vue'
import { usePresupuesto } from '../stores/presupuesto.js'
import { SECTIONS, PRIMARY, MAS } from '../nav.js'
const { state, goSection } = usePresupuesto()

const tabs = vueComputed(() => [
  ...PRIMARY.map(id => SECTIONS.find(s => s.id === id)),
  MAS,
])

/**
 * «Más» queda encendida en todo lo que vive detrás de ella, no solo en la
 * lista: si entras a Clientes desde ahí, la barra sigue diciendo de dónde
 * saliste en vez de apagarse entera.
 */
function isActive(id) {
  return id === MAS.id
    ? !PRIMARY.includes(state.activeSection)
    : state.activeSection === id
}
</script>

<template>
  <!--
    Píldora flotante, no barra a lo ancho: al alcance del pulgar y sin tapar
    todo el borde inferior. Desaparece en `md`, donde el riel lateral hace el
    trabajo —una barra inferior en escritorio desperdicia el único eje que a
    esa pantalla le sobra.
  -->
  <nav aria-label="Principal"
    class="bottom-tabbar no-print fixed inset-x-0 z-40 mx-auto flex w-fit max-w-[calc(100vw-1.5rem)] items-center rounded-full border border-border bg-surface/95 p-1 shadow-lg backdrop-blur md:hidden">
    <button v-for="t in tabs" :key="t.id"
      :aria-current="isActive(t.id) ? 'page' : undefined"
      class="flex min-w-0 flex-col items-center gap-1 rounded-full px-3.5 py-2 transition-colors cursor-pointer"
      :class="isActive(t.id) ? 'bg-primary-light' : 'active:bg-bg-app'"
      @click="goSection(t.id)">
      <span v-html="t.icon" class="shrink-0"
        :class="isActive(t.id) ? 'text-primary' : 'text-text-dim'"></span>
      <span class="max-w-[4.5rem] truncate text-[10px] leading-none"
        :class="isActive(t.id) ? 'font-semibold text-primary' : 'text-text-muted'">
        {{ t.short }}
      </span>
    </button>
  </nav>
</template>
