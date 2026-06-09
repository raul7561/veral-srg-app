import {
  mockCustomerDocuments,
  mockCustomers,
  mockOrders,
  mockReadyToDispatch,
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
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) {
    throw new Error(`GET ${path} failed with status ${res.status}`);
  }
  return res.json();
}

export function getOrders() {
  if (USE_MOCK) return mockResponse(mockOrders);
  return getJson("/orders");
}

export function getCustomers() {
  if (USE_MOCK) return mockResponse(mockCustomers);
  return getJson("/customers/");
}

export function getCustomerDocuments(customerId) {
  if (USE_MOCK) {
    return mockResponse(
      mockCustomerDocuments.filter((doc) => doc.customer_id === customerId)
    );
  }
  return getJson(`/customers/${customerId}/documents`);
}

export function getSupplierTracking({ page = 1, limit = 25 } = {}) {
  if (USE_MOCK) {
    const total = mockSupplierTracking.length;
    const start = (page - 1) * limit;
    const rows = mockSupplierTracking.slice(start, start + limit);
    return mockResponse({ rows, total });
  }
  const params = new URLSearchParams({ page, limit });
  return getJson(`/supplier-tracking/orders?${params}`);
}

export function getSupplierOrderLinesBySo(soNumber) {
  if (USE_MOCK) {
    return mockResponse(mockSupplierOrderLinesBySo[soNumber] || []);
  }
  return getJson(`/supplier-tracking/orders/${soNumber}/lines-by-so`);
}

export function getReadyToDispatch() {
  if (USE_MOCK) return mockResponse(mockReadyToDispatch);
  return getJson("/ready-to-dispatch/orders");
}

export function getReceivingHistory({ page = 1, limit = 25 } = {}) {
  if (USE_MOCK) {
    const total = mockReceivingHistory.length;
    const start = (page - 1) * limit;
    const rows = mockReceivingHistory.slice(start, start + limit);
    return mockResponse({ rows, total });
  }
  const params = new URLSearchParams({ page, limit });
  return getJson(`/receiving-history/orders?${params}`);
}

export function getReceivingHistoryDetail(soNumber) {
  if (USE_MOCK) {
    return mockResponse(mockReceivingHistoryDetails[soNumber] || null);
  }
  return getJson(`/receiving-history/orders/${soNumber}`);
}
