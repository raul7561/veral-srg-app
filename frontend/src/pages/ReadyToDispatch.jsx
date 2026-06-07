import { useEffect, useState } from 'react'
import { btn, input, pageTitle } from "../styles"

export default function ReadyToDispatch() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [filterSO, setFilterSO] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [sortBy, setSortBy] = useState('newest')

  const fetchOrders = () => {
    fetch('http://localhost:8000/ready-to-dispatch/orders')
      .then(r => r.json())
      .then(data => {
        setOrders(data)
        setLoading(false)
      })
  }

  useEffect(() => { fetchOrders() }, [])

  const toggleExpand = (so_number) => {
    setExpanded(prev => ({ ...prev, [so_number]: !prev[so_number] }))
  }

  const confirmAction = () => {
    const { type, inv_id, so_number } = confirming
    const url = type === 'so_ready'
      ? `http://localhost:8000/ready-to-dispatch/so/${so_number}/ready`
      : type === 'so_dispatch'
        ? `http://localhost:8000/ready-to-dispatch/so/${so_number}/dispatch`
        : `http://localhost:8000/ready-to-dispatch/inv/${inv_id}/${type}`
    fetch(url, { method: 'PATCH' })
      .then(r => r.json())
      .then(() => {
        setConfirming(null)
        fetchOrders()
      })
  }

  if (loading) return <div className="p-8 text-sm text-gray-500">Loading...</div>

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
    if (inv.dispatch_status === 'dispatched') return <span className="text-xs text-srg-green font-semibold">🚚 Dispatched · {inv.dispatched_at?.slice(0, 10)}</span>
    if (inv.dispatch_status === 'ready') return <span className="text-xs text-srg-orange font-semibold">⏳ Ready to Dispatch · {inv.dispatched_at?.slice(0, 10)}</span>
    if (inv.complete) return <span className="text-xs text-srg-green">✓ Complete</span>
    return <span className="text-xs text-gray-400">⏳ Incomplete</span>
  }

  const actionButton = (inv) => {
    if (!inv.complete) return null
    if (inv.dispatch_status === 'pending') {
      return (
        <button
          onClick={() => setConfirming({ type: 'ready', inv_id: inv.inv_id, label: `Mark ${inv.inv_number} as Ready to Dispatch?` })}
          className="text-xs bg-srg-yellow text-srg-black font-semibold px-3 py-1.5 rounded"
        >
          Mark Ready
        </button>
      )
    }
    if (inv.dispatch_status === 'ready') {
      return (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setConfirming({ type: 'dispatch', inv_id: inv.inv_id, label: `Confirm dispatch for ${inv.inv_number}?` })}
            className="text-xs bg-srg-black text-white font-semibold px-3 py-1.5 rounded"
          >
            Mark Dispatched
          </button>
          <button
            onClick={() => setConfirming({ type: 'undispatch', inv_id: inv.inv_id, label: `Unmark ${inv.inv_number}?` })}
            className="text-xs text-gray-400 underline"
          >
            Unmark
          </button>
        </div>
      )
    }
    if (inv.dispatch_status === 'dispatched') {
      return (
        <button
          onClick={() => setConfirming({ type: 'undispatch', inv_id: inv.inv_id, label: `Unmark ${inv.inv_number} as dispatched?` })}
          className="text-xs text-gray-400 underline"
        >
          Unmark
        </button>
      )
    }
  }

  const renderCard = (o, isDispatched) => {
    const isOpen = expanded[o.so_number]
    return (
      <div key={o.so_number} className={`bg-srg-surface border border-srg-border rounded overflow-hidden ${isDispatched ? 'opacity-70' : ''}`}>
        <div
          className="px-5 py-4 flex justify-between items-center cursor-pointer hover:bg-srg-cream transition-colors"
          onClick={() => toggleExpand(o.so_number)}
        >
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">{isOpen ? '▲' : '▼'}</span>
            <span className="font-semibold text-sm">{o.so_number}</span>
            <span className="text-gray-400">·</span>
            <span className="text-sm">{o.client}</span>
            {o.po_number && (
              <>
                <span className="text-gray-400">·</span>
                <span className="text-sm text-gray-500">{o.po_number}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isDispatched
              ? <span className="text-xs text-srg-green font-semibold">🚚 Dispatched · {o.dispatched_at?.slice(0, 10)}</span>
              : o.all_complete
                ? <div className="flex items-center gap-2">
                    <span className="text-xs bg-srg-green text-white px-2 py-1 rounded">All Complete</span>
                    {o.invs.every(i => i.dispatch_status === 'dispatched')
                      ? null
                      : o.invs.every(i => i.dispatch_status === 'ready' || i.dispatch_status === 'dispatched')
                        ? <button
                            onClick={(e) => { e.stopPropagation(); setConfirming({ type: 'so_dispatch', so_number: o.so_number, label: `Confirm dispatch for all INVs in ${o.so_number}?` }) }}
                            className="text-xs bg-srg-black text-white font-semibold px-3 py-1.5 rounded"
                          >
                            Mark All Dispatched
                          </button>
                        : <button
                            onClick={(e) => { e.stopPropagation(); setConfirming({ type: 'so_ready', so_number: o.so_number, label: `Mark all INVs in ${o.so_number} as Ready to Dispatch?` }) }}
                            className="text-xs bg-srg-yellow text-srg-black font-semibold px-3 py-1.5 rounded"
                          >
                            Mark All Ready
                          </button>
                    }
                  </div>
                : <span className="text-xs bg-srg-orange text-srg-black px-2 py-1 rounded">Partial</span>
            }
          </div>
        </div>

        {isOpen && (
          <div className="divide-y divide-srg-border border-t border-srg-border">
            {o.invs.map(inv => (
              <div key={inv.inv_id} className="px-5 py-3 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-mono">{inv.inv_number}</span>
                  <span className="text-xs text-gray-400">{inv.inv_date}</span>
                  {statusLabel(inv)}
                  {inv.vexs?.length > 0 && (
                    <span className="text-xs text-gray-400">{inv.vexs.join(', ')}</span>
                  )}
                </div>
                {actionButton(inv)}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-8">
      <h1 className={pageTitle}>Ready to Dispatch</h1>

      {confirming && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-srg-surface border border-srg-border rounded p-6 w-96">
            <p className="text-sm font-semibold mb-4">{confirming.label}</p>
            <div className="flex gap-3">
              <button onClick={confirmAction} className={btn.primary}>Confirm</button>
              <button onClick={() => setConfirming(null)} className={btn.secondary}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 flex items-center gap-2">
        <select value={filterSO} onChange={e => setFilterSO(e.target.value)} className={input}>
          <option value="">All SOs</option>
          {soOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterClient} onChange={e => setFilterClient(e.target.value)} className={input}>
          <option value="">All Clients</option>
          {clientOptions.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className={input}>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="az">Client A–Z</option>
        </select>
      </div>

      {pending.length === 0 && (
        <p className="text-sm text-gray-500 mb-6">No orders ready to dispatch.</p>
      )}

      <div className="flex flex-col gap-3 mb-8">
        {pending.map(o => renderCard(o, false))}
      </div>

      {dispatched.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mb-3">Dispatched</h2>
          <div className="flex flex-col gap-3">
            {dispatched.map(o => renderCard(o, true))}
          </div>
        </>
      )}
    </div>
  )
}