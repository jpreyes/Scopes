const BASE = import.meta.env.VITE_PB_URL || 'http://localhost:8090'
export function getBaseUrl() { return BASE }

let token = null
let userToken = null

async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' }
  const t = userToken || token
  if (t) headers['Authorization'] = 'Bearer ' + t
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || res.statusText) }
  return res.json()
}

// --- Admin superuser auth (backend ops) ---

export async function login(email, password) {
  const data = await api('POST', '/api/collections/_superusers/auth-with-password', { identity: email, password })
  token = data.token
  sessionStorage.setItem('pb_token', token)
  return data
}

export function restoreToken() {
  token = sessionStorage.getItem('pb_token')
  return !!token
}

export function clearToken() {
  token = null
  sessionStorage.removeItem('pb_token')
}

// --- Web user auth ---

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

export async function registerUser(email, password, name) {
  const res = await fetch(BASE + '/api/collections/users/records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, passwordConfirm: password, name }),
  })
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || 'Error al registrar') }
  return res.json()
}

// --- Clients ---

export async function getClients() {
  const data = await api('GET', '/api/collections/clients/records?sort=-created')
  return data.items
}

export async function saveClient(client) {
  if (client.id && client.id.length > 10) {
    return await api('PATCH', '/api/collections/clients/records/' + client.id, client)
  }
  const created = await api('POST', '/api/collections/clients/records', client)
  return { ...client, id: created.id }
}

export async function deleteClient(id) {
  await api('DELETE', '/api/collections/clients/records/' + id)
}

// --- Catalog ---

export async function getCatalog() {
  const data = await api('GET', '/api/collections/catalog/records?sort=-created')
  return data.items
}

export async function saveCatalogItem(item) {
  if (item.id && item.id.length > 10) {
    return await api('PATCH', '/api/collections/catalog/records/' + item.id, item)
  }
  const created = await api('POST', '/api/collections/catalog/records', item)
  return { ...item, id: created.id }
}

export async function deleteCatalogItem(id) {
  await api('DELETE', '/api/collections/catalog/records/' + id)
}

// --- Quotes ---

export async function getQuotes() {
  const data = await api('GET', '/api/collections/quotes/records?sort=-created&perPage=200')
  return data.items
}

export async function saveQuote(quote) {
  if (quote.id && quote.id.length > 10) {
    return await api('PATCH', '/api/collections/quotes/records/' + quote.id, quote)
  }
  const created = await api('POST', '/api/collections/quotes/records', quote)
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
