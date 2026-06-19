import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { parseExport, calculateQuote, createQuote, updateQuote, getQuote, previewQuote, quotePdfUrl } from '../api/quotes'
import { btn, input, pageTitle, table } from '../styles'
import ConfirmDialog from '../components/ConfirmDialog'
import ClientAutocomplete from '../components/ClientAutocomplete'

const PRICE_LEVELS = [
  { value: 'US_LIST', label: 'US List' },
  { value: 'LIST_-2', label: 'List -2%' },
  { value: 'LIST_-3', label: 'List -3%' },
  { value: 'LIST_-5', label: 'List -5%' },
  { value: 'LIST_+2', label: 'List +2%' },
]

function money(n) {
  if (n === null || n === undefined) return '—'
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function weight(n) {
  if (n === null || n === undefined) return '—'
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function finalUnitPrice(line) {
  if (line.unit_price === null || line.unit_price === undefined) return null
  return line.unit_price + (line.core_deposit || 0)
}

export default function NewQuote() {
  const { id } = useParams()
  const editMode = Boolean(id)
  const navigate = useNavigate()
  const [lines, setLines] = useState([])
  const [originalQty, setOriginalQty] = useState({})
  const [clientName, setClientName] = useState('')
  const [priceLevel, setPriceLevel] = useState('US_LIST')
  const [fileName, setFileName] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [createdQuote, setCreatedQuote] = useState(null)
  const [previewHtml, setPreviewHtml] = useState(null)
  const [previewing, setPreviewing] = useState(false)
  const [confirmBack, setConfirmBack] = useState(false)
  const [quoteNumber, setQuoteNumber] = useState(null)
  const [shippingCost, setShippingCost] = useState('')

  useEffect(() => {
    if (!id) return
    getQuote(id)
      .then(q => {
        setClientName(q.client_name || '')
        setPriceLevel(q.price_level || 'US_LIST')
        setQuoteNumber(q.quote_number)
        setShippingCost(q.shipping_cost ?? '')
      })
      .catch(e => setError(e.message))
  }, [id])

  async function handleFile(file) {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const result = await parseExport(file, priceLevel)
      const calc = await calculateQuote(priceLevel, result.lines)
      const origMap = {}
      result.lines.forEach(l => { origMap[l.item_number] = l.quantity })
      setOriginalQty(origMap)
      setLines(calc.lines)
      setFileName(file.name)
      setStats({
        generated: result.lines_generated,
        discarded: result.lines_discarded,
        withStock: calc.lines.filter(l => l.is_quotable).length,
        noStock: calc.lines.filter(l => !l.is_quotable).length,
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function handleDragOver(e) {
    e.preventDefault()
    e.stopPropagation()
  }
  function handleDragLeave(e) {
    e.preventDefault()
    e.stopPropagation()
  }
  function handleDrop(e) {
    e.preventDefault()
    e.stopPropagation()
    const dropped = e.dataTransfer.files[0]
    if (dropped) handleFile(dropped)
  }

  function updateMinQty(itemNumber, value) {
    const v = value === '' ? null : parseInt(value, 10)
    setLines(prev => prev.map(l =>
      l.item_number === itemNumber ? { ...l, minimum_qty: Number.isNaN(v) ? null : v } : l
    ))
  }

  function updateQty(itemNumber, value) {
    const v = value === '' ? null : parseInt(value, 10)
    setLines(prev => prev.map(l =>
      l.item_number === itemNumber ? { ...l, quantity: Number.isNaN(v) ? l.quantity : v } : l
    ))
    // La cantidad tecleada pasa a ser la "pedida": el motor aplicará el package
    // al recalcular. Sincronizamos originalQty para que el tachado siga teniendo
    // sentido tras el redondeo.
    setOriginalQty(prev => ({ ...prev, [itemNumber]: Number.isNaN(v) ? prev[itemNumber] : v }))
  }

  function updateCoreDeposit(itemNumber, value) {
    const v = value === '' ? null : parseFloat(value)
    setLines(prev => prev.map(l =>
      l.item_number === itemNumber ? { ...l, core_deposit: (v === null || Number.isNaN(v)) ? null : v } : l
    ))
  }

  function removeLine(itemNumber) {
    setLines(prev => prev.filter(l => l.item_number !== itemNumber))
    setOriginalQty(prev => {
      const next = { ...prev }
      delete next[itemNumber]
      return next
    })
  }

  async function recalculate() {
    if (editMode) {
      const ok = window.confirm('Recalcular puede afectar los Core Deposit de este quote guardado. Si alguna línea traía core incluido en el precio, revísalo después de recalcular. ¿Continuar?')
      if (!ok) return
    }
    setLoading(true)
    setError(null)
    try {
      const coreMap = {}
      lines.forEach(l => { coreMap[l.item_number] = l.core_deposit ?? null })
      const calc = await calculateQuote(priceLevel, lines)
      const merged = calc.lines.map(l => ({ ...l, core_deposit: coreMap[l.item_number] ?? null }))
      setLines(merged)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function linesForPayload() {
    return lines.map(l => {
      const core = l.core_deposit || 0
      const base = (l.unit_price === null || l.unit_price === undefined) ? null : l.unit_price
      const finalPrice = base === null ? null : base + core
      let notes = l.notes || ''
      if (core > 0) {
        notes = notes ? `${notes} · Core deposit included` : 'Core deposit included'
      }
      const rest = { ...l }
      delete rest.core_deposit
      return { ...rest, unit_price: finalPrice, notes }
    })
  }

  async function openPreview() {
    if (!clientName.trim()) {
      setError('Escribe el nombre del cliente antes de revisar.')
      return
    }
    setPreviewing(true)
    setError(null)
    try {
      const payload = {
        client_name: clientName.trim(),
        price_level: priceLevel,
        shipping_cost: shippingCost === '' ? null : Number(shippingCost),
        lines: linesForPayload(),
      }
      const html = await previewQuote(payload)
      setPreviewHtml(html)
    } catch (e) {
      setError(e.message)
    } finally {
      setPreviewing(false)
    }
  }

  function backToEdit() {
    setPreviewHtml(null)
  }

  async function confirmQuote() {
    if (!clientName.trim()) {
      setError('Escribe el nombre del cliente antes de confirmar.')
      return
    }
    setConfirming(true)
    setError(null)
    try {
      const payload = {
        client_name: clientName.trim(),
        price_level: priceLevel,
        shipping_cost: shippingCost === '' ? null : Number(shippingCost),
        lines: linesForPayload(),
      }
      const result = editMode ? await updateQuote(id, payload) : await createQuote(payload)
      setCreatedQuote(result)
    } catch (e) {
      setError(e.message)
    } finally {
      setConfirming(false)
    }
  }

  function requestBack() {
    setConfirmBack(true)
  }

  function doBack() {
    setConfirmBack(false)
    resetForm()
  }

  function resetForm() {
    setLines([])
    setOriginalQty({})
    setClientName('')
    setPriceLevel('US_LIST')
    setFileName(null)
    setStats(null)
    setCreatedQuote(null)
    setPreviewHtml(null)
    setError(null)
    setShippingCost('')
  }

  const totalAmount = lines.reduce((sum, l) => {
    const fp = (l.unit_price === null || l.unit_price === undefined) ? 0 : l.unit_price + (l.core_deposit || 0)
    return sum + fp * l.quantity
  }, 0)
  const hasLines = lines.length > 0

  return (
    <div className="p-8">
      <ConfirmDialog
        open={confirmBack}
        title="Volver al inicio"
        message="Se perdera el quote en progreso. Esta accion no se puede deshacer. ¿Seguro que quieres volver?"
        confirmLabel="Si, volver"
        cancelLabel="Seguir editando"
        destructive
        onConfirm={doBack}
        onCancel={() => setConfirmBack(false)}
      />
      {(hasLines || previewHtml) && !createdQuote && (
        <button onClick={requestBack} className={`${btn.ghost} mb-2`} title="Volver al inicio">
          ← Volver
        </button>
      )}
      {editMode && (
        <button onClick={() => navigate('/quotes/history')} className={`${btn.ghost} mb-2`}>← Volver al historial</button>
      )}
      <h1 className={pageTitle}>{editMode ? `Actualizar Quote ${quoteNumber ?? ''}` : 'Nuevo Quote'}</h1>

      {createdQuote && (
        <div className="border border-srg-green rounded-lg bg-srg-surface p-6 mb-6">
          <div className="flex items-center gap-2 text-srg-green font-bold uppercase tracking-wide text-sm mb-2">
            <span>✓</span> Quote creado
          </div>
          <div className="text-3xl font-extrabold mb-1">{createdQuote.quote_number}</div>
          <div className="text-sm text-gray-500 mb-4">
            {createdQuote.client_name} · {createdQuote.total_items} líneas · ${Number(createdQuote.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="flex gap-3">
            <button onClick={resetForm} className={btn.primary}>Listo</button>
            <button onClick={() => window.open(quotePdfUrl(createdQuote.id), '_blank')} className={btn.secondary}>↓ Descargar PDF</button>
          </div>
        </div>
      )}

      {previewHtml && !createdQuote && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">Revisar documento</h2>
            <div className="flex gap-3">
              <button onClick={backToEdit} className={btn.secondary}>← Volver a editar</button>
              <button onClick={confirmQuote} disabled={confirming} className={btn.primary}>
                {confirming ? 'Generando...' : '✓ Confirmar y generar'}
              </button>
            </div>
          </div>
          <iframe
            srcDoc={previewHtml}
            title="Preview del documento"
            className="w-full border border-srg-border rounded bg-white"
            style={{ height: '70vh' }}
          />
        </div>
      )}

      {!hasLines && !createdQuote && (
        <label
          className="block border-2 border-dashed border-srg-border rounded-lg p-10 text-center bg-srg-surface cursor-pointer hover:bg-srg-cream transition-colors"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept=".csv,.xlsx,.xltm,.xlsm"
            className="hidden"
            onChange={e => handleFile(e.target.files[0])}
          />
          <div className="text-4xl text-srg-border mb-2">↑</div>
          <div className="font-bold mb-1">Sube el export de cat.com</div>
          <div className="text-sm text-gray-500">CSV o Excel. Las líneas, precios y totales aparecen al cargar.</div>
        </label>
      )}

      {loading && <div className="mt-4 text-gray-500">Procesando...</div>}
      {error && <div className="mt-4 text-srg-red font-medium">{error}</div>}

      {hasLines && !createdQuote && !previewHtml && (
        <>
          <div className="flex flex-wrap gap-3 items-end mb-4">
            <div className="flex-1 min-w-48">
              <label className="text-xs uppercase font-semibold text-gray-500 tracking-wide">Cliente</label>
              <ClientAutocomplete
                value={clientName}
                onChange={setClientName}
                placeholder="Nombre del cliente"
              />
            </div>
            <div className="w-40">
              <label className="text-xs uppercase font-semibold text-gray-500 tracking-wide">Nivel</label>
              <select className={input} value={priceLevel} onChange={e => setPriceLevel(e.target.value)}>
                {PRICE_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
            <div className="w-40">
              <label className="text-xs uppercase font-semibold text-gray-500 tracking-wide">Costo de envío</label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-500">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={shippingCost}
                  onChange={e => setShippingCost(e.target.value)}
                  placeholder="—"
                  className={input}
                />
              </div>
            </div>
            <div className="text-xs text-gray-500 flex items-center gap-1 pb-2">
              <span className="text-srg-green">✓</span> {fileName}
            </div>
          </div>

          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className={`${'border border-srg-border rounded bg-srg-surface'} p-3`}>
                <div className="text-2xl font-extrabold leading-none">{stats.generated}</div>
                <div className="mt-1 text-xs font-bold uppercase tracking-widest text-gray-400">Líneas</div>
              </div>
              <div className="border border-srg-border rounded bg-srg-surface p-3">
                <div className="text-2xl font-extrabold leading-none text-srg-green">{stats.withStock}</div>
                <div className="mt-1 text-xs font-bold uppercase tracking-widest text-gray-400">Con stock</div>
              </div>
              <div className="border border-srg-border rounded bg-srg-surface p-3">
                <div className="text-2xl font-extrabold leading-none text-srg-orange">{stats.noStock}</div>
                <div className="mt-1 text-xs font-bold uppercase tracking-widest text-gray-400">Sin stock</div>
              </div>
              <div className="border border-srg-border rounded bg-srg-surface p-3">
                <div className="text-2xl font-extrabold leading-none">{money(totalAmount)}</div>
                <div className="mt-1 text-xs font-bold uppercase tracking-widest text-gray-400">Total</div>
              </div>
            </div>
          )}

          <div className={table.wrapper}>
            <table className={`${table.base} min-w-[1100px] whitespace-nowrap`}>
              <thead>
                <tr className={table.head}>
                  <th className={table.th}>#</th>
                  <th className={table.th}>Brand</th>
                  <th className={`${table.th} text-right`}>Qty</th>
                  <th className={table.th}>Part#</th>
                  <th className={table.th}>Description</th>
                  <th className={`${table.th} text-right`}>Costo MADISA</th>
                  <th className={`${table.th} text-right`}>Unit Price</th>
                  <th className={`${table.th} text-right`}>Total Price</th>
                  <th className={`${table.th} text-right`}>Unit Wt</th>
                  <th className={`${table.th} text-right`}>Total Wt</th>
                  <th className={`${table.th} text-center`}>Min Qty</th>
                  <th className={table.th}>Reemplaza</th>
                  <th className={table.th}>Notes</th>
                  <th className={`${table.th} text-right`}>Core Deposit</th>
                  <th className={`${table.th} text-center`}></th>
                </tr>
              </thead>
              <tbody>
                {lines.map(line => {
                  const orig = originalQty[line.item_number]
                  const rounded = orig !== undefined && orig !== line.quantity
                  const totalPrice = finalUnitPrice(line) !== null ? finalUnitPrice(line) * line.quantity : null
                  const totalWeight = line.unit_weight ? line.unit_weight * line.quantity : null
                  const isShifted = line.notes && line.notes.toLowerCase().includes('corrida')
                  return (
                    <tr key={line.item_number} className={`${table.row} ${isShifted ? 'bg-red-50' : ''}`}>
                      <td className={`${table.td} text-gray-400`}>{line.item_number}</td>
                      <td className={`${table.td} text-gray-500`}>{line.brand}</td>
                      <td className={`${table.td} text-right`}>
                        <div className="flex items-center justify-end gap-1">
                          {rounded && <span className="text-srg-green font-semibold">{line.quantity}</span>}
                          <input
                            type="number"
                            min="1"
                            value={orig ?? line.quantity}
                            onChange={e => updateQty(line.item_number, e.target.value)}
                            className="w-16 border border-srg-border rounded px-2 py-0.5 text-right text-sm bg-white focus:outline-none focus:border-srg-yellow"
                          />
                        </div>
                      </td>
                      <td className={`${table.td} font-mono`}>{line.part_number}</td>
                      <td className={`${table.td} ${isShifted ? 'text-srg-red' : ''}`}>{line.description}</td>
                      <td className={`${table.td} text-right text-gray-500`}>{money(line.madisa_cost)}</td>
                      <td className={`${table.td} text-right font-semibold`}>{finalUnitPrice(line) === null ? (isShifted ? <span className="text-srg-red">revisar</span> : '—') : money(finalUnitPrice(line))}</td>
                      <td className={`${table.td} text-right text-gray-500`}>{totalPrice === null ? (isShifted ? <span className="text-srg-red">revisar</span> : '—') : money(totalPrice)}</td>
                      <td className={`${table.td} text-right text-gray-500`}>{weight(line.unit_weight)}</td>
                      <td className={`${table.td} text-right text-gray-500`}>{weight(totalWeight)}</td>
                      <td className={`${table.td} text-center`}>
                        <input
                          type="number"
                          min="1"
                          value={line.minimum_qty ?? ''}
                          onChange={e => updateMinQty(line.item_number, e.target.value)}
                          className="w-16 border border-srg-border rounded px-2 py-0.5 text-center text-sm bg-white focus:outline-none focus:border-srg-yellow"
                          placeholder="—"
                        />
                      </td>
                      <td className={`${table.td} font-mono text-srg-blue`}>{line.replaces_part_number || <span className="text-gray-300">—</span>}</td>
                      <td className={table.td}>
                        {isShifted
                          ? <span className="text-srg-red font-semibold text-xs">⚠ {line.notes}</span>
                          : line.notes === 'No stock'
                            ? <span className="text-srg-orange font-semibold text-xs">No stock</span>
                            : line.notes === 'Built to Order'
                              ? <span className="text-srg-amber font-semibold text-xs">Built to Order</span>
                              : <span className="text-gray-500 text-xs">{line.notes}</span>}
                      </td>
                      <td className={`${table.td} text-center`}>
                        <div className="flex items-center justify-end gap-1">
                          <span className={`text-sm ${line.unit_price === null ? 'text-gray-300' : 'text-gray-500'}`}>$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.core_deposit ?? ''}
                            disabled={line.unit_price === null}
                            onChange={e => updateCoreDeposit(line.item_number, e.target.value)}
                            className="w-20 border border-srg-border rounded px-2 py-0.5 text-right text-sm bg-white focus:outline-none focus:border-srg-yellow disabled:bg-gray-100 disabled:cursor-not-allowed"
                            placeholder="—"
                          />
                        </div>
                      </td>
                      <td className={`${table.td} text-center`}>
                        <button onClick={() => removeLine(line.item_number)} className="text-gray-400 hover:text-srg-red text-sm" title="Quitar línea">✕</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center mt-4">
            <div className="text-sm text-gray-500">{lines.length} líneas · desliza para ver todas las columnas</div>
            <div className="flex gap-3">
              <button onClick={recalculate} disabled={loading} className={btn.secondary}>
                ↻ Recalcular
              </button>
              <button onClick={openPreview} disabled={previewing || loading} className={btn.primary}>
                {previewing ? 'Generando preview...' : '→ Revisar documento'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
