import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getQuotes, quoteHtmlUrl, quotePdfUrl, quoteExcelUrl } from '../api/quotes'
import { btn, input, pageTitle, table } from '../styles'

function money(n) {
  if (n === null || n === undefined) return '—'
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Historial() {
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const navigate = useNavigate()

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const params = { page, page_size: 20, status: 'activo' }
      if (search.trim()) params.search = search.trim()
      const data = await getQuotes(params)
      setQuotes(data.items || [])
      setTotalPages(data.total_pages || 1)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page])

  function doSearch() {
    setPage(1)
    load()
  }

  if (selected) {
    return (
      <div className="p-8">
        <button onClick={() => setSelected(null)} className={`${btn.ghost} mb-2`}>← Volver al historial</button>
        <div className="flex items-center justify-between mb-4">
          <h1 className={`${pageTitle} mb-0`}>Quote {selected.quote_number}</h1>
          <div className="flex gap-2">
            {!selected.so_number && (
              <button onClick={() => navigate(`/quotes/${selected.id}/edit`)} className={btn.secondary}>↻ Actualizar stock</button>
            )}
            <button onClick={() => window.open(quotePdfUrl(selected.id), '_blank')} className={btn.secondary}>↓ Descargar PDF</button>
            <button onClick={() => window.open(quoteExcelUrl(selected.id), '_blank')} className={btn.secondary}>↓ Descargar Excel</button>
          </div>
        </div>
        <iframe
          src={quoteHtmlUrl(selected.id)}
          title={`Quote ${selected.quote_number}`}
          className="w-full border border-srg-border rounded bg-white"
          style={{ height: '75vh' }}
        />
      </div>
    )
  }

  return (
    <div className="p-8">
      <h1 className={pageTitle}>Historial</h1>

      <div className="flex gap-3 mb-4">
        <input
          className={input}
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doSearch()}
          placeholder="Buscar por número de quote"
        />
        <button onClick={doSearch} className={btn.secondary}>Buscar</button>
      </div>

      {loading && <div className="text-gray-500">Cargando...</div>}
      {error && <div className="text-srg-red font-medium">{error}</div>}

      {!loading && quotes.length === 0 && (
        <div className="text-gray-500">No hay quotes activos.</div>
      )}

      {!loading && quotes.length > 0 && (
        <>
          <div className={table.wrapper}>
            <table className={table.base}>
              <thead>
                <tr className={table.head}>
                  <th className={table.th}>Número</th>
                  <th className={table.th}>Fecha</th>
                  <th className={table.th}>Cliente</th>
                  <th className={table.th}>Vendedor</th>
                  <th className={`${table.th} text-right`}>Total</th>
                  <th className={`${table.th} text-center`}>Ítems</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map(q => (
                  <tr key={q.id} onClick={() => setSelected(q)} className={`${table.row} cursor-pointer`}>
                    <td className={`${table.td} font-mono font-semibold`}>{q.quote_number}</td>
                    <td className={table.td}>{q.quote_date}</td>
                    <td className={table.td}>{q.client_name}</td>
                    <td className={table.td}>{q.sales_rep_name}</td>
                    <td className={`${table.td} text-right`}>{money(q.total_amount)}</td>
                    <td className={`${table.td} text-center`}>{q.total_items}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center mt-4">
            <div className="text-sm text-gray-500">Página {page} de {totalPages}</div>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className={btn.secondary}>← Anterior</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className={btn.secondary}>Siguiente →</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
