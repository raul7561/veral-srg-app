import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

export default function ReceivingHistoryDetail() {
  const { soNumber } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`http://localhost:8000/receiving-history/orders/${soNumber}`)
      .then(r => r.json())
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
        className="text-sm text-gray-500 hover:text-[#111111] mb-6 flex items-center gap-1"
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

      <div className="bg-white border border-[#D8D0C0] rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F5F0E8] text-xs uppercase text-gray-500 border-b border-[#D8D0C0]">
            <tr>
              <th className="px-4 py-3 text-left">Part Number</th>
              <th className="px-4 py-3 text-left">Description</th>
              <th className="px-4 py-3 text-center">Qty</th>
              <th className="px-4 py-3 text-center">Received</th>
              <th className="px-4 py-3 text-center">Pending</th>
              <th className="px-4 py-3 text-left">INV</th>
              <th className="px-4 py-3 text-left">VEX</th>
              <th className="px-4 py-3 text-left">Date Received</th>
            </tr>
          </thead>
          <tbody>
            {order.parts.map((p, i) => (
              <tr key={i} className="border-b border-[#D8D0C0] last:border-0">
                <td className="px-4 py-3 font-mono text-xs">{p.part_number}</td>
                <td className="px-4 py-3 text-gray-700">{p.description}</td>
                <td className="px-4 py-3 text-center">{p.qty}</td>
                <td className="px-4 py-3 text-center text-[#2D7A4F] font-semibold">{p.qty_received}</td>
                <td className="px-4 py-3 text-center">
                  {p.qty_pending > 0
                    ? <span className="text-[#D45A00] font-semibold">{p.qty_pending}</span>
                    : <span className="text-gray-400">0</span>
                  }
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">{p.invs.join(', ') || '—'}</td>
                <td className="px-4 py-3 text-xs text-gray-600">{p.vexs.join(', ') || '—'}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{p.date_of_receiving || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}