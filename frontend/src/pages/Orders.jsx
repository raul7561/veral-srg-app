import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { getOrders, getQuotesThisMonthCount } from '../api'
import LoadError from '../components/LoadError'
import { card, input, pageTitle, sectionTitle, table } from '../styles'

const LAG_STYLES = {
  overdue: { dot: 'bg-srg-red', label: 'text-srg-red' },
  follow_up: { dot: 'bg-srg-orange', label: 'text-srg-orange' },
  on_track: { dot: 'bg-srg-green', label: 'text-srg-green' },
  unknown: { dot: 'bg-srg-border', label: 'text-srg-border' },
}

const METRIC_FILTERS = [
  { key: 'on_track', label: 'On Track', numberClass: 'text-srg-green', activeBorder: 'border-srg-green' },
  { key: 'follow_up', label: 'Follow Up', numberClass: 'text-srg-orange', activeBorder: 'border-srg-orange' },
  { key: 'overdue', label: 'Overdue', numberClass: 'text-srg-red', activeBorder: 'border-srg-red' },
  { key: 'no_inv', label: 'No INV', numberClass: 'text-srg-black', activeBorder: 'border-srg-black' },
]

const BAR_COLORS = {
  on_track: 'var(--color-srg-green)',
  follow_up: 'var(--color-srg-orange)',
  overdue: 'var(--color-srg-red)',
}

const DISPATCH_COLORS = {
  pending: 'var(--color-srg-orange)',
  ready: 'var(--color-srg-green)',
  dispatched: 'var(--color-srg-black)',
}

export default function Orders() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState(null)
  const [quotesThisMonth, setQuotesThisMonth] = useState(0)
  const [error, setError] = useState(false)

  function getLagText(status) {
    if (status === 'overdue') return t('orders.overdue')
    if (status === 'follow_up') return t('orders.followUp')
    return t('orders.onTrack')
  }

  const loadOrders = useCallback(() => {
    setLoading(true)
    setError(false)
    getOrders()
      .then(data => { setOrders(data); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
    getQuotesThisMonthCount()
      .then(setQuotesThisMonth)
      .catch(() => setQuotesThisMonth(0))
  }, [])

  useEffect(() => { queueMicrotask(() => loadOrders()) }, [loadOrders])

  const metricCounts = useMemo(() => ({
    on_track: orders.filter(order => order.lag_status === 'on_track').length,
    follow_up: orders.filter(order => order.lag_status === 'follow_up').length,
    overdue: orders.filter(order => order.lag_status === 'overdue').length,
    no_inv: orders.filter(order => order.invoices.length === 0).length,
  }), [orders])

  const ageData = useMemo(() => [
    {
      name: t('orders.onTrack'),
      count: orders.filter(order => order.business_days >= 0 && order.business_days <= 14).length,
      fill: BAR_COLORS.on_track,
    },
    {
      name: t('orders.followUp'),
      count: orders.filter(order => order.business_days >= 15 && order.business_days <= 19).length,
      fill: BAR_COLORS.follow_up,
    },
    {
      name: t('orders.overdue'),
      count: orders.filter(order => order.business_days >= 20).length,
      fill: BAR_COLORS.overdue,
    },
  ], [orders, t])

  const dispatchData = useMemo(() => {
    const counts = { pending: 0, ready: 0, dispatched: 0 }
    orders.forEach(order => {
      order.invoices.forEach(inv => {
        if (counts[inv.dispatch_status] !== undefined) counts[inv.dispatch_status] += 1
      })
    })

    return [
      { name: t('orders.pending'), key: 'pending', value: counts.pending },
      { name: t('orders.ready'), key: 'ready', value: counts.ready },
      { name: t('orders.dispatched'), key: 'dispatched', value: counts.dispatched },
    ]
  }, [orders, t])

  const filtered = useMemo(() => orders
    .filter(o => {
      const q = search.toLowerCase()
      const matchesText = (o.so_number || '').toLowerCase().includes(q) ||
        (o.client || '').toLowerCase().includes(q) ||
        o.invoices.some(i => (i.inv_number || '').toLowerCase().includes(q))
      const matchesActiveFilter = !activeFilter ||
        (activeFilter === 'no_inv' ? o.invoices.length === 0 : o.lag_status === activeFilter)
      return matchesText && matchesActiveFilter
    }), [activeFilter, orders, search])

  const topCritical = useMemo(
    () => [...filtered].sort((a, b) => (b.business_days ?? 0) - (a.business_days ?? 0)).slice(0, 10),
    [filtered]
  )

  if (loading) return (
    <div className="p-8 text-srg-black font-['DM_Sans']">{t('orders.loading')}</div>
  )
  if (error) return <LoadError message={t('orders.loadError')} onRetry={loadOrders} />

  return (
    <>
      <div className="p-8">
      <h1 className={pageTitle}>
        {t('orders.title')}
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
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
                {metric.key === 'on_track'
                  ? t('orders.onTrack')
                  : metric.key === 'follow_up'
                    ? t('orders.followUp')
                    : metric.key === 'overdue'
                      ? t('orders.overdue')
                      : metric.key === 'no_inv'
                        ? t('orders.noInv')
                        : metric.label}
              </div>
            </button>
          )
        })}
        <div className={`${card} p-4`}>
          <div className="text-4xl font-extrabold leading-none text-srg-black">
            {quotesThisMonth}
          </div>
          <div className="mt-2 text-xs font-bold uppercase tracking-widest text-gray-400">
            {t('orders.quotesThisMonth')}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className={`${card} p-4`}>
          <h2 className={sectionTitle}>{t('orders.ordersByAge')}</h2>
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
          <h2 className={sectionTitle}>{t('orders.invsByDispatch')}</h2>
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
          placeholder={t('orders.searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={`${input} sm:max-w-md`}
        />
      </div>

      <h2 className={sectionTitle}>{t('orders.mostCritical')}</h2>
      <p className="text-xs text-gray-400 mb-3">{t('orders.topHint')}</p>

      <div className={table.wrapper}>
        <table className={table.base}>
          <thead>
            <tr className={table.head}>
              <th className={table.th}>{t('orders.salesOrder')}</th>
              <th className={table.th}>{t('orders.client')}</th>
              <th className={table.th}>{t('orders.date')}</th>
              <th className={table.th}>{t('orders.inv')}</th>
              <th className={`${table.th} text-right`}>{t('orders.status')}</th>
            </tr>
          </thead>
          <tbody>
            {topCritical.map(so => {
              const lag = LAG_STYLES[so.lag_status] || LAG_STYLES.unknown

              return (
                <tr
                  key={so.so_number}
                  onClick={() => navigate(`/supplier-tracking/${so.so_number}`)}
                  className={`${table.row} cursor-pointer`}
                >
                  <td className={`${table.td} font-mono text-srg-black whitespace-nowrap`}>
                    {so.so_number}
                  </td>
                  <td className={`${table.td} text-srg-black`}>
                    {so.client}
                  </td>
                  <td className={`${table.td} text-gray-600 whitespace-nowrap`}>
                    {so.so_date}
                  </td>
                  <td className={`${table.td} text-gray-600 whitespace-nowrap`}>
                    {so.invoices.length} INV
                  </td>
                  <td className={`${table.td} text-right whitespace-nowrap`}>
                    <span className={`text-xs uppercase ${lag.label}`}>
                      <span className={`inline-block w-2 h-2 rounded-full mr-1 ${lag.dot}`} />
                      {getLagText(so.lag_status)} ({so.business_days}d)
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      </div>
    </>
  )
}
