import { Fragment, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getOrderDocuments,
  getReadyToDispatch,
  markInvDispatched,
  markInvReady,
  markSoDispatched,
  markSoReady,
  openSignedPdf,
  unmarkInv,
  uploadShippingLabel,
} from '../api'
import { btn, input, pageTitle, table } from "../styles"

export default function ReadyToDispatch() {
  const { t } = useTranslation()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [filterSO, setFilterSO] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [error, setError] = useState(null)
  const [uploadingLabel, setUploadingLabel] = useState(null)
  const [loadingLabels, setLoadingLabels] = useState(null)
  const [labelsOpen, setLabelsOpen] = useState({})
  const [shippingLabelsByOrder, setShippingLabelsByOrder] = useState({})

  const fetchOrders = () => {
    return getReadyToDispatch()
      .then(data => {
        setOrders(data)
        setLoading(false)
      })
  }

  useEffect(() => { fetchOrders() }, [])

  const toggleExpand = (so_number) => {
    setExpanded(prev => ({ ...prev, [so_number]: !prev[so_number] }))
  }

  const confirmAction = async () => {
    const { type, inv_id, so_number } = confirming
    setError(null)
    try {
      if (type === 'ready') await markInvReady(inv_id)
      else if (type === 'dispatch') await markInvDispatched(inv_id)
      else if (type === 'undispatch') await unmarkInv(inv_id)
      else if (type === 'so_ready') await markSoReady(so_number)
      else if (type === 'so_dispatch') await markSoDispatched(so_number)
      setConfirming(null)
      fetchOrders()
    } catch {
      setError(t('dispatch.actionError'))
    }
  }

  const loadShippingLabels = async (soNumber, force = false) => {
    if (!force && shippingLabelsByOrder[soNumber]) {
      setLabelsOpen(prev => ({ ...prev, [soNumber]: true }))
      return
    }
    setLoadingLabels(soNumber)
    setError(null)
    try {
      const docs = await getOrderDocuments(soNumber)
      const labels = (docs || []).filter(doc => doc.document_type === 'shipping_label')
      setShippingLabelsByOrder(prev => ({ ...prev, [soNumber]: labels }))
      setLabelsOpen(prev => ({ ...prev, [soNumber]: true }))
    } catch {
      setError(t('dispatch.actionError'))
    } finally {
      setLoadingLabels(null)
    }
  }

  const toggleShippingLabels = async (soNumber) => {
    if (labelsOpen[soNumber]) {
      setLabelsOpen(prev => ({ ...prev, [soNumber]: false }))
      return
    }
    await loadShippingLabels(soNumber)
  }

  const handleShippingLabel = async (soNumber, fileList) => {
    const files = Array.from(fileList || [])
    if (!files.length) return
    setUploadingLabel(soNumber)
    setError(null)
    try {
      await uploadShippingLabel(soNumber, files)
      await fetchOrders()
      await loadShippingLabels(soNumber, true)
    } catch {
      setError(t('dispatch.actionError'))
    } finally {
      setUploadingLabel(null)
    }
  }

  if (loading) return <div className="p-8 text-sm text-gray-500">{t('dispatch.loading')}</div>

  const soOptions = Array.from(new Set(orders.map(o => o.so_number))).filter(Boolean)
  const clientOptions = Array.from(new Set(orders.map(o => o.client || ''))).filter(Boolean)

  const filteredOrders = orders.filter(o => {
    const matchesSO = filterSO ? o.so_number === filterSO : true
    const matchesClient = filterClient ? (o.client || '') === filterClient : true
    return matchesSO && matchesClient
  })

  const sortKeyDate = (o) => new Date(o.order_date || o.dispatched_at || 0)
  const sortComparator = (a, b) => {
    if (sortBy === 'newest') return sortKeyDate(b) - sortKeyDate(a)
    if (sortBy === 'oldest') return sortKeyDate(a) - sortKeyDate(b)
    if (sortBy === 'az') return (a.client || '').localeCompare(b.client || '')
    return 0
  }

  const pending = filteredOrders.filter(o => o.dispatch_status !== 'dispatched').slice().sort(sortComparator)
  const dispatched = filteredOrders.filter(o => o.dispatch_status === 'dispatched').slice().sort(sortComparator)

  const statusLabel = (inv) => {
    if (inv.dispatch_status === 'dispatched') return <span className="text-xs text-srg-green font-semibold">{t('dispatch.statusDispatched', { date: inv.dispatched_at?.slice(0, 10) })}</span>
    if (inv.dispatch_status === 'ready') return <span className="text-xs text-srg-orange font-semibold">{t('dispatch.statusReady', { date: inv.dispatched_at?.slice(0, 10) })}</span>
    if (inv.complete) return <span className="text-xs text-srg-green">{t('dispatch.statusComplete')}</span>
    return <span className="text-xs text-gray-400">{t('dispatch.statusIncomplete')}</span>
  }

  const actionButton = (inv) => {
    if (!inv.complete) return null
    if (inv.dispatch_status === 'pending') {
      return (
        <button
          onClick={() => setConfirming({ type: 'ready', inv_id: inv.inv_id, label: t('dispatch.confirmMarkReady', { inv: inv.inv_number }) })}
          className={`${btn.primary} ${btn.row}`}
        >
          {t('dispatch.markReady')}
        </button>
      )
    }
    if (inv.dispatch_status === 'ready') {
      return (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setConfirming({ type: 'dispatch', inv_id: inv.inv_id, label: t('dispatch.confirmDispatch', { inv: inv.inv_number }) })}
            className={`${btn.primary} ${btn.row}`}
          >
            {t('dispatch.markDispatched')}
          </button>
          <button
            onClick={() => setConfirming({ type: 'undispatch', inv_id: inv.inv_id, label: t('dispatch.confirmUnmark', { inv: inv.inv_number }) })}
            className={`${btn.ghost} ${btn.row} text-gray-400`}
          >
            {t('dispatch.unmark')}
          </button>
        </div>
      )
    }
    if (inv.dispatch_status === 'dispatched') {
      return (
        <button
          onClick={() => setConfirming({ type: 'undispatch', inv_id: inv.inv_id, label: t('dispatch.confirmUndispatch', { inv: inv.inv_number }) })}
          className={`${btn.ghost} ${btn.row} text-gray-400`}
        >
          {t('dispatch.unmark')}
        </button>
      )
    }
  }

  const orderStatusBadge = (o, isDispatched) => {
    if (isDispatched) {
      return <span className="inline-flex rounded bg-srg-green px-2 py-1 text-xs font-semibold text-white">{t('dispatch.badgeDispatched')}</span>
    }
    if (o.order_full) {
      return <span className="inline-flex rounded bg-srg-green px-2 py-1 text-xs font-semibold text-white">{t('dispatch.badgeOrderFull')}</span>
    }
    return <span className="inline-flex rounded bg-srg-orange px-2 py-1 text-xs font-semibold text-srg-black">{t('dispatch.badgeInvReady')}</span>
  }

  const orderActionButton = (o, isDispatched) => {
    if (isDispatched) return null
    if (o.all_complete) {
      if (o.invs.every(i => i.dispatch_status === 'dispatched')) {
        return null
      }
      if (o.invs.every(i => i.dispatch_status === 'ready' || i.dispatch_status === 'dispatched')) {
        return (
          <button
            onClick={(e) => { e.stopPropagation(); setConfirming({ type: 'so_dispatch', so_number: o.so_number, label: t('dispatch.confirmSoDispatch', { so: o.so_number }) }) }}
            className={`${btn.primary} ${btn.row}`}
          >
            {t('dispatch.markAllDispatched')}
          </button>
        )
      }
      return (
        <button
          onClick={(e) => { e.stopPropagation(); setConfirming({ type: 'so_ready', so_number: o.so_number, label: t('dispatch.confirmSoReady', { so: o.so_number }) }) }}
          className={`${btn.primary} ${btn.row}`}
        >
          {t('dispatch.markAllReady')}
        </button>
      )
    }
    return null
  }

  const shippingLabelAction = (o, isDispatched) => {
    if (!isDispatched) return null
    if (o.has_shipping_label) {
      return (
        <>
          <span className="text-xs font-semibold text-srg-green">{t('dispatch.labelAttached')}</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); toggleShippingLabels(o.so_number) }}
            className={`${btn.ghost} ${btn.row}`}
          >
            {loadingLabels === o.so_number ? t('dispatch.loading') : t('dispatch.viewLabels')}
          </button>
        </>
      )
    }
    return (
      <label
        className={`${btn.secondary} ${btn.row}`}
        onClick={(e) => e.stopPropagation()}
      >
        {uploadingLabel === o.so_number ? t('dispatch.loading') : t('dispatch.attachLabel')}
        <input
          type="file"
          accept=".pdf"
          multiple
          disabled={uploadingLabel === o.so_number}
          className="hidden"
          onChange={(e) => {
            handleShippingLabel(o.so_number, e.target.files)
            e.target.value = ''
          }}
        />
      </label>
    )
  }

  const renderDispatchTable = (rows, isDispatched) => (
    <div className={isDispatched ? "opacity-70" : ""}>
      <div className={table.wrapper}>
        <table className={table.base}>
          <thead>
            <tr className={table.head}>
              <th className={`${table.th} w-10`}></th>
              <th className={table.th}>{t('dispatch.salesOrder')}</th>
              <th className={table.th}>{t('dispatch.client')}</th>
              <th className={table.th}>{t('dispatch.purchaseOrder')}</th>
              <th className={table.th}>{t('dispatch.status')}</th>
              <th className={`${table.th} text-right`}>{t('dispatch.action')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(o => {
              const isOpen = expanded[o.so_number]
              const labelDocs = shippingLabelsByOrder[o.so_number] || []
              return (
                <Fragment key={o.so_number}>
                  <tr className={`${table.row} cursor-pointer`} onClick={() => toggleExpand(o.so_number)}>
                    <td className={`${table.td} text-gray-400`}>{isOpen ? '▾' : '▸'}</td>
                    <td className={`${table.td} font-mono text-srg-black`}>{o.so_number}</td>
                    <td className={`${table.td} text-srg-black`}>{o.client}</td>
                    <td className={`${table.td} font-mono text-gray-600`}>{o.po_number || "—"}</td>
                    <td className={table.td}>{orderStatusBadge(o, isDispatched)}</td>
                    <td className={table.td}>
                      <div className="hidden md:flex items-center justify-end gap-2">
                        {orderActionButton(o, isDispatched)}
                        {shippingLabelAction(o, isDispatched)}
                      </div>
                    </td>
                  </tr>
                  {labelsOpen[o.so_number] && (
                    <tr className={`${table.row} bg-srg-cream/40 hover:bg-srg-cream`}>
                      <td className={table.td}></td>
                      <td className={`${table.td} pl-8`} colSpan={5}>
                        <div className="hidden md:flex flex-wrap items-center gap-x-4 gap-y-1">
                          {labelDocs.map(doc => (
                            <button
                              key={doc.id || doc.file_url}
                              type="button"
                              onClick={(e) => { e.stopPropagation(); openSignedPdf(doc.file_url) }}
                              className="text-xs text-srg-black hover:underline cursor-pointer"
                            >
                              {doc.file_name}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                  {isOpen && o.invs.map(inv => (
                    <tr key={inv.inv_id} className={`${table.row} bg-srg-cream/60 hover:bg-srg-cream`}>
                      <td className={table.td}></td>
                      <td className={`${table.td} pl-8 font-mono text-srg-black`}>{inv.inv_number}</td>
                      <td className={`${table.td} text-gray-600`}>{inv.inv_date || "—"}</td>
                      <td className={`${table.td} text-gray-500`}>{inv.vexs?.length > 0 ? inv.vexs.join(', ') : "—"}</td>
                      <td className={table.td}>{statusLabel(inv)}</td>
                      <td className={table.td}>
                        <div className="hidden md:flex items-center justify-end">
                          {actionButton(inv)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <div className="p-8">
      <h1 className={pageTitle}>{t('dispatch.title')}</h1>

      {confirming && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-srg-surface border border-srg-border rounded p-6 w-96">
            <p className="text-sm font-semibold mb-4">{confirming.label}</p>
            {error && <p className="text-sm text-srg-red mb-3">{error}</p>}
            <div className="flex gap-3">
              <button onClick={confirmAction} className={btn.primary}>{t('dispatch.confirm')}</button>
              <button onClick={() => { setConfirming(null); setError(null) }} className={btn.secondary}>{t('dispatch.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div className="grid grid-cols-2 gap-2 md:flex md:gap-2">
          <select value={filterSO} onChange={e => setFilterSO(e.target.value)} className={input}>
            <option value="">{t('dispatch.allSos')}</option>
            {soOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterClient} onChange={e => setFilterClient(e.target.value)} className={input}>
            <option value="">{t('dispatch.allClients')}</option>
            {clientOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className={input}>
            <option value="newest">{t('dispatch.sortNewest')}</option>
            <option value="oldest">{t('dispatch.sortOldest')}</option>
            <option value="az">{t('dispatch.sortAz')}</option>
          </select>
        </div>
      </div>

      {pending.length === 0 && (
        <p className="text-sm text-gray-500 mb-6">{t('dispatch.emptyPending')}</p>
      )}

      <div className="mb-8">
        {renderDispatchTable(pending, false)}
      </div>

      {dispatched.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mb-3">{t('dispatch.dispatchedSection')}</h2>
          {renderDispatchTable(dispatched, true)}
        </>
      )}
    </div>
  )
}
