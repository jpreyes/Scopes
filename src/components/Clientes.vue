<script setup>
import { ref } from 'vue'
import { usePresupuesto } from '../stores/presupuesto.js'
const { state, saveClient, deleteClient } = usePresupuesto()

const editingId = ref(null)
const form = ref({ name: '', company: '', email: '', phone: '', address: '', notes: '' })

function openAdd() { editingId.value = '__new__'; form.value = { name: '', company: '', email: '', phone: '', address: '', notes: '' } }
function openEdit(c) { editingId.value = c.id; form.value = { ...c } }
function cancelForm() { editingId.value = null }
function submitForm() {
  if (!form.value.name) return
  saveClient({ ...form.value, id: editingId.value === '__new__' ? Date.now() + '' : editingId.value })
  editingId.value = null
}
function confirmDelete(id) {
  if (confirm('¿Eliminar este cliente?')) deleteClient(id)
}
function selectClient(c) {
  state.clientName = c.name
  state.clientCompany = c.company || ''
  state.clientEmail = c.email || ''
  state.clientPhone = c.phone || ''
  state.clientAddr = c.address || ''
  state.activeSection = 'propuestas'
  state.activeTab = 'propuesta'
}
</script>

<template>
  <div class="p-3 sm:p-6 space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-bold text-text">Clientes</h1>
      <button @click="openAdd" class="px-3 py-1.5 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition cursor-pointer">+ Cliente</button>
    </div>

    <!-- Form -->
    <div v-if="editingId !== null" class="bg-surface border border-border rounded-xl p-4 shadow-sm space-y-3">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input v-model="form.name" placeholder="Nombre *" class="px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-primary bg-surface col-span-2" />
        <input v-model="form.company" placeholder="Empresa" class="px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-primary bg-surface" />
        <input v-model="form.email" placeholder="Email" class="px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-primary bg-surface" />
        <input v-model="form.phone" placeholder="Teléfono" class="px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-primary bg-surface" />
        <input v-model="form.address" placeholder="Dirección" class="px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-primary bg-surface col-span-2" />
        <textarea v-model="form.notes" placeholder="Notas…" rows="2" class="px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-primary bg-surface col-span-2 resize-none"></textarea>
      </div>
      <div class="flex gap-2">
        <button @click="submitForm" class="px-3 py-1.5 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition cursor-pointer">Guardar</button>
        <button @click="cancelForm" class="px-3 py-1.5 text-xs font-semibold text-text-muted border border-border rounded-lg hover:bg-bg-app transition cursor-pointer">Cancelar</button>
      </div>
    </div>

    <!-- List -->
    <div v-if="!state.clients.length" class="text-center py-16 text-text-dim">
      <p class="text-sm">No hay clientes registrados.</p>
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <div v-for="c in state.clients" :key="c.id"
        class="bg-surface border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
        @click="selectClient(c)">
        <div class="flex items-start justify-between">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-bold text-text truncate">{{ c.name }}</p>
            <p v-if="c.company" class="text-xs text-text-muted truncate">{{ c.company }}</p>
          </div>
          <div class="flex gap-1 shrink-0 ml-2" @click.stop>
            <button @click="openEdit(c)" class="text-text-dim hover:text-text transition text-xs px-1 cursor-pointer" title="Editar">✎</button>
            <button @click="confirmDelete(c.id)" class="text-text-dim hover:text-danger transition text-xs px-1 cursor-pointer" title="Eliminar">✕</button>
          </div>
        </div>
        <div v-if="c.email || c.phone" class="mt-2 space-y-0.5">
          <p v-if="c.email" class="text-[11px] text-text-dim truncate">{{ c.email }}</p>
          <p v-if="c.phone" class="text-[11px] text-text-dim">{{ c.phone }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
