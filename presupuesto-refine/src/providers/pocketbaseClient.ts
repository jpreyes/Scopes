import PocketBase from 'pocketbase'

const pb = new PocketBase('http://127.0.0.1:8090')

export function getPB() {
  return pb
}

export function ensureAuth() {
  const token = localStorage.getItem('pb_token')
  if (token) {
    pb.authStore.save(token, null as any)
  }
}
