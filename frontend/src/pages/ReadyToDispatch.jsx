import { Fragment, useEffect, useState } from 'react'
import { getReadyToDispatch } from '../api'
import { btn, input, pageTitle, table } from "../styles"

export default function ReadyToDispatch() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [filterSO, setFilterSO] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [sortBy, setSortBy] = useState('newest')

  const fetchOrders = () => {
    getReadyToDispatch()
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
    if (inv.dispatch_status === 'dispatched') return <span className="text-xs text-srg-green font-semibold">Dispatched - {inv.dispatched_at?.slice(0, 10)}</span>
    if (inv.dispatch_status === 'ready') return <span className="text-xs text-srg-orange font-semibold">Ready to Dispatch - {inv.dispatched_at?.slice(0, 10)}</span>
    if (inv.complete) return <span className="text-xs text-srg-green">Complete</span>
    return <span className="text-xs text-gray-400">Incomplete</span>
  }

  const actionButton = (inv) => {
    if (!inv.complete) return null
    if (inv.dispatch_status === 'pending') {
      return (
        <button
          onClick={() => setConfirming({ type: 'ready', inv_id: inv.inv_id, label: `Mark ${inv.inv_number} as Ready to Dispatch?` })}
          className={`${btn.primary} ${btn.row}`}
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
            className={`${btn.primary} ${btn.row}`}
          >
            Mark Dispatched
          </button>
          <button
            onClick={() => setConfirming({ type: 'undispatch', inv_id: inv.inv_id, label: `Unmark ${inv.inv_number}?` })}
            className={`${btn.ghost} ${btn.row} text-gray-400`}
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
          className={`${btn.ghost} ${btn.row} text-gray-400`}
        >
          Unmark
        </button>
      )
    }
  }

  const orderStatusBadge = (o, isDispatched) => {
    if (isDispatched) {
      return <span className="inline-flex rounded bg-srg-green px-2 py-1 text-xs font-semibold text-white">Dispatched</span>
    }
    if (o.all_complete) {
      return <span className="inline-flex rounded bg-srg-green px-2 py-1 text-xs font-semibold text-white">All Complete</span>
    }
    return <span className="inline-flex rounded bg-srg-orange px-2 py-1 text-xs font-semibold text-srg-black">Partial</span>
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
            onClick={(e) => { e.stopPropagation(); setConfirming({ type: 'so_dispatch', so_number: o.so_number, label: `Confirm dispatch for all INVs in ${o.so_number}?` }) }}
            className={`${btn.primary} ${btn.row}`}
          >
            Mark All Dispatched
          </button>
        )
      }
      return (
        <button
          onClick={(e) => { e.stopPropagation(); setConfirming({ type: 'so_ready', so_number: o.so_number, label: `Mark all INVs in ${o.so_number} as Ready to Dispatch?` }) }}
          className={`${btn.primary} ${btn.row}`}
        >
          Mark All Ready
        </button>
      )
    }
    return null
  }

  const renderDispatchTable = (rows, isDispatched) => (
    <div className={isDispatched ? "opacity-70" : ""}>
      <div className={table.wrapper}>
        <table className={table.base}>
          <thead>
            <tr className={table.head}>
              <th className={`${table.th} w-10`}></th>
              <th className={table.th}>Sales Order</th>
              <th className={table.th}>Client</th>
              <th className={table.th}>Purchase Order</th>
              <th className={table.th}>Status</th>
              <th className={`${table.th} text-right`}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(o => {
              const isOpen = expanded[o.so_number]
              return (
                <Fragment key={o.so_number}>
                  <tr className={`${table.row} cursor-pointer`} onClick={() => toggleExpand(o.so_number)}>
                    <td className={`${table.td} text-gray-400`}>{isOpen ? '▾' : '▸'}</td>
                    <td className={`${table.td} font-mono text-srg-black`}>{o.so_number}</td>
                    <td className={`${table.td} text-srg-black`}>{o.client}</td>
                    <td className={`${table.td} font-mono text-gray-600`}>{o.po_number || "—"}</td>
                    <td className={table.td}>{orderStatusBadge(o, isDispatched)}</td>
                    <td className={table.td}>
                      <div className="hidden md:flex items-center justify-end">
                        {orderActionButton(o, isDispatched)}
                      </div>
                    </td>
                  </tr>
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

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div className="grid grid-cols-2 gap-2 md:flex md:gap-2">
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
      </div>

      {pending.length === 0 && (
        <p className="text-sm text-gray-500 mb-6">No orders ready to dispatch.</p>
      )}

      <div className="mb-8">
        {renderDispatchTable(pending, false)}
      </div>

      {dispatched.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mb-3">Dispatched</h2>
          {renderDispatchTable(dispatched, true)}
        </>
      )}
    </div>
  )
}
