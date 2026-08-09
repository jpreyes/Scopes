const BASE = import.meta.env.VITE_PB_URL || 'http://localhost:8090'
export function getBaseUrl() { return BASE }

let userToken = null

async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' }
  if (userToken) headers['Authorization'] = 'Bearer ' + userToken
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || res.statusText) }
  return res.json()
}

// --- Web user auth ---
// Toda la app trabaja con el token del usuario logueado. NO existe login de
// _superusers en el frontend: Vite hornea las env vars en el bundle público.

export async function loginUser(email, password) {
  const data = await api('POST', '/api/collections/users/auth-with-password', { identity: email, password })
  userToken = data.token
  sessionStorage.setItem('pb_user_token', data.token)
  sessionStorage.setItem('pb_user', JSON.stringify(data.record))
  return data
}

export function restoreUserToken() {
  userToken = sessionStorage.getItem('pb_user_token')
  return !!userToken
}

export function getLoggedUser() {
  const raw = sessionStorage.getItem('pb_user')
  return raw ? JSON.parse(raw) : null
}

export function logoutUser() {
  userToken = null
  sessionStorage.removeItem('pb_user_token')
  sessionStorage.removeItem('pb_user')
}

// Revalida el token guardado y devuelve el record fresco (trae `role` al día).
export async function refreshUser() {
  const data = await api('POST', '/api/collections/users/auth-refresh')
  userToken = data.token
  sessionStorage.setItem('pb_user_token', data.token)
  sessionStorage.setItem('pb_user', JSON.stringify(data.record))
  return data.record
}

// --- Users (gestión, solo admins por reglas de la colección) ---

export async function getUsers() {
  const data = await api('GET', '/api/collections/users/records?perPage=500')
  return data.items
}

export async function saveUser(user) {
  if (user.id && user.id.length === 15) {
    return await api('PATCH', '/api/collections/users/records/' + user.id, user)
  }
  const body = { ...user }; delete body.id
  const created = await api('POST', '/api/collections/users/records', body)
  return { ...user, id: created.id }
}

export async function deleteUser(id) {
  await api('DELETE', '/api/collections/users/records/' + id)
}

// --- Clients ---

export async function getClients() {
  const data = await api('GET', '/api/collections/clients/records?perPage=500')
  return data.items
}

export async function saveClient(client) {
  if (client.id && client.id.length === 15) {
    return await api('PATCH', '/api/collections/clients/records/' + client.id, client)
  }
  const body = { ...client }; delete body.id
  const created = await api('POST', '/api/collections/clients/records', body)
  return { ...client, id: created.id }
}

export async function deleteClient(id) {
  await api('DELETE', '/api/collections/clients/records/' + id)
}

// --- Catalog ---

export async function getCatalog() {
  const data = await api('GET', '/api/collections/catalog/records?perPage=500')
  return data.items
}

export async function saveCatalogItem(item) {
  if (item.id && item.id.length === 15) {
    return await api('PATCH', '/api/collections/catalog/records/' + item.id, item)
  }
  const body = { ...item }; delete body.id
  const created = await api('POST', '/api/collections/catalog/records', body)
  return { ...item, id: created.id }
}

export async function deleteCatalogItem(id) {
  await api('DELETE', '/api/collections/catalog/records/' + id)
}

// --- Quotes ---

export async function getQuotes() {
  const data = await api('GET', '/api/collections/quotes/records?perPage=500')
  return data.items
}

export async function saveQuote(quote) {
  if (quote.id && quote.id.length === 15) {
    return await api('PATCH', '/api/collections/quotes/records/' + quote.id, quote)
  }
  const existing = await getQuoteByNum(quote.quoteNumber).catch(() => null)
  if (existing) {
    const body = { ...quote }
    delete body.id
    return await api('PATCH', '/api/collections/quotes/records/' + existing.id, body)
  }
  const body = { ...quote }
  delete body.id
  const created = await api('POST', '/api/collections/quotes/records', body)
  return { ...quote, id: created.id }
}

export async function deleteQuote(id) {
  await api('DELETE', '/api/collections/quotes/records/' + id)
}

export async function getQuoteByNum(quoteNumber) {
  const data = await api('GET', '/api/collections/quotes/records?filter=(quoteNumber%3D%22' + encodeURIComponent(quoteNumber) + '%22)')
  return data.items.length ? data.items[0] : null
}

export async function deleteQuoteByNum(quoteNumber) {
  const data = await api('GET', '/api/collections/quotes/records?filter=(quoteNumber%3D%22' + encodeURIComponent(quoteNumber) + '%22)')
  if (data.items.length) await api('DELETE', '/api/collections/quotes/records/' + data.items[0].id)
}

// --- Proyectos ---

export async function getProyectos() {
  const data = await api('GET', '/api/collections/proyectos/records?perPage=500')
  return data.items
}

export async function saveProyecto(record) {
  if (record.id && record.id.length === 15) {
    return await api('PATCH', '/api/collections/proyectos/records/' + record.id, record)
  }
  const body = { ...record }; delete body.id
  const created = await api('POST', '/api/collections/proyectos/records', body)
  return { ...record, id: created.id }
}

export async function deleteProyecto(id) {
  await api('DELETE', '/api/collections/proyectos/records/' + id)
}

// --- Ingresos ---

export async function getIngresos() {
  const data = await api('GET', '/api/collections/ingresos/records?perPage=1000')
  return data.items
}

export async function saveIngreso(record) {
  if (record.id && record.id.length === 15) {
    return await api('PATCH', '/api/collections/ingresos/records/' + record.id, record)
  }
  const body = { ...record }; delete body.id
  const created = await api('POST', '/api/collections/ingresos/records', body)
  return { ...record, id: created.id }
}

export async function deleteIngreso(id) {
  await api('DELETE', '/api/collections/ingresos/records/' + id)
}

// --- Egresos ---

export async function getEgresos() {
  const data = await api('GET', '/api/collections/egresos/records?perPage=1000')
  return data.items
}

export async function saveEgreso(record) {
  if (record.id && record.id.length === 15) {
    return await api('PATCH', '/api/collections/egresos/records/' + record.id, record)
  }
  const body = { ...record }; delete body.id
  const created = await api('POST', '/api/collections/egresos/records', body)
  return { ...record, id: created.id }
}

export async function deleteEgreso(id) {
  await api('DELETE', '/api/collections/egresos/records/' + id)
}
