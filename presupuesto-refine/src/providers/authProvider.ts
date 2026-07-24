import type { AuthProvider } from '@refinedev/core'
import { getPB } from './pocketbaseClient'

export const authProvider: AuthProvider = {
  login: async ({ email, password }) => {
    try {
      const pb = getPB()
      const authData = await pb.collection('users').authWithPassword(email, password)
      localStorage.setItem('pb_token', authData.token)
      return { success: true, redirectTo: '/' }
    } catch (error: any) {
      return { success: false, error: { name: 'LoginError', message: error?.message || 'Error al iniciar sesión' } }
    }
  },
  logout: async () => {
    getPB().authStore.clear()
    localStorage.removeItem('pb_token')
    return { success: true, redirectTo: '/login' }
  },
  check: async () => {
    const token = localStorage.getItem('pb_token')
    if (token) {
      getPB().authStore.save(token, null as any)
      try {
        await getPB().collection('users').authRefresh()
        return { authenticated: true }
      } catch {
        localStorage.removeItem('pb_token')
        return { authenticated: false, redirectTo: '/login' }
      }
    }
    return { authenticated: false, redirectTo: '/login' }
  },
  getIdentity: async () => {
    const pb = getPB()
    if (pb.authStore.isValid) {
      try {
        const user = await pb.collection('users').authRefresh()
        return { id: user.record.id, email: user.record.email, name: user.record.name }
      } catch {
        return null
      }
    }
    return null
  },
  onError: async (error) => {
    if (error?.status === 401) {
      return { logout: true, redirectTo: '/login' }
    }
    return {}
  },
  register: async ({ email, password }) => {
    try {
      await getPB().collection('users').create({ email, password, passwordConfirm: password })
      return { success: true, redirectTo: '/login' }
    } catch (error: any) {
      return { success: false, error: { name: 'RegisterError', message: error?.message || 'Error al registrarse' } }
    }
  },
}
