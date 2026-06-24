import { supabase } from "../lib/supabaseClient"

export async function authHeaders(extra = {}) {
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

export async function fetchWithAuth(url, options) {
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
