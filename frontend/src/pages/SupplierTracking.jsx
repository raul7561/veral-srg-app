import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import UploadDocumentModal from "../components/UploadDocumentModal"
import AttachDocumentModal from "../components/AttachDocumentModal"

const FULFILLMENT_LABELS = {
  awaiting_parts: { label: "Awaiting Parts", color: "text-gray-400" },
  pending: { label: "Pending", color: "text-yellow-600" },
  in_progress: { label: "In Progress", color: "text-blue-600" },
  complete: { label: "Complete", color: "text-green-600" },
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
  const navigate = useNavigate()
  const syncInputRef = useRef(null)

  useEffect(() => { fetchOrders() }, [])

  async function fetchOrders() {
    try {
      const res = await fetch("http://localhost:8000/supplier-tracking/orders")
      const data = await res.json()
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

  const filtered = orders
    .filter(o =>
      o.so_number.toLowerCase().includes(search.toLowerCase()) ||
      (o.client || "").toLowerCase().includes(search.toLowerCase()) ||
      (o.po_number || "").toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      let valA = a[sortField] || ""
      let valB = b[sortField] || ""
      if (sortField === "total_lines") {
        valA = a.total_lines || 0
        valB = b.total_lines || 0
      }
      if (valA < valB) return sortDir === "asc" ? -1 : 1
      if (valA > valB) return sortDir === "asc" ? 1 : -1
      return 0
    })

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Supplier Tracking</h1>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setUploadModalOpen(true)}
            className="px-4 py-2 bg-black text-white text-sm rounded hover:bg-gray-800"
          >
            Upload Document
          </button>
          <input
            type="text"
            placeholder="Search by SO, client or PO..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border rounded px-3 py-2 text-sm w-72 bg-white"
          />
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
            className="px-4 py-2 border text-sm rounded hover:bg-gray-50 disabled:opacity-50"
          >
            {syncing ? "Syncing..." : "Sync Madisa Excel"}
          </button>
          {syncMessage && (
            <p className={`text-sm ${syncMessage.type === "success" ? "text-green-600" : "text-red-600"}`}>
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
                      className="px-3 py-1 text-xs border rounded hover:bg-gray-100 transition-colors"
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