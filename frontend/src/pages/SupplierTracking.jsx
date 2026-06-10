import { useState, useRef, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { getSupplierTracking } from "../api"
import Pagination from "../components/Pagination"
import UploadDocumentModal from "../components/UploadDocumentModal"
import AttachDocumentModal from "../components/AttachDocumentModal"
import { btn, input, pageTitle, table } from "../styles"

const FULFILLMENT_LABELS = {
  awaiting_parts: { label: "Awaiting Parts", color: "text-gray-400" },
  pending: { label: "Pending", color: "text-srg-orange" },
  in_progress: { label: "In Progress", color: "text-srg-blue" },
  complete: { label: "Complete", color: "text-srg-green" },
}

const LIMIT = 25

export default function SupplierTracking() {
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState(null)
  const [orders, setOrders] = useState([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState("")
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [attachModalOpen, setAttachModalOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [filterSO, setFilterSO] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [filterPO, setFilterPO] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parseInt(searchParams.get('page') || '1', 10)
  const syncInputRef = useRef(null)

  useEffect(() => { fetchOrders(page) }, [page])

  async function fetchOrders(p = page) {
    try {
      const data = await getSupplierTracking({ page: p, limit: LIMIT })
      setOrders(data?.rows || [])
      setTotal(data?.total || 0)
    } catch (err) {
      console.error("Failed to fetch orders", err)
      setOrders([])
      setTotal(0)
    }
  }

  const goToPage = (p) => setSearchParams({ page: String(p) })

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

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
          <button
            onClick={() => setUploadModalOpen(true)}
            className={`${btn.primary} w-full md:w-auto`}
          >
            Upload Document
          </button>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <input
              type="text"
              placeholder="Search by SO, client or PO..."
              value={search}
              onChange={e => {
                setSearch(e.target.value)
                setSearchParams({ page: '1' })
              }}
              className={`${input} w-full md:w-72`}
            />
            <div className="grid grid-cols-2 gap-2 md:flex md:gap-2">
            <select value={filterSO} onChange={e => { setFilterSO(e.target.value); setSearchParams({ page: '1' }) }} className={input}>
              <option value="">All SOs</option>
              {soOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterClient} onChange={e => { setFilterClient(e.target.value); setSearchParams({ page: '1' }) }} className={input}>
              <option value="">All Clients</option>
              {clientOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filterPO} onChange={e => { setFilterPO(e.target.value); setSearchParams({ page: '1' }) }} className={input}>
              <option value="">All POs</option>
              {poOptions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={sortBy} onChange={e => { setSortBy(e.target.value); setSearchParams({ page: '1' }) }} className={input}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="az">Client A–Z</option>
            </select>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
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
            className={`${btn.secondary} w-full md:w-auto`}
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

      <div className={table.wrapper}>
        <table className={table.base}>
          <thead>
            <tr className={table.head}>
              {[
                { key: "so_number", label: "Sales Order" },
                { key: "client", label: "Client" },
                { key: "po_number", label: "Purchase Order" },
                { key: "order_date", label: "Date" },
                { key: "total_lines", label: "Parts" },
                { key: "fulfillment", label: "Status" },
              ].map(col => (
                <th
                  key={col.key}
                  className={table.th}
                >
                  {col.label}
                </th>
              ))}
              <th className={table.th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(order => {
              const f = FULFILLMENT_LABELS[order.fulfillment] || FULFILLMENT_LABELS.pending
              return (
                <tr key={order.id} className={table.row}>
                  <td className={`${table.td} font-mono text-srg-black cursor-pointer`} onClick={() => navigate(`/supplier-tracking/${order.so_number}`)}>{order.so_number}</td>
                  <td className={`${table.td} text-srg-black cursor-pointer`} onClick={() => navigate(`/supplier-tracking/${order.so_number}`)}>{order.client || "—"}</td>
                  <td className={`${table.td} font-mono text-gray-600 cursor-pointer`} onClick={() => navigate(`/supplier-tracking/${order.so_number}`)}>{order.po_number || "—"}</td>
                  <td className={`${table.td} text-gray-600 cursor-pointer`} onClick={() => navigate(`/supplier-tracking/${order.so_number}`)}>{order.order_date || "—"}</td>
                  <td className={`${table.td} text-gray-600 cursor-pointer`} onClick={() => navigate(`/supplier-tracking/${order.so_number}`)}>{order.received_lines}/{order.total_lines}</td>
                  <td className={`${table.td} ${f.color} cursor-pointer`} onClick={() => navigate(`/supplier-tracking/${order.so_number}`)}>{f.label}</td>
                  <td className={table.td}>
                    <button
                      onClick={() => {
                        setSelectedOrder(order)
                        setAttachModalOpen(true)
                      }}
                      className={`${btn.secondary} ${btn.row}`}
                    >
                      Attach
                    </button>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr className={table.row}>
                <td colSpan={7} className={`${table.td} py-6 text-center text-gray-400`}>No orders found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} total={total} limit={LIMIT} onPageChange={goToPage} />

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
