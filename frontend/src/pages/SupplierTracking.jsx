import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import AttachDocumentModal from "../components/AttachDocumentModal"

const FULFILLMENT_LABELS = {
  awaiting_parts: { label: "Awaiting Parts", color: "text-gray-400" },
  pending: { label: "Pending", color: "text-yellow-600" },
  in_progress: { label: "In Progress", color: "text-blue-600" },
  complete: { label: "Complete", color: "text-green-600" },
}

export default function SupplierTracking() {
  const [uploading, setUploading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState(null)
  const [message, setMessage] = useState(null)
  const [orders, setOrders] = useState([])
  const [search, setSearch] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const fileInputRef = useRef(null)
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

  async function handleSOUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    setMessage(null)
    const formData = new FormData()
    formData.append("file", file)
    try {
      const res = await fetch("http://localhost:8000/supplier-tracking/orders", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (res.ok) {
        setMessage({ type: "success", text: `${data.so_number} created — ${data.parts_count} parts loaded` })
        fetchOrders()
      } else {
        setMessage({ type: "error", text: data.detail })
      }
    } catch (err) {
      setMessage({ type: "error", text: "Connection error" })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
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

  const filtered = orders.filter(o =>
    o.so_number.toLowerCase().includes(search.toLowerCase()) ||
    (o.client || "").toLowerCase().includes(search.toLowerCase()) ||
    (o.po_number || "").toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Supplier Tracking</h1>

      <div className="flex items-center justify-between mb-6">
  <div className="flex items-center gap-4">
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleSOUpload}
        disabled={uploading}
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="px-4 py-2 bg-black text-white text-sm rounded hover:bg-gray-800 disabled:opacity-50"
      >
        {uploading ? "Uploading..." : "New Order — Upload SO PDF"}
      </button>
    </div>
    <input
      type="text"
      placeholder="Search by SO, client or PO..."
      value={search}
      onChange={e => setSearch(e.target.value)}
      className="border rounded px-3 py-2 text-sm w-72 bg-white"
    />
    {message && (
      <p className={`text-sm ${message.type === "success" ? "text-green-600" : "text-red-600"}`}>
        {message.text}
      </p>
    )}
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
              <th className="px-4 py-2">SO</th>
              <th className="px-4 py-2">Client</th>
              <th className="px-4 py-2">PO</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Parts</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(order => {
              const f = FULFILLMENT_LABELS[order.fulfillment] || FULFILLMENT_LABELS.pending
              return (
                <tr
                  key={order.id}
                  className="border-b last:border-0 hover:bg-gray-50"
                >
                  <td
                    className="px-4 py-3 font-semibold cursor-pointer"
                    onClick={() => navigate(`/supplier-tracking/${order.so_number}`)}
                  >
                    {order.so_number}
                  </td>
                  <td
                    className="px-4 py-3 text-gray-600 cursor-pointer"
                    onClick={() => navigate(`/supplier-tracking/${order.so_number}`)}
                  >
                    {order.client || "—"}
                  </td>
                  <td
                    className="px-4 py-3 font-mono text-gray-500 cursor-pointer"
                    onClick={() => navigate(`/supplier-tracking/${order.so_number}`)}
                  >
                    {order.po_number || "—"}
                  </td>
                  <td
                    className="px-4 py-3 text-gray-400 cursor-pointer"
                    onClick={() => navigate(`/supplier-tracking/${order.so_number}`)}
                  >
                    {order.order_date || "—"}
                  </td>
                  <td
                    className="px-4 py-3 text-gray-500 cursor-pointer"
                    onClick={() => navigate(`/supplier-tracking/${order.so_number}`)}
                  >
                    {order.received_lines}/{order.total_lines}
                  </td>
                  <td
                    className={`px-4 py-3 font-medium ${f.color} cursor-pointer`}
                    onClick={() => navigate(`/supplier-tracking/${order.so_number}`)}
                  >
                    {f.label}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => {
                        setSelectedOrder(order)
                        setModalOpen(true)
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

      {/* Modal */}
      {modalOpen && selectedOrder && (
        <AttachDocumentModal
          soNumber={selectedOrder.so_number}
          client={selectedOrder.client || "—"}
          invs={selectedOrder.invs || []}
          poNumber={selectedOrder.po_number}
          ferralOrderNumber={selectedOrder.ferral_order_number}
          onClose={() => {
            setModalOpen(false)
            setSelectedOrder(null)
          }}
          onSuccess={fetchOrders}
        />
      )}
    </div>
  )
}