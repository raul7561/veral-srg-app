import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import { getReceivingHistoryDetail } from '../api'
import { table } from '../styles'

export default function ReceivingHistoryDetail() {
  const { t } = useTranslation()
  const { soNumber } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getReceivingHistoryDetail(soNumber)
      .then(data => {
        setOrder(data)
        setLoading(false)
      })
  }, [soNumber])

  if (loading) return <div className="p-8 text-sm text-gray-500">{t('receiving.loading')}</div>
  if (!order) return <div className="p-8 text-sm text-gray-500">{t('receiving.notFound')}</div>

  return (
    <div className="p-8">
      <button
        onClick={() => navigate('/receiving-history')}
        className="text-sm text-gray-500 hover:text-srg-black mb-6 flex items-center gap-1"
      >
        {t('receiving.back')}
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">{order.so_number}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {order.client}
          {order.po_number && <span className="ml-3">· {order.po_number}</span>}
          {order.order_date && <span className="ml-3">· {order.order_date}</span>}
        </p>
      </div>

      <div className={table.wrapper}>
        <table className={table.base}>
          <thead>
            <tr className={table.head}>
              <th className={`${table.th} text-left`}>{t('receiving.partNumber')}</th>
              <th className={`${table.th} text-left`}>{t('receiving.description')}</th>
              <th className={`${table.th} text-center`}>{t('receiving.qty')}</th>
              <th className={`${table.th} text-center`}>{t('receiving.received')}</th>
              <th className={`${table.th} text-center`}>{t('receiving.pending')}</th>
              <th className={`${table.th} text-left`}>INV</th>
              <th className={`${table.th} text-left`}>VEX</th>
              <th className={`${table.th} text-left`}>{t('receiving.dateReceived')}</th>
            </tr>
          </thead>
          <tbody>
            {order.parts.map((p, i) => (
              <tr key={i} className={table.row}>
                <td className={`${table.td} font-mono text-xs`}>{p.part_number}</td>
                <td className={`${table.td} text-gray-700`}>{p.description}</td>
                <td className={`${table.td} text-center`}>{p.qty}</td>
                <td className={`${table.td} text-center text-srg-green font-semibold`}>{p.qty_received}</td>
                <td className={`${table.td} text-center`}>
                  {p.qty_pending > 0 ? (
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-srg-red font-semibold">{p.qty_pending}</span>
                      {p.pending_reason === 'invoice' && (
                        <span className="text-[10px] uppercase font-bold text-srg-orange">{t('receiving.pendingInvoice')}</span>
                      )}
                      {p.pending_reason === 'receive' && (
                        <span className="text-[10px] uppercase font-bold text-srg-red">{t('receiving.pendingReceive')}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400">0</span>
                  )}
                </td>
                <td className={`${table.td} text-xs text-gray-600`}>{p.invs.join(', ') || '—'}</td>
                <td className={`${table.td} text-xs text-gray-600`}>{p.vexs.join(', ') || '—'}</td>
                <td className={`${table.td} text-xs text-gray-500`}>{p.date_of_receiving || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
