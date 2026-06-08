import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getOrders } from '../api'
import { card, input, pageTitle, sectionTitle } from '../styles'

const LAG_STYLES = {
  overdue: { dot: 'bg-srg-red', label: 'text-srg-red', text: 'Overdue' },
  follow_up: { dot: 'bg-srg-orange', label: 'text-srg-orange', text: 'Follow Up' },
  on_track: { dot: 'bg-srg-green', label: 'text-srg-green', text: 'On Track' },
  unknown: { dot: 'bg-srg-border', label: 'text-srg-border', text: 'On Track' },
}

const METRIC_FILTERS = [
  { key: 'on_track', label: 'On Track', numberClass: 'text-srg-green', activeBorder: 'border-srg-green' },
  { key: 'follow_up', label: 'Follow Up', numberClass: 'text-srg-orange', activeBorder: 'border-srg-orange' },
  { key: 'overdue', label: 'Overdue', numberClass: 'text-srg-red', activeBorder: 'border-srg-red' },
  { key: 'no_inv', label: 'No INV', numberClass: 'text-srg-black', activeBorder: 'border-srg-black' },
]

const BAR_COLORS = {
  on_track: '#2D7A4F',
  follow_up: '#D45A00',
  overdue: '#C0392B',
}

const DISPATCH_COLORS = {
  pending: '#D45A00',
  ready: '#2D7A4F',
  dispatched: '#111111',
}

export default function Orders() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('lag')
  const [activeFilter, setActiveFilter] = useState(null)

  useEffect(() => {
    getOrders()
      .then(data => { setOrders(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const metricCounts = useMemo(() => ({
    on_track: orders.filter(order => order.lag_status === 'on_track').length,
    follow_up: orders.filter(order => order.lag_status === 'follow_up').length,
    overdue: orders.filter(order => order.lag_status === 'overdue').length,
    no_inv: orders.filter(order => order.invoices.length === 0).length,
  }), [orders])

  const ageData = useMemo(() => [
    {
      name: 'On Track',
      count: orders.filter(order => order.business_days >= 0 && order.business_days <= 14).length,
      fill: BAR_COLORS.on_track,
    },
    {
      name: 'Follow Up',
      count: orders.filter(order => order.business_days >= 15 && order.business_days <= 19).length,
      fill: BAR_COLORS.follow_up,
    },
    {
      name: 'Overdue',
      count: orders.filter(order => order.business_days >= 20).length,
      fill: BAR_COLORS.overdue,
    },
  ], [orders])

  const dispatchData = useMemo(() => {
    const counts = { pending: 0, ready: 0, dispatched: 0 }
    orders.forEach(order => {
      order.invoices.forEach(inv => {
        if (counts[inv.dispatch_status] !== undefined) counts[inv.dispatch_status] += 1
      })
    })

    return [
      { name: 'Pending', key: 'pending', value: counts.pending },
      { name: 'Ready', key: 'ready', value: counts.ready },
      { name: 'Dispatched', key: 'dispatched', value: counts.dispatched },
    ]
  }, [orders])

  const filtered = useMemo(() => orders
    .filter(o => {
      const q = search.toLowerCase()
      const matchesText = o.so_number.toLowerCase().includes(q) ||
        o.client.toLowerCase().includes(q) ||
        o.invoices.some(i => i.inv_number.toLowerCase().includes(q))
      const matchesActiveFilter = !activeFilter ||
        (activeFilter === 'no_inv' ? o.invoices.length === 0 : o.lag_status === activeFilter)

      return matchesText && matchesActiveFilter
    })
    .slice()
    .sort((a, b) => {
      if (sortBy === 'lag') {
        const order = { overdue: 0, follow_up: 1, on_track: 2 }
        const va = order[a.lag_status] ?? 3
        const vb = order[b.lag_status] ?? 3
        return va - vb
      }
      if (sortBy === 'newest') return new Date(b.so_date) - new Date(a.so_date)
      if (sortBy === 'oldest') return new Date(a.so_date) - new Date(b.so_date)
      if (sortBy === 'az') return a.client.localeCompare(b.client)
      return 0
    }), [activeFilter, orders, search, sortBy])

  if (loading) return (
    <div className="p-8 text-srg-black font-['DM_Sans']">Loading...</div>
  )

  return (
    <div className="p-8">
      <h1 className={pageTitle}>
        {t('nav.orders')}
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {METRIC_FILTERS.map(metric => {
          const isActive = activeFilter === metric.key

          return (
            <button
              key={metric.key}
              type="button"
              onClick={() => setActiveFilter(isActive ? null : metric.key)}
              className={`${card} ${isActive ? `border-2 ${metric.activeBorder}` : ''} p-4 text-left hover:bg-srg-cream transition-colors cursor-pointer`}
            >
              <div className={`text-4xl font-extrabold leading-none ${metric.numberClass}`}>
                {metricCounts[metric.key]}
              </div>
              <div className="mt-2 text-xs font-bold uppercase tracking-widest text-gray-400">
                {metric.label}
              </div>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className={`${card} p-4`}>
          <h2 className={sectionTitle}>Antigüedad</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={ageData}>
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count">
                {ageData.map(item => (
                  <Cell key={item.name} fill={item.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={`${card} p-4`}>
          <h2 className={sectionTitle}>Despacho</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={dispatchData}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={80}
              >
                {dispatchData.map(item => (
                  <Cell key={item.key} fill={DISPATCH_COLORS[item.key]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mb-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
        <input
          type="text"
          placeholder="Search by SO, client or INV..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={`${input} sm:max-w-md`}
        />

        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className={`${input} sm:max-w-48`}
        >
          <option value="lag">By Lag</option>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="az">Client A–Z</option>
        </select>
      </div>

      <div className={`${card} overflow-hidden`}>
        <table className="w-full border-collapse text-sm">
          <tbody>
            {filtered.map(so => {
              const lag = LAG_STYLES[so.lag_status] || LAG_STYLES.unknown

              return (
                <tr
                  key={so.so_number}
                  onClick={() => navigate(`/supplier-tracking/${so.so_number}`)}
                  className="border-b border-srg-border last:border-b-0 hover:bg-srg-cream cursor-pointer"
                >
                  <td className="py-2.5 px-4 font-mono font-bold text-srg-black whitespace-nowrap">
                    {so.so_number}
                  </td>
                  <td className="py-2.5 px-4 text-srg-black">
                    {so.client}
                  </td>
                  <td className="py-2.5 px-4 text-xs text-gray-500 whitespace-nowrap">
                    {so.so_date}
                  </td>
                  <td className="py-2.5 px-4 text-xs text-gray-500 whitespace-nowrap">
                    {so.invoices.length} INV
                  </td>
                  <td className="py-2.5 px-4 text-right whitespace-nowrap">
                    <span className={`text-xs font-bold uppercase ${lag.label}`}>
                      <span className={`inline-block w-2 h-2 rounded-full mr-1 ${lag.dot}`} />
                      {lag.text} ({so.business_days}d)
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
