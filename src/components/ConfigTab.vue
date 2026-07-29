<script setup>
import { ref } from 'vue'
import { usePresupuesto } from '../stores/presupuesto.js'
import * as pb from '../stores/pocketbase.js'

const { state, toast } = usePresupuesto()

const editName = ref(state.user?.name || '')
const editEmail = ref(state.user?.email || '')
const editCargo = ref(state.user?.cargo || '')
const saving = ref(false)

async function saveProfile() {
  saving.value = true
  try {
    const body = { name: editName.value, cargo: editCargo.value }
    if (editEmail.value !== state.user?.email) body.email = editEmail.value
    const res = await fetch(pb.getBaseUrl() + '/api/collections/users/records/' + state.user?.id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessionStorage.getItem('pb_user_token') },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error('Error al guardar')
    const updated = await res.json()
    state.user = updated
    sessionStorage.setItem('pb_user', JSON.stringify(updated))
    toast('Perfil actualizado ✓')
  } catch (e) {
    toast(e.message || 'Error')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="max-w-lg mx-auto space-y-8 py-4">
    <h1 class="text-lg font-bold text-text">Mi Perfil</h1>

    <section class="bg-surface border border-border rounded-xl p-6 space-y-5">
      <div class="flex items-center gap-4">
        <div class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl shrink-0">
          {{ (state.user?.name || '?')[0].toUpperCase() }}
        </div>
        <div>
          <p class="text-sm font-bold text-text">{{ state.user?.name || 'Usuario' }}</p>
          <p class="text-xs text-text-muted">{{ state.user?.email }}</p>
        </div>
      </div>

      <div class="space-y-4">
        <label class="text-xs text-text-muted">
          Nombre
          <input type="text" v-model="editName" class="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-primary bg-bg-app text-text" />
        </label>
        <label class="text-xs text-text-muted">
          Email
          <input type="email" v-model="editEmail" class="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-primary bg-bg-app text-text" />
        </label>
        <label class="text-xs text-text-muted">
          Cargo
          <input type="text" v-model="editCargo" placeholder="Ej: Ingeniero Senior" class="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-primary bg-bg-app text-text" />
        </label>
      </div>

      <button @click="saveProfile" :disabled="saving"
        class="w-full py-2.5 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition cursor-pointer disabled:opacity-50">
        {{ saving ? 'Guardando…' : 'Guardar cambios' }}
      </button>
    </section>

    <section class="bg-surface border border-border rounded-xl p-5 space-y-2 text-xs text-text-muted">
      <h2 class="text-sm font-bold text-text border-b border-border pb-2">Acerca de</h2>
      <p><strong>Scopes</strong> — Sistema de presupuestos y cotizaciones</p>
      <p>Versión 1.0.0</p>
    </section>
  </div>
</template>
