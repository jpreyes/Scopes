<script setup>
import { usePresupuesto } from '../stores/presupuesto.js'
const { state } = usePresupuesto()
</script>

<template>
  <div class="relative w-full min-h-[500px] rounded-xl overflow-hidden"
    style="background-image: url(/images/image2.png); background-size: cover; background-position: center;">
    <div class="absolute inset-0 bg-gradient-to-br from-slate-900/85 via-slate-800/65 to-slate-900/85"></div>
    <div class="relative z-10 flex flex-col items-center justify-center h-full min-h-[500px] text-white text-center px-8">
      <div class="mb-6 bg-white/10 backdrop-blur-sm px-8 py-4 rounded-2xl">
        <img src="/images/image1.png" alt="Logo" class="h-14 opacity-90 mx-auto" />
      </div>
      <h1 class="text-4xl md:text-5xl font-extrabold tracking-wide drop-shadow-lg mb-3">OFERTA TÉCNICO-ECONÓMICA</h1>
      <h2 class="text-xl md:text-2xl font-medium opacity-90 mb-4">{{ state.subheader }}</h2>
      <div class="text-2xl md:text-3xl font-bold tracking-[0.15em] uppercase px-8 py-3 border-2 border-white/30 rounded-xl mb-6">
        {{ state.headerClient || state.clientName || 'CLIENTE' }}
      </div>
      <div class="w-24 h-0.5 bg-primary rounded mb-5"></div>
      <div class="text-xl font-mono font-bold tracking-wider mb-4">{{ state.quoteNumber }}</div>
      <div class="flex gap-8 text-sm opacity-80">
        <span>Contacto: {{ state.contactPerson || '—' }}</span>
        <span>Fecha: {{ state.quoteDate }}</span>
      </div>
    </div>
  </div>
</template>
