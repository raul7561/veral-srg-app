import { useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { convertQuote, getClients, getQuotes, quoteHtmlUrl, quotePdfUrl, quoteExcelUrl } from '../api/quotes'
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
  const [convertOpen, setConvertOpen] = useState(false)
  const [clientQuery, setClientQuery] = useState(selected?.client_name || '')
  const [clientResults, setClientResults] = useState([])
  const [selectedClient, setSelectedClient] = useState(null)
  const [soNumber, setSoNumber] = useState('')
  const [converting, setConverting] = useState(false)
  const [convertError, setConvertError] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()

  const load = useCallback(async () => {
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
  }, [page, search])

  useEffect(() => { queueMicrotask(() => load()) }, [page, load])

  useEffect(() => {
    const qid = location.state?.returnToConvertQuoteId
    if (!qid) return
    const q = quotes.find(x => x.id === qid)
    if (q) {
      queueMicrotask(() => openConvertModal(q))
      navigate(location.pathname, { replace: true, state: {} })
    } else if (!loading) {
      queueMicrotask(() => load())
    }
  }, [location.state, quotes]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredClients = clientResults
    .filter(c => c.id)
    .filter(c => (c.name || '').toLowerCase().includes(clientQuery.toLowerCase()))
    .slice(0, 6)

  function openConvertModal(quote = selected) {
    if (quote) setSelected(quote)
    setClientQuery(quote?.client_name || '')
    setClientResults([])
    setSelectedClient(null)
    setSoNumber('')
    setConvertError(null)
    setConvertOpen(true)
    getClients()
      .then(d => setClientResults(d.items || []))
      .catch(e => setConvertError(e.message))
  }

  async function doConvert() {
    if (!selectedClient?.id || !soNumber.trim() || !selected) return
    setConverting(true)
    setConvertError(null)
    try {
      const updated = await convertQuote(selected.id, {
        so_number: soNumber.trim(),
        customer_id: selectedClient.id,
      })
      setConvertOpen(false)
      setSelected(updated)
      load()
    } catch (e) {
      setConvertError(e.message)
    } finally {
      setConverting(false)
    }
  }

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
            {!selected.so_number && (
              <button onClick={() => openConvertModal()} className={btn.primary}>→ Convertir a SO</button>
            )}
            <button onClick={() => window.open(quotePdfUrl(selected.id), '_blank')} className={btn.secondary}>↓ Descargar PDF</button>
            <button onClick={() => window.open(quoteExcelUrl(selected.id), '_blank')} className={btn.secondary}>↓ Descargar Excel</button>
          </div>
        </div>
        {convertOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-[28rem] max-w-[calc(100vw-2rem)] shadow-xl">
              <p className="font-semibold mb-4">Convertir quote a SO</p>
              <div className="mb-4">
                <label className="text-xs uppercase font-semibold text-gray-500">Cliente</label>
                <input
                  className={`${input} mt-1`}
                  value={clientQuery}
                  onChange={e => {
                    setClientQuery(e.target.value)
                    setSelectedClient(null)
                  }}
                  placeholder="Buscar cliente registrado"
                />
                <div className="mt-2 max-h-48 overflow-y-auto border border-srg-border rounded">
                  {filteredClients.map(client => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => {
                        setSelectedClient(client)
                        setClientQuery(client.name)
                      }}
                      className={`block w-full text-left px-3 py-2 text-sm hover:bg-srg-cream ${
                        selectedClient?.id === client.id ? 'bg-srg-yellow text-srg-black font-bold' : ''
                      }`}
                    >
                      {client.name}
                    </button>
                  ))}
                  {filteredClients.length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-400">No hay coincidencias.</div>
                  )}
                </div>
                {!selectedClient && (
                  <div className="mt-3 rounded border border-srg-border p-3">
                    <p className="text-sm text-gray-500 mb-3">Este cliente aun no esta registrado en Customers</p>
                    <button
                      onClick={() => {
                        setConvertOpen(false)
                        navigate('/customers', { state: { returnToConvertQuoteId: selected.id } })
                      }}
                      className={btn.secondary}
                    >
                      + Agregar cliente en Customers
                    </button>
                  </div>
                )}
              </div>
              <div className="mb-4">
                <label className="text-xs uppercase font-semibold text-gray-500">Numero de SO</label>
                <input
                  className={`${input} mt-1`}
                  value={soNumber}
                  onChange={e => setSoNumber(e.target.value)}
                  placeholder="SO..."
                />
              </div>
              {convertError && <p className="text-sm text-srg-red mb-4">{convertError}</p>}
              <div className="flex gap-3">
                <button
                  onClick={doConvert}
                  disabled={!selectedClient?.id || !soNumber.trim() || converting}
                  className={btn.primary}
                >
                  {converting ? 'Convirtiendo...' : 'Convertir a SO'}
                </button>
                <button onClick={() => setConvertOpen(false)} className={btn.secondary}>Cancelar</button>
              </div>
            </div>
          </div>
        )}
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
