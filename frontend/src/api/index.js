import { supabase } from "../lib/supabaseClient";
import { authHeaders, fetchWithAuth } from "./_auth";
import {
  mockCustomerDocuments,
  mockReceivingHistory,
  mockReceivingHistoryDetails,
  mockSupplierOrderLinesBySo,
  mockSupplierTracking,
} from "../mocks/mockData";

const API_URL = import.meta.env.VITE_API_URL;
const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

function clone(data) {
  return JSON.parse(JSON.stringify(data));
}

function mockResponse(data) {
  return Promise.resolve(clone(data));
}

async function getJson(path) {
  const res = await fetchWithAuth(`${API_URL}${path}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) {
    throw new Error(`GET ${path} failed with status ${res.status}`);
  }
  return res.json();
}

export function getOrders() {
  return getJson("/orders");
}

export function getQuotesThisMonthCount() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  const fmt = (d) => d.toISOString().slice(0, 10); // YYYY-MM-DD
  const params = new URLSearchParams({
    date_from: fmt(first),
    date_to: fmt(last),
    page_size: 1,
    status: 'activo',
  });
  return getJson(`/api/quotes?${params}`).then(r => r.total ?? 0);
}

export function getCustomers() {
  return getJson("/customers/");
}

export function getCustomer(customerId) {
  return getJson(`/customers/${customerId}`);
}

export async function createCustomer(payload) {
  const res = await fetchWithAuth(`${API_URL}/customers/`, {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Create customer failed with status ${res.status}`);
  return data;
}

export async function updateCustomer(customerId, payload) {
  const res = await fetchWithAuth(`${API_URL}/customers/${customerId}`, {
    method: "PATCH",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Update customer failed with status ${res.status}`);
  return data;
}

export async function deleteCustomer(customerId) {
  const res = await fetchWithAuth(`${API_URL}/customers/${customerId}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Delete customer failed with status ${res.status}`);
  return data;
}

export function getCustomerDocuments(customerId) {
  if (USE_MOCK) {
    return mockResponse(
      mockCustomerDocuments.filter((doc) => doc.customer_id === customerId)
    );
  }
  return getJson(`/customers/${customerId}/documents`);
}

export async function uploadCustomerDocument(customerId, { documentType, file, label, expiry }) {
  const formData = new FormData();
  formData.append("document_type", documentType);
  formData.append("file", file);
  if (label) formData.append("label", label);
  if (expiry) formData.append("expiry_date", expiry);

  const res = await fetchWithAuth(`${API_URL}/customers/${customerId}/documents`, {
    method: "POST",
    headers: await authHeaders(),
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Upload customer document failed with status ${res.status}`);
  return data;
}

export async function deleteCustomerDocument(customerId, docId) {
  const res = await fetchWithAuth(`${API_URL}/customers/${customerId}/documents/${docId}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Delete customer document failed with status ${res.status}`);
  return data;
}

export function getSupplierTracking({ page = 1, limit = 25, sortBy = "newest", search = "" } = {}) {
  if (USE_MOCK) {
    const total = mockSupplierTracking.length;
    const start = (page - 1) * limit;
    const rows = mockSupplierTracking.slice(start, start + limit);
    return mockResponse({ rows, total });
  }
  const params = new URLSearchParams({ page, limit, sort_by: sortBy });
  if (search) params.set("search", search);
  return getJson(`/supplier-tracking/orders?${params}`);
}

export function getSupplierOrderLinesBySo(soNumber) {
  if (USE_MOCK) {
    return mockResponse(mockSupplierOrderLinesBySo[soNumber] || []);
  }
  return getJson(`/supplier-tracking/orders/${soNumber}/lines-by-so`);
}

export function getSupplierOrderByNumber(soNumber) {
  if (USE_MOCK) {
    const found = mockSupplierTracking.find((o) => o.so_number === soNumber);
    return mockResponse(found || null);
  }
  return getJson(`/supplier-tracking/orders/by-number/${soNumber}`);
}

export function getOrderDocuments(soNumber) {
  return getJson(`/supplier-tracking/orders/${soNumber}/documents`);
}

export async function uploadProofOfExport(soNumber, file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetchWithAuth(`${API_URL}/supplier-tracking/orders/${soNumber}/proof-of-export`, {
    method: "POST",
    headers: await authHeaders(),
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed with status ${res.status}`);
  return res.json();
}

export async function createSupplierOrder(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetchWithAuth(`${API_URL}/supplier-tracking/orders`, {
    method: "POST",
    headers: await authHeaders(),
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Upload failed with status ${res.status}`);
  return data;
}

export async function attachPo(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetchWithAuth(`${API_URL}/supplier-tracking/attach/po`, {
    method: "POST",
    headers: await authHeaders(),
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Upload failed with status ${res.status}`);
  return data;
}

export async function attachFerralOv(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetchWithAuth(`${API_URL}/supplier-tracking/attach/ferral-ov`, {
    method: "POST",
    headers: await authHeaders(),
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Upload failed with status ${res.status}`);
  return data;
}

export async function attachInv(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetchWithAuth(`${API_URL}/supplier-tracking/attach/inv`, {
    method: "POST",
    headers: await authHeaders(),
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Upload failed with status ${res.status}`);
  return data;
}

export async function attachVex(soNumber, invNumber, file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetchWithAuth(`${API_URL}/supplier-tracking/orders/${soNumber}/inv/${invNumber}/vex`, {
    method: "POST",
    headers: await authHeaders(),
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Upload failed with status ${res.status}`);
  return data;
}

export async function syncMadisa(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetchWithAuth(`${API_URL}/supplier-tracking/sync/madisa`, {
    method: "POST",
    headers: await authHeaders(),
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Sync failed with status ${res.status}`);
  return data;
}

export async function deleteOrderDocument(docId) {
  const res = await fetchWithAuth(`${API_URL}/supplier-tracking/documents/${docId}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`Delete failed with status ${res.status}`);
  return res.json();
}

export async function deleteVex(vexId) {
  const res = await fetchWithAuth(`${API_URL}/supplier-tracking/vex/${vexId}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Delete VEX failed with status ${res.status}`);
  return data;
}

export async function deleteInv(invId) {
  const res = await fetchWithAuth(`${API_URL}/supplier-tracking/inv/${invId}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Delete INV failed with status ${res.status}`);
  return data;
}

export function getReadyToDispatch() {
  return getJson("/ready-to-dispatch/orders");
}

export async function markInvReady(invId) {
  const res = await fetchWithAuth(`${API_URL}/ready-to-dispatch/inv/${invId}/ready`, {
    method: "PATCH",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`Action failed with status ${res.status}`);
  return res.json();
}

export async function markInvDispatched(invId) {
  const res = await fetchWithAuth(`${API_URL}/ready-to-dispatch/inv/${invId}/dispatch`, {
    method: "PATCH",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`Action failed with status ${res.status}`);
  return res.json();
}

export async function unmarkInv(invId) {
  const res = await fetchWithAuth(`${API_URL}/ready-to-dispatch/inv/${invId}/undispatch`, {
    method: "PATCH",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`Action failed with status ${res.status}`);
  return res.json();
}

export async function markSoReady(soNumber) {
  const res = await fetchWithAuth(`${API_URL}/ready-to-dispatch/so/${soNumber}/ready`, {
    method: "PATCH",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`Action failed with status ${res.status}`);
  return res.json();
}

export async function markSoDispatched(soNumber) {
  const res = await fetchWithAuth(`${API_URL}/ready-to-dispatch/so/${soNumber}/dispatch`, {
    method: "PATCH",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`Action failed with status ${res.status}`);
  return res.json();
}

export function getReceivingHistory({ page = 1, limit = 25, search = "", filterSO = "", filterClient = "", sortBy = "newest" } = {}) {
  if (USE_MOCK) {
    let rows = mockReceivingHistory.slice();
    const q = search.trim().toLowerCase();
    const searched = q
      ? rows.filter(o =>
          (o.so_number || "").toLowerCase().includes(q) ||
          (o.client || "").toLowerCase().includes(q) ||
          (o.po_number || "").toLowerCase().includes(q))
      : rows;
    const so_options = Array.from(new Set(searched.map(o => o.so_number))).filter(Boolean).sort();
    const client_options = Array.from(new Set(searched.map(o => o.client || ""))).filter(Boolean).sort();
    let filtered = searched
      .filter(o => (filterSO ? o.so_number === filterSO : true))
      .filter(o => (filterClient ? (o.client || "") === filterClient : true));
    filtered = filtered.slice().sort((a, b) => {
      if (sortBy === "newest") return new Date(b.order_date || 0) - new Date(a.order_date || 0);
      if (sortBy === "oldest") return new Date(a.order_date || 0) - new Date(b.order_date || 0);
      if (sortBy === "az") return (a.client || "").localeCompare(b.client || "");
      return 0;
    });
    const total = filtered.length;
    const start = (page - 1) * limit;
    const paginated = filtered.slice(start, start + limit);
    return mockResponse({ rows: paginated, total, so_options, client_options });
  }
  const params = new URLSearchParams({ page, limit, sort_by: sortBy });
  if (search) params.set("search", search);
  if (filterSO) params.set("filter_so", filterSO);
  if (filterClient) params.set("filter_client", filterClient);
  return getJson(`/receiving-history/orders?${params}`);
}

export function getReceivingHistoryDetail(soNumber) {
  if (USE_MOCK) {
    return mockResponse(mockReceivingHistoryDetails[soNumber] || null);
  }
  return getJson(`/receiving-history/orders/${soNumber}`);
}

export async function openSignedPdf(publicUrl) {
  if (!publicUrl) return
  // Extraer la ruta dentro del bucket: lo que sigue a "/documents/"
  const marker = "/documents/"
  const idx = publicUrl.indexOf(marker)
  const path = idx !== -1 ? publicUrl.slice(idx + marker.length) : publicUrl
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  const res = await fetch(`${API_URL}/documents/signed-url?path=${encodeURIComponent(path)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    console.error("No se pudo obtener la URL firmada")
    return
  }
  const json = await res.json()
  window.open(json.signed_url, "_blank", "noopener,noreferrer")
}
