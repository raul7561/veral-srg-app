import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { getSupplierTracking } from "../api"
import UploadDocumentModal from "../components/UploadDocumentModal"
import AttachDocumentModal from "../components/AttachDocumentModal"
import { btn, input, pageTitle } from "../styles"

const FULFILLMENT_LABELS = {
  awaiting_parts: { label: "Awaiting Parts", color: "text-gray-400" },
  pending: { label: "Pending", color: "text-srg-orange" },
  in_progress: { label: "In Progress", color: "text-blue-600" },
  complete: { label: "Complete", color: "text-srg-green" },
}

export default function SupplierTracking() {
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState(null)
  const [orders, setOrders] = useState([])
  const [search, setSearch] = useState("")
  const [sortField, setSortField] = useState("order_date")
  const [sortDir, setSortDir] = useState("desc")
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [attachModalOpen, setAttachModalOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [filterSO, setFilterSO] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [filterPO, setFilterPO] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const navigate = useNavigate()
  const syncInputRef = useRef(null)

  useEffect(() => { fetchOrders() }, [])

  async function fetchOrders() {
    try {
      const data = await getSupplierTracking()
      setOrders(data)
    } catch (err) {
      console.error("Failed to fetch orders", err)
    }
  }

  async function handleMadasaSync(e) {
    const file = e.target.files[0]
    if (!file) return
    setSyncing(true)
    setSyncMessage(null)
    const formData = new FormData()
    formData.append("file", file)
    try {
      const res = await fetch("http://localhost:8000/supplier-tracking/sync/madisa", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (res.ok) {
        setSyncMessage({ type: "success", text: `Updated: ${data.updated} — Skipped: ${data.skipped}` })
        fetchOrders()
      } else {
        setSyncMessage({ type: "error", text: data.detail })
      }
    } catch {
      setSyncMessage({ type: "error", text: "Connection error" })
    } finally {
      setSyncing(false)
      if (syncInputRef.current) syncInputRef.current.value = ""
    }
  }

  const soOptions = Array.from(new Set(orders.map(o => o.so_number))).filter(Boolean)
  const clientOptions = Array.from(new Set(orders.map(o => o.client || ""))).filter(Boolean)
  const poOptions = Array.from(new Set(orders.map(o => o.po_number || ""))).filter(Boolean)

  const filtered = orders
    .filter(o => {
      const q = search.toLowerCase()
      const matchesText = o.so_number.toLowerCase().includes(q) ||
        (o.client || "").toLowerCase().includes(q) ||
        (o.po_number || "").toLowerCase().includes(q)
      const matchesSO = filterSO ? o.so_number === filterSO : true
      const matchesClient = filterClient ? (o.client || "") === filterClient : true
      const matchesPO = filterPO ? (o.po_number || "") === filterPO : true
      return matchesText && matchesSO && matchesClient && matchesPO
    })
    .slice()
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.order_date || 0) - new Date(a.order_date || 0)
      if (sortBy === 'oldest') return new Date(a.order_date || 0) - new Date(b.order_date || 0)
      if (sortBy === 'az') return (a.client || '').localeCompare(b.client || '')
      return 0
    })

  return (
    <div className="p-8">
      <h1 className={pageTitle}>Supplier Tracking</h1>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setUploadModalOpen(true)}
            className={btn.primary}
          >
            Upload Document
          </button>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search by SO, client or PO..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={`${input} w-72`}
            />
            <select value={filterSO} onChange={e => setFilterSO(e.target.value)} className={input}>
              <option value="">All SOs</option>
              {soOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterClient} onChange={e => setFilterClient(e.target.value)} className={input}>
              <option value="">All Clients</option>
              {clientOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filterPO} onChange={e => setFilterPO(e.target.value)} className={input}>
              <option value="">All POs</option>
              {poOptions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className={input}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="az">Client A–Z</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={syncInputRef}
            type="file"
            accept=".xlsx"
            onChange={handleMadasaSync}
            disabled={syncing}
            className="hidden"
          />
          <button
            onClick={() => syncInputRef.current?.click()}
            disabled={syncing}
            className={btn.secondary}
          >
            {syncing ? "Syncing..." : "Sync Madisa Excel"}
          </button>
          {syncMessage && (
            <p className={`text-sm ${syncMessage.type === "success" ? "text-srg-green" : "text-srg-red"}`}>
              {syncMessage.text}
            </p>
          )}
        </div>
      </div>

      <div className="border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b bg-gray-50">
              {[
                { key: "so_number", label: "SO" },
                { key: "client", label: "Client" },
                { key: "po_number", label: "PO" },
                { key: "order_date", label: "Date" },
                { key: "total_lines", label: "Parts" },
                { key: "fulfillment", label: "Status" },
              ].map(col => (
                <th
                  key={col.key}
                  className="px-4 py-2 cursor-pointer select-none hover:text-gray-600"
                  onClick={() => {
                    if (sortField === col.key) {
                      setSortDir(prev => prev === "asc" ? "desc" : "asc")
                    } else {
                      setSortField(col.key)
                      setSortDir("asc")
                    }
                  }}
                >
                  {col.label} {sortField === col.key ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </th>
              ))}
              <th className="px-4 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(order => {
              const f = FULFILLMENT_LABELS[order.fulfillment] || FULFILLMENT_LABELS.pending
              return (
                <tr key={order.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold cursor-pointer" onClick={() => navigate(`/supplier-tracking/${order.so_number}`)}>{order.so_number}</td>
                  <td className="px-4 py-3 text-gray-600 cursor-pointer" onClick={() => navigate(`/supplier-tracking/${order.so_number}`)}>{order.client || "—"}</td>
                  <td className="px-4 py-3 font-mono text-gray-500 cursor-pointer" onClick={() => navigate(`/supplier-tracking/${order.so_number}`)}>{order.po_number || "—"}</td>
                  <td className="px-4 py-3 text-gray-400 cursor-pointer" onClick={() => navigate(`/supplier-tracking/${order.so_number}`)}>{order.order_date || "—"}</td>
                  <td className="px-4 py-3 text-gray-500 cursor-pointer" onClick={() => navigate(`/supplier-tracking/${order.so_number}`)}>{order.received_lines}/{order.total_lines}</td>
                  <td className={`px-4 py-3 font-medium ${f.color} cursor-pointer`} onClick={() => navigate(`/supplier-tracking/${order.so_number}`)}>{f.label}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => {
                        setSelectedOrder(order)
                        setAttachModalOpen(true)
                      }}
                      className={`${btn.secondary} ${btn.sm}`}
                    >
                      Attach
                    </button>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-400">No orders found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Upload Document Modal (SO, PO, Ferral OV) */}
      {uploadModalOpen && (
        <UploadDocumentModal
          onClose={() => setUploadModalOpen(false)}
          onSuccess={fetchOrders}
        />
      )}

      {/* Attach Modal per row (INV, VEX) */}
      {attachModalOpen && selectedOrder && (
        <AttachDocumentModal
          soNumber={selectedOrder.so_number}
          client={selectedOrder.client || "—"}
          invs={selectedOrder.invs || []}
          onClose={() => {
            setAttachModalOpen(false)
            setSelectedOrder(null)
          }}
          onSuccess={fetchOrders}
        />
      )}
    </div>
  )
}
