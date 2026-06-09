import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getReceivingHistory } from '../api'
import Pagination from '../components/Pagination'
import { input, pageTitle, table } from '../styles'

const LIMIT = 25

export default function ReceivingHistory() {
  const [orders, setOrders] = useState([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [filterSO, setFilterSO] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parseInt(searchParams.get('page') || '1', 10)

  useEffect(() => {
    getReceivingHistory({ page, limit: LIMIT })
      .then(data => {
        setOrders(Array.isArray(data?.rows) ? data.rows : [])
        setTotal(data?.total || 0)
      })
  }, [page])

  const goToPage = (p) => setSearchParams({ page: String(p) })

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
          onChange={e => {
            setSearch(e.target.value)
            setSearchParams({ page: '1' })
          }}
        />
        <select value={filterSO} onChange={e => { setFilterSO(e.target.value); setSearchParams({ page: '1' }) }} className={input}>
          <option value="">All SOs</option>
          {soOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterClient} onChange={e => { setFilterClient(e.target.value); setSearchParams({ page: '1' }) }} className={input}>
          <option value="">All Clients</option>
          {clientOptions.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className={input}>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="az">Client A–Z</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500">No orders with received parts yet.</p>
      ) : (
        <div className={table.wrapper}>
          <table className={table.base}>
            <thead>
              <tr className={table.head}>
                <th className={table.th}>Sales Order</th>
                <th className={table.th}>Client</th>
                <th className={table.th}>Purchase Order</th>
                <th className={table.th}>Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <tr
                  key={o.so_number}
                  onClick={() => navigate(`/receiving-history/${o.so_number}`)}
                  className={`${table.row} cursor-pointer`}
                >
                  <td className={`${table.td} font-mono text-srg-black`}>{o.so_number}</td>
                  <td className={`${table.td} text-srg-black`}>{o.client}</td>
                  <td className={`${table.td} font-mono text-gray-600`}>{o.po_number || '—'}</td>
                  <td className={`${table.td} text-gray-600`}>{o.order_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} total={total} limit={LIMIT} onPageChange={goToPage} />
    </div>
  )
}
