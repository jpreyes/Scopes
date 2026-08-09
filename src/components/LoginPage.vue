<script setup>
import { ref } from 'vue'
import * as pb from '../stores/pocketbase.js'
import { usePresupuesto } from '../stores/presupuesto.js'

const { state } = usePresupuesto()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

const emit = defineEmits(['auth'])

async function submit() {
  error.value = ''
  loading.value = true
  try {
    const data = await pb.loginUser(email.value, password.value)
    state.user = data.record
    emit('auth', data.record)
  } catch (e) {
    error.value = e.message || 'Error de autenticación'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-bg-app via-surface to-bg-app flex items-center justify-center p-4">
    <div class="w-full max-w-sm bg-surface border border-border rounded-2xl p-8 shadow-lg">
      <div class="text-center mb-6">
        <img src="/images/image1.png" alt="Logo" class="h-12 mx-auto mb-3" />
        <h1 class="text-xl font-bold text-text">Scopes</h1>
        <p class="text-xs text-text-muted mt-1">Sistema de Presupuestos</p>
      </div>

      <form @submit.prevent="submit" class="space-y-4">
        <label class="text-xs text-text-muted">
          Email
          <input type="email" v-model="email" required placeholder="correo@ejemplo.cl"
            class="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-primary bg-bg-app text-text" />
        </label>
        <label class="text-xs text-text-muted">
          Contraseña
          <input type="password" v-model="password" required
            class="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-primary bg-bg-app text-text" />
        </label>

        <p v-if="error" class="text-xs text-red-500 font-medium">{{ error }}</p>

        <button type="submit" :disabled="loading"
          class="w-full py-2.5 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition cursor-pointer disabled:opacity-50">
          {{ loading ? '…' : 'Iniciar sesión' }}
        </button>
      </form>

      <p class="text-center text-xs text-text-muted mt-5">
        Las cuentas las crea un administrador desde la sección Usuarios.
      </p>
    </div>
  </div>
</template>
