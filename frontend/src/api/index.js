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

export function getSupplierTracking() {
  if (USE_MOCK) return mockResponse(mockSupplierTracking);
  return getJson("/supplier-tracking/orders");
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

export function getReceivingHistory() {
  if (USE_MOCK) return mockResponse(mockReceivingHistory);
  return getJson("/receiving-history/orders");
}

export function getReceivingHistoryDetail(soNumber) {
  if (USE_MOCK) {
    return mockResponse(mockReceivingHistoryDetails[soNumber] || null);
  }
  return getJson(`/receiving-history/orders/${soNumber}`);
}
