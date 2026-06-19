import { useState, useRef, useEffect, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { getSupplierOrderLinesBySo, getSupplierOrderByNumber, openSignedPdf } from "../api"
import { table } from "../styles"

const API = `${import.meta.env.VITE_API_URL}/supplier-tracking`

export default function SupplierOrderDetail() {
  const { soNumber } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [lines, setLines] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchOrder = useCallback(async () => {
    try {
      const [orderRes, linesRes] = await Promise.all([
        getSupplierOrderByNumber(soNumber),
        getSupplierOrderLinesBySo(soNumber),
      ])
      setOrder(orderRes || null)
      setLines(linesRes)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [soNumber])

  useEffect(() => { queueMicrotask(() => fetchOrder()) }, [soNumber, fetchOrder])

  if (loading) return <div className="p-8">Loading...</div>
  if (!order) return <div className="p-8">Order {soNumber} not found.</div>

  return (
    <div className="p-8">
      <button
        onClick={() => navigate("/supplier-tracking")}
        className="text-sm text-gray-500 hover:text-srg-black mb-6 flex items-center gap-1"
      >
        ← Back to Supplier Tracking
      </button>

      <div className="flex items-baseline gap-4 mb-6">
        <h1 className="text-2xl font-bold">{order.so_number}</h1>
        <span className="text-gray-600">{order.client}</span>
        <span className="text-gray-400 text-sm">{order.order_date || "—"}</span>
        {order.so_pdf_url && (
          <button type="button" onClick={() => openSignedPdf(order.so_pdf_url)} className="text-xs text-srg-black hover:underline cursor-pointer">↓ SO PDF</button>
        )}
      </div>

      {/* Document chain */}
      <div className="border border-srg-border rounded p-4 mb-6">
        <div className="flex gap-8 text-sm flex-wrap">
          <DocField
            label="PO"
            value={order.po_number}
            uploadLabel="Attach PO PDF"
            endpoint={`${API}/attach/po`}
            method="POST"
            onSuccess={fetchOrder}
            pdfUrl={order.po_pdf_url}
          />

          <DocField
            label="Ferral OV"
            value={order.ferral_order_number ? `${order.ferral_order_number} — ${order.madisa_ov || ""}` : null}
            uploadLabel="Attach Ferral OV PDF"
            endpoint={`${API}/attach/ferral-ov`}
            method="POST"
            onSuccess={fetchOrder}
            pdfUrl={order.ferral_ov_pdf_url}
          />

          {order.po_number && (
            <div className="flex flex-col gap-2">
              <span className="text-xs text-gray-400 uppercase tracking-wide">Invoices</span>
              <div className="flex flex-col gap-3">
                {order.invs.map(inv => (
                  <div key={inv.id} className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-medium">{inv.inv_number}</span>
                      <span className="text-gray-400 text-xs">{inv.inv_date || "—"}</span>
                      {inv.inv_pdf_url && (
                        <button type="button" onClick={() => openSignedPdf(inv.inv_pdf_url)} className="text-xs text-srg-black hover:underline cursor-pointer">↓ PDF</button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <span className="text-xs text-gray-400">VEX:</span>
                      {inv.vex.map(v => (
                        <span key={v.id} className="text-xs font-mono text-gray-600">
                          {v.vex_number}
                          {v.vex_pdf_url && (
                            <button type="button" onClick={() => openSignedPdf(v.vex_pdf_url)} className="text-xs text-srg-black hover:underline ml-1 cursor-pointer">↓</button>
                          )}
                        </span>
                      ))}
                      <VexUploader
                        soNumber={soNumber}
                        invNumber={inv.inv_number}
                        onSuccess={fetchOrder}
                      />
                    </div>
                  </div>
                ))}
                <SimpleUploader
                  label="+ Attach INV PDF"
                  endpoint={`${API}/attach/inv`}
                  onSuccess={fetchOrder}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Parts table */}
      <div className="border border-srg-border rounded p-4">
        <p className="text-sm text-gray-500 mb-3">
          Parts — {order.received_lines}/{order.total_lines} received
        </p>
        {lines.length === 0 ? (
          <p className="text-sm text-gray-400">No parts loaded.</p>
        ) : (
          <table className={table.base}>
            <thead>
              <tr className={table.head}>
                <th className="py-1 pr-4">Part Number</th>
                <th className="py-1 pr-4">Description</th>
                <th className="py-1 pr-4">Type</th>
                <th className="py-1 pr-4">Qty</th>
                <th className="py-1 pr-4">Warehouse</th>
                <th className="py-1 pr-4">ETA</th>
                <th className="py-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {lines.map(line => (
                <tr key={line.id} className="border-b border-srg-border last:border-0">
                  <td className="py-1 pr-4 font-mono">{line.part_number}</td>
                  <td className="py-1 pr-4">{line.description}</td>
                  <td className="py-1 pr-4">
                    {line.po_category === "pkj" ? (
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-bold uppercase bg-srg-amber text-srg-black">PKJ</span>
                    ) : line.po_category === "cross_dock" ? (
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-bold uppercase border border-srg-border text-gray-500">Cross-dock</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-1 pr-4">{line.quantity}</td>
                  <td className="py-1 pr-4">{line.warehouse || "—"}</td>
                  <td className="py-1 pr-4">{line.eta_to_ferral || "—"}</td>
                  <td className="py-1 font-medium">
                    {line.status === "received" ? (
                      <span className="text-srg-green">Received</span>
                    ) : line.status === "pending" ? (
                      <span className="text-srg-orange">Pending</span>
                    ) : (
                      <span className="text-gray-500">{line.status}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function DocField({ label, value, uploadLabel, endpoint, method, onSuccess, pdfUrl }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    setError(null)
    const formData = new FormData()
    formData.append("file", file)
    try {
      const res = await fetch(endpoint, { method, body: formData })
      if (res.ok) {
        onSuccess()
      } else {
        const data = await res.json()
        setError(data.detail)
      }
    } catch {
      setError("Connection error")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      {value ? (
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm">{value}</span>
          {pdfUrl && (
            <button type="button" onClick={() => openSignedPdf(pdfUrl)} className="text-xs text-srg-black hover:underline">↓ PDF</button>
          )}
        </div>
      ) : (
        <>
          <input ref={inputRef} type="file" accept=".pdf" onChange={handleUpload} className="hidden" />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="px-3 py-1 text-xs border border-srg-border rounded hover:bg-srg-cream disabled:opacity-50 text-left"
          >
            {uploading ? "Uploading..." : uploadLabel}
          </button>
          {error && <span className="text-xs text-srg-red">{error}</span>}
        </>
      )}
    </div>
  )
}

function SimpleUploader({ label, endpoint, onSuccess }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    setError(null)
    const formData = new FormData()
    formData.append("file", file)
    try {
      const res = await fetch(endpoint, { method: "POST", body: formData })
      if (res.ok) {
        onSuccess()
      } else {
        const data = await res.json()
        setError(data.detail)
      }
    } catch {
      setError("Connection error")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input ref={inputRef} type="file" accept=".pdf" onChange={handleUpload} className="hidden" />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="px-3 py-1 text-xs border border-srg-border rounded hover:bg-srg-cream disabled:opacity-50"
      >
        {uploading ? "Uploading..." : label}
      </button>
      {error && <span className="text-xs text-srg-red">{error}</span>}
    </div>
  )
}

function VexUploader({ soNumber, invNumber, onSuccess }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    setError(null)
    const formData = new FormData()
    formData.append("file", file)
    try {
      const res = await fetch(
        `${API}/orders/${soNumber}/inv/${invNumber}/vex`,
        { method: "POST", body: formData }
      )
      const data = await res.json()
      if (res.ok) {
        onSuccess()
      } else {
        setError(data.detail)
      }
    } catch {
      setError("Connection error")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input ref={inputRef} type="file" accept=".pdf" onChange={handleUpload} className="hidden" />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="px-2 py-0.5 text-xs border border-srg-border rounded hover:bg-srg-cream disabled:opacity-50"
      >
        {uploading ? "..." : "+ VEX"}
      </button>
      {error && <span className="text-xs text-srg-red">{error}</span>}
    </div>
  )
}
