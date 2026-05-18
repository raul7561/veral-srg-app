import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

const API = import.meta.env.VITE_API_URL

const LAG_STYLES = {
  overdue: { dot: 'bg-[#D45A00]', label: 'text-[#D45A00]' },
  follow_up: { dot: 'bg-yellow-500', label: 'text-yellow-600' },
  on_track: { dot: 'bg-[#2D7A4F]', label: 'text-[#2D7A4F]' },
  unknown: { dot: 'bg-[#D8D0C0]', label: 'text-[#D8D0C0]' },
}

export default function Orders() {
  const { t } = useTranslation()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})
  const [search, setSearch] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editConfirm, setEditConfirm] = useState(false)

  useEffect(() => {
    fetch(`${API}/orders`)
      .then(r => r.json())
      .then(data => { setOrders(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const toggle = (so) => setExpanded(prev => ({ ...prev, [so]: !prev[so] }))

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    setUploadMsg(null)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch(`${API}/orders/upload`, {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (res.ok) {
        setUploadMsg({ type: 'success', text: `${data.so_number} saved — ${data.client} — ${data.parts_count} parts` })
        const refreshed = await fetch(`${API}/orders`).then(r => r.json())
        setOrders(refreshed)
      } else {
        setUploadMsg({ type: 'error', text: data.detail || 'Upload failed' })
      }
    } catch {
      setUploadMsg({ type: 'error', text: 'Connection error' })
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleEdit = async () => {
    const res = await fetch(`${API}/orders/${editing}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm)
    })
    if (res.ok) {
      const refreshed = await fetch(`${API}/orders`).then(r => r.json())
      setOrders(refreshed)
      setEditing(null)
      setEditForm({})
      setEditConfirm(false)
    }
  }

  const filtered = orders.filter(o =>
    o.so_number.toLowerCase().includes(search.toLowerCase()) ||
    o.client.toLowerCase().includes(search.toLowerCase()) ||
    o.invoices.some(i => i.inv_number.toLowerCase().includes(search.toLowerCase()))
  )

  if (loading) return (
    <div className="p-8 text-[#111111] font-['DM_Sans']">Loading...</div>
  )

  return (
    <div className="p-8 font-['DM_Sans'] text-[#111111]">
      <h1 className="text-2xl font-bold tracking-widest uppercase mb-6">
        {t('nav.orders')}
      </h1>

      <div className="mb-6 flex items-center gap-4">
        <label className="cursor-pointer bg-[#F5A800] text-[#111111] text-xs font-bold uppercase tracking-widest px-4 py-2 rounded hover:opacity-90">
          {uploading ? 'Uploading...' : 'Upload SO PDF'}
          <input type="file" accept=".pdf" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
        {uploadMsg && (
          <span className={`text-xs font-bold ${uploadMsg.type === 'success' ? 'text-[#2D7A4F]' : 'text-[#D45A00]'}`}>
            {uploadMsg.text}
          </span>
        )}
      </div>

      <input
        type="text"
        placeholder="Search by SO, client or INV..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full max-w-md mb-6 px-4 py-2 border border-[#D8D0C0] rounded bg-[#FDFAF5] text-[#111111] text-sm focus:outline-none focus:border-[#F5A800]"
      />

      <div className="flex flex-col gap-3">
        {filtered.map(so => {
          const lag = LAG_STYLES[so.lag_status] || LAG_STYLES.unknown
          const isOpen = expanded[so.so_number]

          return (
            <div key={so.so_number} className="border border-[#D8D0C0] rounded bg-[#FDFAF5]">
              <button
                onClick={() => toggle(so.so_number)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
              >
                <div className="flex items-center gap-4">
                  <span className="font-bold text-sm tracking-widest">{so.so_number}</span>
                  <span className="text-sm text-[#111111]">{so.client}</span>
                  <span className="text-xs text-[#888]">{so.so_date}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold uppercase ${lag.label}`}>
                    <span className={`inline-block w-2 h-2 rounded-full mr-1 ${lag.dot}`} />
                    {so.lag_status === 'overdue' ? `Overdue (${so.business_days}d)` :
                     so.lag_status === 'follow_up' ? `Follow Up (${so.business_days}d)` :
                     `On Track (${so.business_days}d)`}
                  </span>
                  <span className="text-[#D8D0C0] text-lg">{isOpen ? '▲' : '▼'}</span>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-[#D8D0C0] px-5 py-4 flex flex-col gap-4">
                  {so.invoices.map(inv => {
                    const pct = inv.total_pns > 0 ? Math.round((inv.received_pns / inv.total_pns) * 100) : 0
                    const statusColor = pct === 100 ? '#2D7A4F' : pct > 0 ? '#F5A800' : '#D45A00'
                    return (
                      <div key={inv.inv_number} className="border border-[#D8D0C0] rounded p-4 bg-[#F5F0E8]">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-sm">{inv.inv_number}</span>
                          <span className="text-xs text-[#888]">
                            {inv.vex.length > 0 ? inv.vex.join(', ') : 'No VEX'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="flex-1 h-1.5 bg-[#D8D0C0] rounded">
                            <div
                              className="h-1.5 rounded transition-all"
                              style={{ width: `${pct}%`, backgroundColor: statusColor }}
                            />
                          </div>
                          <span className="text-xs font-bold" style={{ color: statusColor }}>
                            {inv.received_pns}/{inv.total_pns}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1">
                          {inv.parts.map(p => (
                            <div key={p.part_number} className="flex items-center gap-2 text-xs">
                              <span style={{ color: p.complete ? '#2D7A4F' : '#D8D0C0' }}>
                                {p.complete ? '✓' : '○'}
                              </span>
                              <span className="font-mono">{p.part_number}</span>
                              <span className="text-[#888]">{p.description}</span>
                              <span className="ml-auto text-[#888]">{p.quantity_received}/{p.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}

                  <div className="border-t border-[#D8D0C0] pt-4">
                    {editing === so.so_number ? (
                      <div className="flex flex-col gap-3">
                        <div className="flex gap-3">
                          <div className="flex flex-col gap-1 flex-1">
                            <label className="text-xs uppercase tracking-widest text-[#888]">Client</label>
                            <input
                              className="px-3 py-1.5 border border-[#D8D0C0] rounded bg-[#FDFAF5] text-sm text-[#111111] focus:outline-none focus:border-[#F5A800]"
                              value={editForm.client ?? so.client}
                              onChange={e => setEditForm(f => ({ ...f, client: e.target.value }))}
                            />
                          </div>
                          <div className="flex flex-col gap-1 flex-1">
                            <label className="text-xs uppercase tracking-widest text-[#888]">Ship To</label>
                            <input
                              className="px-3 py-1.5 border border-[#D8D0C0] rounded bg-[#FDFAF5] text-sm text-[#111111] focus:outline-none focus:border-[#F5A800]"
                              value={editForm.ship_to ?? so.ship_to}
                              onChange={e => setEditForm(f => ({ ...f, ship_to: e.target.value }))}
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs uppercase tracking-widest text-[#888]">SO Date</label>
                            <input
                              type="date"
                              className="px-3 py-1.5 border border-[#D8D0C0] rounded bg-[#FDFAF5] text-sm text-[#111111] focus:outline-none focus:border-[#F5A800]"
                              value={editForm.so_date ?? so.so_date}
                              onChange={e => setEditForm(f => ({ ...f, so_date: e.target.value }))}
                            />
                          </div>
                        </div>
                        {editConfirm ? (
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-[#D45A00] font-bold">Confirm changes?</span>
                            <button onClick={handleEdit} className="text-xs bg-[#2D7A4F] text-white px-3 py-1 rounded font-bold">Yes, save</button>
                            <button onClick={() => setEditConfirm(false)} className="text-xs text-[#888] px-3 py-1 rounded border border-[#D8D0C0]">Cancel</button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button onClick={() => setEditConfirm(true)} className="text-xs bg-[#F5A800] text-[#111111] px-3 py-1 rounded font-bold">Save</button>
                            <button onClick={() => { setEditing(null); setEditForm({}); setEditConfirm(false) }} className="text-xs text-[#888] px-3 py-1 rounded border border-[#D8D0C0]">Cancel</button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditing(so.so_number); setEditForm({}) }}
                        className="text-xs text-[#888] hover:text-[#111111] uppercase tracking-widest"
                      >
                        Edit SO
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}