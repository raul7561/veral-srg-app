import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function ReceivingHistory() {
  const [orders, setOrders] = useState([])
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    fetch('http://localhost:8000/receiving-history/orders')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setOrders(data)
      })
  }, [])

  const filtered = orders.filter(o =>
    o.so_number.toLowerCase().includes(search.toLowerCase()) ||
    (o.client || '').toLowerCase().includes(search.toLowerCase()) ||
    (o.po_number || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Receiving History</h1>

      <input
        className="border border-[#D8D0C0] rounded px-3 py-2 mb-6 w-80 bg-white text-sm"
        placeholder="Search by SO, client or PO..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div className="flex flex-col gap-2">
        {filtered.length === 0 && (
          <p className="text-sm text-gray-500">No orders with received parts yet.</p>
        )}
        {filtered.map(o => (
          <div
            key={o.so_number}
            onClick={() => navigate(`/receiving-history/${o.so_number}`)}
            className="bg-white border border-[#D8D0C0] rounded px-5 py-4 cursor-pointer hover:border-[#F5A800] transition-colors"
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