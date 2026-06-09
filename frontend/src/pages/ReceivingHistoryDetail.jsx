import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getReceivingHistoryDetail } from '../api'
import { table } from '../styles'

export default function ReceivingHistoryDetail() {
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

  if (loading) return <div className="p-8 text-sm text-gray-500">Loading...</div>
  if (!order) return <div className="p-8 text-sm text-gray-500">Order not found.</div>

  return (
    <div className="p-8">
      <button
        onClick={() => navigate('/receiving-history')}
        className="text-sm text-gray-500 hover:text-srg-black mb-6 flex items-center gap-1"
      >
        ← Back
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
              <th className={`${table.th} text-left`}>Part Number</th>
              <th className={`${table.th} text-left`}>Description</th>
              <th className={`${table.th} text-center`}>Qty</th>
              <th className={`${table.th} text-center`}>Received</th>
              <th className={`${table.th} text-center`}>Pending</th>
              <th className={`${table.th} text-left`}>INV</th>
              <th className={`${table.th} text-left`}>VEX</th>
              <th className={`${table.th} text-left`}>Date Received</th>
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
                  {p.qty_pending > 0
                    ? <span className="text-srg-red font-semibold">{p.qty_pending}</span>
                    : <span className="text-gray-400">0</span>
                  }
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
