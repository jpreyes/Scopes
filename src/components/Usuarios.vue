<script setup>
import { ref, onMounted } from 'vue'
import * as pb from '../stores/pocketbase.js'
import { usePresupuesto } from '../stores/presupuesto.js'
const { state, toast } = usePresupuesto()

const users = ref([])
const editingId = ref(null)
const form = ref({ name: '', email: '', cargo: '', role: 'user', password: '' })
const error = ref('')

const emptyForm = () => ({ name: '', email: '', cargo: '', role: 'user', password: '' })

async function load() {
  if (!state.dbConnected) return
  try {
    const items = await pb.getUsers()
    // Sin campos `created`/`updated` en el esquema: se ordena en cliente.
    users.value = items.sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || ''))
  } catch (e) { error.value = e.message }
}

onMounted(load)

function openAdd() { editingId.value = '__new__'; form.value = emptyForm(); error.value = '' }
function openEdit(u) {
  editingId.value = u.id
  form.value = { name: u.name || '', email: u.email || '', cargo: u.cargo || '', role: u.role || 'user', password: '' }
  error.value = ''
}
function cancelForm() { editingId.value = null; error.value = '' }

async function submitForm() {
  error.value = ''
  const f = form.value
  if (!f.email) { error.value = 'El email es obligatorio.'; return }
  try {
    if (editingId.value === '__new__') {
      if (!f.password || f.password.length < 8) { error.value = 'La contraseña debe tener al menos 8 caracteres.'; return }
      await pb.saveUser({
        email: f.email, password: f.password, passwordConfirm: f.password,
        name: f.name, cargo: f.cargo, role: f.role,
        emailVisibility: true, verified: true,
      })
    } else {
      const body = { id: editingId.value, name: f.name, cargo: f.cargo, role: f.role, emailVisibility: true }
      if (f.password) {
        if (f.password.length < 8) { error.value = 'La contraseña debe tener al menos 8 caracteres.'; return }
        body.password = f.password
        body.passwordConfirm = f.password
      }
      await pb.saveUser(body)
    }
    editingId.value = null
    toast('Usuario guardado')
    load()
  } catch (e) { error.value = e.message }
}

async function confirmDelete(u) {
  if (u.id === state.user?.id) { toast('No puedes eliminar tu propia cuenta'); return }
  if (!confirm(`¿Eliminar a ${u.name || u.email}?`)) return
  try { await pb.deleteUser(u.id); toast('Usuario eliminado'); load() }
  catch (e) { error.value = e.message }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-bold text-text">Usuarios</h1>
      <button @click="openAdd" class="px-3 py-1.5 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition cursor-pointer">+ Usuario</button>
    </div>

    <p v-if="error" class="text-xs text-red-500 font-medium">{{ error }}</p>

    <!-- Form -->
    <div v-if="editingId !== null" class="bg-surface border border-border rounded-xl p-4 shadow-sm space-y-3">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input v-model="form.name" placeholder="Nombre" class="px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-primary bg-surface" />
        <input v-model="form.email" type="email" placeholder="Email *" :disabled="editingId !== '__new__'"
          class="px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-primary bg-surface disabled:opacity-60" />
        <input v-model="form.cargo" placeholder="Cargo" class="px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-primary bg-surface" />
        <select v-model="form.role" class="px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-primary bg-surface">
          <option value="user">Usuario</option>
          <option value="admin">Administrador</option>
        </select>
        <input v-model="form.password" type="password" autocomplete="new-password"
          :placeholder="editingId === '__new__' ? 'Contraseña * (mín. 8)' : 'Nueva contraseña (dejar vacío para no cambiar)'"
          class="px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-primary bg-surface sm:col-span-2" />
      </div>
      <div class="flex gap-2">
        <button @click="submitForm" class="px-3 py-1.5 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition cursor-pointer">Guardar</button>
        <button @click="cancelForm" class="px-3 py-1.5 text-xs font-semibold text-text-muted border border-border rounded-lg hover:bg-bg-app transition cursor-pointer">Cancelar</button>
      </div>
    </div>

    <!-- List -->
    <div v-if="!users.length" class="text-center py-16 text-text-dim">
      <p class="text-sm">No hay usuarios que mostrar.</p>
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <div v-for="u in users" :key="u.id" class="bg-surface border border-border rounded-xl p-4 shadow-sm">
        <div class="flex items-start justify-between">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-bold text-text truncate">{{ u.name || '(sin nombre)' }}</p>
            <p class="text-xs text-text-muted truncate">{{ u.email }}</p>
          </div>
          <div class="flex gap-1 shrink-0 ml-2">
            <button @click="openEdit(u)" class="text-text-dim hover:text-text transition text-xs px-1 cursor-pointer" title="Editar">✎</button>
            <button @click="confirmDelete(u)" class="text-text-dim hover:text-danger transition text-xs px-1 cursor-pointer" title="Eliminar">✕</button>
          </div>
        </div>
        <div class="mt-2 flex items-center gap-2">
          <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            :class="u.role === 'admin' ? 'bg-primary-light text-primary' : 'bg-bg-app text-text-muted'">
            {{ u.role === 'admin' ? 'Administrador' : 'Usuario' }}
          </span>
          <span v-if="u.cargo" class="text-[11px] text-text-dim truncate">{{ u.cargo }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
