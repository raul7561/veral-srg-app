import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { input, pageTitle } from '../styles'

export default function ReceivingHistory() {
  const [orders, setOrders] = useState([])
  const [search, setSearch] = useState('')
  const [filterSO, setFilterSO] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const navigate = useNavigate()

  useEffect(() => {
    fetch('http://localhost:8000/receiving-history/orders')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setOrders(data)
      })
  }, [])

  const soOptions = Array.from(new Set(orders.map(o => o.so_number))).filter(Boolean)
  const clientOptions = Array.from(new Set(orders.map(o => o.client || ''))).filter(Boolean)

  const filtered = orders
    .filter(o => {
      const q = search.toLowerCase()
      const matchesText = o.so_number.toLowerCase().includes(q) || (o.client || '').toLowerCase().includes(q) || (o.po_number || '').toLowerCase().includes(q)
      const matchesSO = filterSO ? o.so_number === filterSO : true
      const matchesClient = filterClient ? (o.client || '') === filterClient : true
      return matchesText && matchesSO && matchesClient
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
      <h1 className={pageTitle}>Receiving History</h1>

      <div className="mb-6 flex items-center gap-2">
        <input
          className={`${input} w-80`}
          placeholder="Search by SO, client or PO..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
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

      <div className="flex flex-col gap-2">
        {filtered.length === 0 && (
          <p className="text-sm text-gray-500">No orders with received parts yet.</p>
        )}
        {filtered.map(o => (
          <div
            key={o.so_number}
            onClick={() => navigate(`/receiving-history/${o.so_number}`)}
            className="bg-white border border-srg-border rounded px-5 py-4 cursor-pointer hover:border-[#F5A800] transition-colors"
          >
            <div className="flex justify-between items-center">
              <div>
                <span className="font-semibold text-sm">{o.so_number}</span>
                <span className="text-gray-400 mx-2">·</span>
                <span className="text-sm">{o.client}</span>
                {o.po_number && (
                  <>
                    <span className="text-gray-400 mx-2">·</span>
                    <span className="text-sm text-gray-500">{o.po_number}</span>
                  </>
                )}
              </div>
              <span className="text-xs text-gray-400">{o.order_date}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}