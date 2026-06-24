import { authHeaders, fetchWithAuth } from "./_auth"

const API_URL = import.meta.env.VITE_API_URL

async function getJson(path) {
  const res = await fetchWithAuth(`${API_URL}${path}`, {
    headers: await authHeaders(),
  })
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
  const res = await fetchWithAuth(`${API_URL}/api/quotes/parse`, {
    method: "POST",
    headers: await authHeaders(),
    body: formData,
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || `parse failed with status ${res.status}`)
  }
  return res.json()
}

export async function calculateQuote(priceLevel, lines) {
  const res = await fetchWithAuth(`${API_URL}/api/quotes/calculate`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ price_level: priceLevel, lines }),
  })
  if (!res.ok) throw new Error(`calculate failed with status ${res.status}`)
  return res.json()
}

export async function createQuote(payload) {
  const res = await fetchWithAuth(`${API_URL}/api/quotes`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || `create failed with status ${res.status}`)
  }
  return res.json()
}

export async function updateQuote(id, payload) {
  const res = await fetchWithAuth(`${API_URL}/api/quotes/${id}`, {
    method: "PATCH",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || `update failed with status ${res.status}`)
  }
  return res.json()
}

export async function convertQuote(id, payload) {
  const res = await fetchWithAuth(`${API_URL}/api/quotes/${id}/convert`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || `convert failed with status ${res.status}`)
  }
  return res.json()
}

export async function previewQuote(payload) {
  const res = await fetchWithAuth(`${API_URL}/api/quotes/preview`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
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

// Extrae el filename del header Content-Disposition; si no está, usa fallback.
function filenameFromResponse(res, fallback) {
  const cd = res.headers.get("Content-Disposition") || ""
  const match = cd.match(/filename="?([^"]+)"?/)
  return match ? match[1] : fallback
}

// Dispara la descarga de un blob con el nombre dado.
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function downloadQuotePdf(id, fallbackName = `Quote_${id}.pdf`) {
  const res = await fetchWithAuth(`${API_URL}/api/quotes/${id}/pdf`, {
    headers: await authHeaders(),
  })
  if (!res.ok) throw new Error(`pdf download failed with status ${res.status}`)
  const blob = await res.blob()
  triggerDownload(blob, filenameFromResponse(res, fallbackName))
}

export async function downloadQuoteExcel(id, fallbackName = `Quote_${id}.xlsx`) {
  const res = await fetchWithAuth(`${API_URL}/api/quotes/${id}/excel`, {
    headers: await authHeaders(),
  })
  if (!res.ok) throw new Error(`excel download failed with status ${res.status}`)
  const blob = await res.blob()
  triggerDownload(blob, filenameFromResponse(res, fallbackName))
}

export async function fetchQuoteHtml(id) {
  const res = await fetchWithAuth(`${API_URL}/api/quotes/${id}/html`, {
    headers: await authHeaders(),
  })
  if (!res.ok) throw new Error(`html fetch failed with status ${res.status}`)
  return res.text()
}
