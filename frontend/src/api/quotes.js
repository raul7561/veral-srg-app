const API_URL = import.meta.env.VITE_API_URL
const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true"

async function getJson(path) {
  const res = await fetch(`${API_URL}${path}`)
  if (!res.ok) throw new Error(`GET ${path} failed with status ${res.status}`)
  return res.json()
}

export function getQuotes(params = {}) {
  const qs = new URLSearchParams(params).toString()
  return getJson(`/api/quotes${qs ? `?${qs}` : ""}`)
}

export function getQuote(id) {
  return getJson(`/api/quotes/${id}`)
}

export async function parseExport(file, priceLevel = "US_LIST") {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("price_level", priceLevel)
  const res = await fetch(`${API_URL}/api/quotes/parse`, { method: "POST", body: formData })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || `parse failed with status ${res.status}`)
  }
  return res.json()
}

export async function calculateQuote(priceLevel, lines) {
  const res = await fetch(`${API_URL}/api/quotes/calculate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ price_level: priceLevel, lines }),
  })
  if (!res.ok) throw new Error(`calculate failed with status ${res.status}`)
  return res.json()
}

export async function createQuote(payload) {
  const res = await fetch(`${API_URL}/api/quotes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || `create failed with status ${res.status}`)
  }
  return res.json()
}

export async function updateQuote(id, payload) {
  const res = await fetch(`${API_URL}/api/quotes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || `update failed with status ${res.status}`)
  }
  return res.json()
}

export async function previewQuote(payload) {
  const res = await fetch(`${API_URL}/api/quotes/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || `preview failed with status ${res.status}`)
  }
  return res.text()
}

export function getClients() {
  return getJson('/api/clients')
}

export function quotePdfUrl(id) {
  return `${API_URL}/api/quotes/${id}/pdf`
}

export function quoteExcelUrl(id) {
  return `${API_URL}/api/quotes/${id}/excel`
}

export function quoteHtmlUrl(id) {
  return `${API_URL}/api/quotes/${id}/html`
}
