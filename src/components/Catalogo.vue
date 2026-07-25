<script setup>
import { ref } from 'vue'
import { usePresupuesto } from '../stores/presupuesto.js'
const { state, saveCatalogItem, deleteCatalogItem } = usePresupuesto()

const editingId = ref(null)
const form = ref({ name: '', price: 0, unit: 'und', category: '' })

function openAdd() { editingId.value = null; form.value = { name: '', price: 0, unit: 'und', category: '' } }
function openEdit(item) { editingId.value = item.id; form.value = { ...item } }
function cancelForm() { editingId.value = null }
function submitForm() {
  if (!form.value.name || !form.value.price) return
  saveCatalogItem({ ...form.value, id: editingId.value || Date.now() + '' })
  editingId.value = null
}
function confirmDelete(id) {
  if (confirm('¿Eliminar producto?')) deleteCatalogItem(id)
}
function useItem(item) {
  state.proposalItems.push({ desc: item.name, qty: 1, price: item.price })
  state.activeSection = 'propuestas'
  state.activeTab = 'propuesta'
}

const units = ['und', 'hora', 'día', 'semana', 'mes', 'global']
</script>

<template>
  <div class="p-3 sm:p-6 space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-bold text-text">Catálogo</h1>
      <button @click="openAdd" class="px-3 py-1.5 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition cursor-pointer">+ Producto</button>
    </div>

    <!-- Form -->
    <div v-if="editingId !== null" class="bg-surface border border-border rounded-xl p-4 shadow-sm space-y-3">
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <input v-model="form.name" placeholder="Nombre *" class="px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-primary bg-surface col-span-2" />
        <input v-model.number="form.price" type="number" min="0" placeholder="Precio *" class="px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-primary bg-surface" />
        <select v-model="form.unit" class="px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-primary bg-surface">
          <option v-for="u in units" :key="u" :value="u">{{ u }}</option>
        </select>
        <input v-model="form.category" placeholder="Categoría" class="px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-primary bg-surface col-span-3" />
      </div>
      <div class="flex gap-2">
        <button @click="submitForm" class="px-3 py-1.5 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition cursor-pointer">Guardar</button>
        <button @click="cancelForm" class="px-3 py-1.5 text-xs font-semibold text-text-muted border border-border rounded-lg hover:bg-bg-app transition cursor-pointer">Cancelar</button>
      </div>
    </div>

    <!-- List -->
    <div v-if="!state.catalog.length" class="text-center py-16 text-text-dim">
      <p class="text-sm">No hay productos en el catálogo.</p>
    </div>

    <div v-else class="overflow-x-auto">
      <table class="w-full text-xs">
        <thead>
          <tr class="bg-bg-app text-text-muted uppercase tracking-wider text-[10px]">
            <th class="py-2 px-3 text-left font-semibold">Producto</th>
            <th class="py-2 px-3 text-left font-semibold">Categoría</th>
            <th class="py-2 px-3 text-center font-semibold">Unidad</th>
            <th class="py-2 px-3 text-right font-semibold">Precio</th>
            <th class="py-2 px-3 text-center font-semibold w-20">Acción</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in state.catalog" :key="item.id" class="border-b border-border-light hover:bg-bg-app/50 transition">
            <td class="py-2 px-3 text-text font-medium">{{ item.name }}</td>
            <td class="py-2 px-3 text-text-muted">{{ item.category || '—' }}</td>
            <td class="py-2 px-3 text-center text-text-muted">{{ item.unit }}</td>
            <td class="py-2 px-3 text-right font-semibold text-text">$ {{ Number(item.price).toLocaleString('es-CL') }}</td>
            <td class="py-2 px-3 text-center">
              <div class="flex items-center justify-center gap-1">
                <button @click="useItem(item)" class="px-2 py-1 text-[10px] font-semibold bg-primary text-white rounded hover:bg-primary-hover transition cursor-pointer" title="Usar en propuesta">+</button>
                <button @click="openEdit(item)" class="text-text-dim hover:text-text transition text-xs px-1 cursor-pointer">✎</button>
                <button @click="confirmDelete(item.id)" class="text-text-dim hover:text-danger transition text-xs px-1 cursor-pointer">✕</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
