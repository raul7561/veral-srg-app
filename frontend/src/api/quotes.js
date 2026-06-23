import { supabase } from "../lib/supabaseClient"

const API_URL = import.meta.env.VITE_API_URL

async function authHeaders(extra = {}) {
  const { data } = await supabase.auth.getSession()
  let session = data?.session

  if (!session) return { ...extra }

  if (session.expires_at - Date.now() / 1000 <= 60) {
    try {
      const { data: refreshData } = await supabase.auth.refreshSession()
      session = refreshData?.session || session
    } catch {
      // Continue with the current session if the refresh fails.
    }
  }

  const token = session.access_token
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function fetchWithAuth(url, options) {
  const res = await fetch(url, options)
  if (res.status !== 401) return res

  let token
  try {
    const { data } = await supabase.auth.refreshSession()
    token = data?.session?.access_token
  } catch {
    // Retry once with the existing headers if the refresh fails.
  }

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
}

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
