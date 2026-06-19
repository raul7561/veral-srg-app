import { useState, useRef, useEffect, useCallback } from "react"
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from "react-router-dom"
import {
  deleteOrderDocument,
  getOrderDocuments,
  getSupplierOrderLinesBySo,
  getSupplierOrderByNumber,
  openSignedPdf,
  uploadProofOfExport,
} from "../api"
import { table } from "../styles"

const API = `${import.meta.env.VITE_API_URL}/supplier-tracking`

export default function SupplierOrderDetail() {
  const { t } = useTranslation()
  const { soNumber } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [lines, setLines] = useState([])
  const [documents, setDocuments] = useState([])
  const [uploadingProof, setUploadingProof] = useState(false)
  const [loading, setLoading] = useState(true)
  const proofInputRef = useRef(null)

  const fetchOrder = useCallback(async () => {
    try {
      const [orderRes, linesRes, docsRes] = await Promise.all([
        getSupplierOrderByNumber(soNumber),
        getSupplierOrderLinesBySo(soNumber),
        getOrderDocuments(soNumber),
      ])
      setOrder(orderRes || null)
      setLines(linesRes)
      setDocuments(docsRes || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [soNumber])

  useEffect(() => { queueMicrotask(() => fetchOrder()) }, [soNumber, fetchOrder])

  async function handleProofUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploadingProof(true)
    try {
      await uploadProofOfExport(soNumber, file)
      await fetchOrder()
    } catch (err) {
      console.error(err)
    } finally {
      setUploadingProof(false)
      if (proofInputRef.current) proofInputRef.current.value = ""
    }
  }

  async function handleProofDelete(docId) {
    try {
      await deleteOrderDocument(docId)
      await fetchOrder()
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) return <div className="p-8">{t('orderDetail.loading')}</div>
  if (!order) return <div className="p-8">{t('orderDetail.notFound', { so: soNumber })}</div>

  const proofDoc = documents.find(d => d.document_type === "proof_of_export")
  const isInternational = order.customer_type === "international"

  return (
    <div className="p-8">
      <button
        onClick={() => navigate("/supplier-tracking")}
        className="text-sm text-gray-500 hover:text-srg-black mb-6 flex items-center gap-1"
      >
        {t('orderDetail.back')}
      </button>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-baseline gap-4">
          <h1 className="text-2xl font-bold">{order.so_number}</h1>
          <span className="text-gray-600">{order.client}</span>
          <span className="text-gray-400 text-sm">{order.order_date || "—"}</span>
          {order.so_pdf_url && (
            <button type="button" onClick={() => openSignedPdf(order.so_pdf_url)} className="text-xs text-srg-black hover:underline cursor-pointer">↓ SO PDF</button>
          )}
        </div>
        {isInternational && (
          <div className="flex flex-col items-end gap-2">
            <span className="text-xs text-gray-400 uppercase tracking-wide">{t('orderDetail.proofOfExport')}</span>
            {proofDoc ? (
              <div className="flex items-center gap-3 text-sm">
                <span className="font-medium">{proofDoc.file_name}</span>
                <button type="button" onClick={() => openSignedPdf(proofDoc.file_url)} className="text-xs text-srg-black hover:underline cursor-pointer">↓ {t('orderDetail.download')}</button>
                <button type="button" onClick={() => handleProofDelete(proofDoc.id)} className="text-xs text-srg-red hover:underline cursor-pointer">{t('orderDetail.delete')}</button>
              </div>
            ) : (
              <>
                <input ref={proofInputRef} type="file" accept=".pdf" onChange={handleProofUpload} className="hidden" />
                <button
                  onClick={() => proofInputRef.current?.click()}
                  disabled={uploadingProof}
                  className="px-3 py-1 text-xs border border-srg-border rounded hover:bg-srg-cream disabled:opacity-50"
                >
                  {uploadingProof ? t('orderDetail.proofUploading') : t('orderDetail.uploadProof')}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Document chain */}
      <div className="border border-srg-border rounded p-4 mb-6">
        <div className="flex gap-8 text-sm flex-wrap">
          <DocField
            label="PO"
            value={order.po_number}
            uploadLabel={t('orderDetail.attachPo')}
            endpoint={`${API}/attach/po`}
            method="POST"
            onSuccess={fetchOrder}
            pdfUrl={order.po_pdf_url}
          />

          <DocField
            label="Ferral OV"
            value={order.ferral_order_number ? `${order.ferral_order_number} — ${order.madisa_ov || ""}` : null}
            uploadLabel={t('orderDetail.attachFerral')}
            endpoint={`${API}/attach/ferral-ov`}
            method="POST"
            onSuccess={fetchOrder}
            pdfUrl={order.ferral_ov_pdf_url}
          />

          {order.po_number && (
            <div className="flex flex-col gap-2">
              <span className="text-xs text-gray-400 uppercase tracking-wide">{t('orderDetail.invoices')}</span>
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
                  label={t('orderDetail.attachInv')}
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
          {t('orderDetail.partsReceived', { received: order.received_lines, total: order.total_lines })}
        </p>
        {lines.length === 0 ? (
          <p className="text-sm text-gray-400">{t('orderDetail.noParts')}</p>
        ) : (
          <table className={table.base}>
            <thead>
              <tr className={table.head}>
                <th className="py-1 pr-4">{t('orderDetail.partNumber')}</th>
                <th className="py-1 pr-4">{t('orderDetail.description')}</th>
                <th className="py-1 pr-4">{t('orderDetail.type')}</th>
                <th className="py-1 pr-4">{t('orderDetail.qty')}</th>
                <th className="py-1 pr-4">{t('orderDetail.warehouse')}</th>
                <th className="py-1 pr-4">{t('orderDetail.eta')}</th>
                <th className="py-1">{t('orderDetail.status')}</th>
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
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-bold uppercase border border-srg-border text-gray-500">{t('orderDetail.crossDock')}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-1 pr-4">{line.quantity}</td>
                  <td className="py-1 pr-4">{line.warehouse || "—"}</td>
                  <td className="py-1 pr-4">{line.eta_to_ferral || "—"}</td>
                  <td className="py-1 font-medium">
                    {line.status === "received" ? (
                      <span className="text-srg-green">{t('orderDetail.received')}</span>
                    ) : line.status === "pending" ? (
                      <span className="text-srg-orange">{t('orderDetail.pending')}</span>
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
  const { t } = useTranslation()
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
      setError(t('orderDetail.connectionError'))
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
            {uploading ? t('orderDetail.uploading') : uploadLabel}
          </button>
          {error && <span className="text-xs text-srg-red">{error}</span>}
        </>
      )}
    </div>
  )
}

function SimpleUploader({ label, endpoint, onSuccess }) {
  const { t } = useTranslation()
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
      setError(t('orderDetail.connectionError'))
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
        {uploading ? t('orderDetail.uploading') : label}
      </button>
      {error && <span className="text-xs text-srg-red">{error}</span>}
    </div>
  )
}

function VexUploader({ soNumber, invNumber, onSuccess }) {
  const { t } = useTranslation()
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
      setError(t('orderDetail.connectionError'))
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
