import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getReceivingHistory } from '../api'
import Pagination from '../components/Pagination'
import { input, pageTitle, table } from '../styles'

const LIMIT = 25

export default function ReceivingHistory() {
  const { t } = useTranslation()
  const [orders, setOrders] = useState([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [filterSO, setFilterSO] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [soOptions, setSoOptions] = useState([])
  const [clientOptions, setClientOptions] = useState([])
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parseInt(searchParams.get('page') || '1', 10)

  useEffect(() => {
    const handle = setTimeout(() => {
      getReceivingHistory({ page, limit: LIMIT, search, filterSO, filterClient, sortBy })
        .then(data => {
          setOrders(Array.isArray(data?.rows) ? data.rows : [])
          setTotal(data?.total || 0)
          setSoOptions(Array.isArray(data?.so_options) ? data.so_options : [])
          setClientOptions(Array.isArray(data?.client_options) ? data.client_options : [])
        })
    }, 300)
    return () => clearTimeout(handle)
  }, [page, search, filterSO, filterClient, sortBy])

  const goToPage = (p) => setSearchParams({ page: String(p) })

  return (
    <div className="p-8">
      <h1 className={pageTitle}>{t('receiving.title')}</h1>

      <div className="mb-6 flex items-center gap-2">
        <input
          className={`${input} w-80`}
          placeholder={t('receiving.searchPlaceholder')}
          value={search}
          onChange={e => {
            setSearch(e.target.value)
            setSearchParams({ page: '1' })
          }}
        />
        <select value={filterSO} onChange={e => { setFilterSO(e.target.value); setSearchParams({ page: '1' }) }} className={input}>
          <option value="">{t('receiving.allSos')}</option>
          {soOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterClient} onChange={e => { setFilterClient(e.target.value); setSearchParams({ page: '1' }) }} className={input}>
          <option value="">{t('receiving.allClients')}</option>
          {clientOptions.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={sortBy} onChange={e => { setSortBy(e.target.value); setSearchParams({ page: '1' }) }} className={input}>
          <option value="newest">{t('receiving.sortNewest')}</option>
          <option value="oldest">{t('receiving.sortOldest')}</option>
          <option value="az">{t('receiving.sortAz')}</option>
        </select>
      </div>

      {orders.length === 0 ? (
        <p className="text-sm text-gray-500">{t('receiving.empty')}</p>
      ) : (
        <div className={table.wrapper}>
          <table className={table.base}>
            <thead>
              <tr className={table.head}>
                <th className={table.th}>{t('receiving.salesOrder')}</th>
                <th className={table.th}>{t('receiving.client')}</th>
                <th className={table.th}>{t('receiving.purchaseOrder')}</th>
                <th className={table.th}>{t('receiving.date')}</th>
                <th className={table.th}>{t('receiving.status')}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr
                  key={o.so_number}
                  onClick={() => navigate(`/receiving-history/${o.so_number}`)}
                  className={`${table.row} cursor-pointer`}
                >
                  <td className={`${table.td} font-mono text-srg-black`}>{o.so_number}</td>
                  <td className={`${table.td} text-srg-black`}>{o.client}</td>
                  <td className={`${table.td} font-mono text-gray-600`}>{o.po_number || '—'}</td>
                  <td className={`${table.td} text-gray-600`}>{o.order_date}</td>
                  <td className={table.td}>
                    {o.status === 'complete'
                      ? <span className="text-srg-green font-medium">{t('receiving.statusComplete')}</span>
                      : <span className="text-srg-orange font-medium">{t('receiving.statusPartial')}</span>}
                  </td>
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
