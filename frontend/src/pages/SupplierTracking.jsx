import { useState, useRef, useEffect, useCallback } from "react"
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from "react-router-dom"
import { getSupplierTracking } from "../api"
import Pagination from "../components/Pagination"
import UploadDocumentModal from "../components/UploadDocumentModal"
import AttachDocumentModal from "../components/AttachDocumentModal"
import { btn, input, pageTitle, table } from "../styles"

const FULFILLMENT_LABELS = {
  awaiting_parts: { color: "text-gray-400" },
  pending: { color: "text-srg-orange" },
  in_progress: { color: "text-srg-blue" },
  complete: { color: "text-srg-green" },
}

const LIMIT = 25

export default function SupplierTracking() {
  const { t } = useTranslation()
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState(null)
  const [orders, setOrders] = useState([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState("")
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [attachModalOpen, setAttachModalOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [sortBy, setSortBy] = useState('newest')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parseInt(searchParams.get('page') || '1', 10)
  const syncInputRef = useRef(null)

  const fetchOrders = useCallback(async (p = page) => {
    try {
      const data = await getSupplierTracking({ page: p, limit: LIMIT, sortBy })
      setOrders(data?.rows || [])
      setTotal(data?.total || 0)
    } catch (err) {
      console.error("Failed to fetch orders", err)
      setOrders([])
      setTotal(0)
    }
  }, [page, sortBy])

  useEffect(() => { queueMicrotask(() => fetchOrders(page)) }, [page, fetchOrders])

  const goToPage = (p) => setSearchParams({ page: String(p) })

  async function handleMadasaSync(e) {
    const file = e.target.files[0]
    if (!file) return
    setSyncing(true)
    setSyncMessage(null)
    const formData = new FormData()
    formData.append("file", file)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/supplier-tracking/sync/madisa`, {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (res.ok) {
        setSyncMessage({ type: "success", text: t('supplierTracking.syncResult', { updated: data.updated, skipped: data.skipped }) })
        fetchOrders()
      } else {
        setSyncMessage({ type: "error", text: data.detail })
      }
    } catch {
      setSyncMessage({ type: "error", text: t('supplierTracking.connectionError') })
    } finally {
      setSyncing(false)
      if (syncInputRef.current) syncInputRef.current.value = ""
    }
  }

  const filtered = orders.filter(o => {
    const q = search.toLowerCase()
    return o.so_number.toLowerCase().includes(q) ||
      (o.client || "").toLowerCase().includes(q) ||
      (o.po_number || "").toLowerCase().includes(q)
  })

  return (
    <div className="p-8">
      <h1 className={pageTitle}>{t('supplierTracking.title')}</h1>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
          <button
            onClick={() => setUploadModalOpen(true)}
            className={`${btn.primary} w-full md:w-auto`}
          >
            {t('supplierTracking.uploadDocument')}
          </button>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <input
              type="text"
              placeholder={t('supplierTracking.searchPlaceholder')}
              value={search}
              onChange={e => {
                setSearch(e.target.value)
                setSearchParams({ page: '1' })
              }}
              className={`${input} w-full md:w-72`}
            />
            <div className="grid grid-cols-2 gap-2 md:flex md:gap-2">
              <select value={sortBy} onChange={e => { setSortBy(e.target.value); setSearchParams({ page: '1' }) }} className={input}>
                <option value="newest">{t('supplierTracking.sortDateNewest')}</option>
                <option value="oldest">{t('supplierTracking.sortDateOldest')}</option>
                <option value="so_asc">{t('supplierTracking.sortSoAsc')}</option>
                <option value="so_desc">{t('supplierTracking.sortSoDesc')}</option>
                <option value="client_az">{t('supplierTracking.sortClientAz')}</option>
                <option value="client_za">{t('supplierTracking.sortClientZa')}</option>
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
            {syncing ? t('supplierTracking.syncing') : t('supplierTracking.syncMadisa')}
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
                { key: "so_number", label: t('supplierTracking.salesOrder') },
                { key: "client", label: t('supplierTracking.client') },
                { key: "po_number", label: t('supplierTracking.purchaseOrder') },
                { key: "order_date", label: t('supplierTracking.date') },
                { key: "total_lines", label: t('supplierTracking.parts') },
                { key: "fulfillment", label: t('supplierTracking.status') },
              ].map(col => (
                <th
                  key={col.key}
                  className={table.th}
                >
                  {col.label}
                </th>
              ))}
              <th className={table.th}>{t('supplierTracking.action')}</th>
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
                  <td className={`${table.td} cursor-pointer`} onClick={() => navigate(`/supplier-tracking/${order.so_number}`)}>
                    <div className="flex flex-col gap-1">
                      <span className={f.color}>
                        {order.fulfillment === 'awaiting_parts'
                          ? t('supplierTracking.awaitingParts')
                          : order.fulfillment === 'in_progress'
                            ? t('supplierTracking.inProgress')
                            : order.fulfillment === 'complete'
                              ? t('supplierTracking.complete')
                              : t('supplierTracking.pending')}
                      </span>
                      {order.customer_type === "international" && (
                        order.has_proof ? (
                          <span className="text-xs text-srg-green">{t('supplierTracking.proofUploaded')}</span>
                        ) : (
                          <span className="inline-flex w-fit rounded bg-srg-amber px-2 py-0.5 text-xs font-bold uppercase text-srg-black">{t('supplierTracking.proofPending')}</span>
                        )
                      )}
                    </div>
                  </td>
                  <td className={table.td}>
                    <button
                      onClick={() => {
                        setSelectedOrder(order)
                        setAttachModalOpen(true)
                      }}
                      className={`${btn.secondary} ${btn.row}`}
                    >
                      {t('supplierTracking.attach')}
                    </button>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr className={table.row}>
                <td colSpan={7} className={`${table.td} py-6 text-center text-gray-400`}>{t('supplierTracking.noOrders')}</td>
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
