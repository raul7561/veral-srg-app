import { useState, useRef } from "react"
import { useTranslation } from "react-i18next"
import { attachFerralOv, attachInv, attachPo, createSupplierOrder } from "../api"

export default function UploadDocumentModal({ onClose, onSuccess }) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState("so")
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const dragRef = useRef(null)

  const uploadFnByTab = {
    so: createSupplierOrder,
    po: attachPo,
    ferral_ov: attachFerralOv,
    inv: attachInv,
  }

  const tabConfig = {
    so: { label: "SO" },
    po: { label: "PO" },
    ferral_ov: { label: "Ferral OV" },
    inv: { label: "INV" },
  }

  function handleDragOver(e) {
    e.preventDefault()
    e.stopPropagation()
    dragRef.current?.classList.add("border-blue-500", "bg-blue-50")
  }

  function handleDragLeave(e) {
    e.preventDefault()
    e.stopPropagation()
    dragRef.current?.classList.remove("border-blue-500", "bg-blue-50")
  }

  function handleDrop(e) {
    e.preventDefault()
    e.stopPropagation()
    dragRef.current?.classList.remove("border-blue-500", "bg-blue-50")
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.type === "application/pdf")
    if (dropped.length > 0) setFiles(prev => [...prev, ...dropped])
  }

  function handleFileInput(e) {
    const selected = Array.from(e.target.files).filter(f => f.type === "application/pdf")
    if (selected.length > 0) setFiles(prev => [...prev, ...selected])
    e.target.value = ""
  }

  function removeFile(index) {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  async function uploadAll() {
    if (files.length === 0) return
    setUploading(true)
    setResults([])

    for (let i = 0; i < files.length; i++) {
      setCurrentIndex(i)
      const file = files[i]
      try {
        const data = await uploadFnByTab[activeTab](file)
        const doc = data.so_number || data.po_number || data.ferral_order_number || "OK"
        setResults(prev => [...prev, { file: file.name, type: "success", text: t('modal.partsResult', { doc, count: data.parts_count ?? 0 }) }])
      } catch (err) {
        setResults(prev => [...prev, { file: file.name, type: "error", text: err.message || t('modal.connectionError') }])
      }
    }

    setCurrentIndex(-1)
    setFiles([])
    setUploading(false)
    onSuccess()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{t('modal.uploadDocument')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-black text-xl leading-none">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-gray-50 px-6">
          {Object.entries(tabConfig).map(([tabKey, { label }]) => (
            <button
              key={tabKey}
              onClick={() => {
                setActiveTab(tabKey)
                setFiles([])
                setResults([])
              }}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tabKey
                  ? "border-black text-black"
                  : "border-transparent text-gray-600 hover:text-black"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-6 py-6">
          {/* Drag and Drop */}
          <div
            ref={dragRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center transition-colors"
          >
            <input
              id="upload-file-input"
              type="file"
              accept=".pdf"
              multiple
              onChange={handleFileInput}
              className="hidden"
            />
            <div className="text-4xl mb-3">📤</div>
            <p className="text-sm text-gray-600 mb-1">{t('modal.dragDrop')}</p>
            <p className="text-xs text-gray-400 mb-3">{t('modal.or')}</p>
            <label
              htmlFor="upload-file-input"
              className="inline-block px-4 py-2 bg-gray-100 hover:bg-gray-200 text-sm rounded cursor-pointer transition-colors"
            >
              {t('modal.browse')}
            </label>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              {files.map((file, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded border text-sm">
                  <div className="flex items-center gap-2 flex-1">
                    {uploading && i === currentIndex ? (
                      <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <span>📄</span>
                    )}
                    <span className="text-gray-700">{file.name} <span className="text-gray-400 text-xs">({(file.size / 1024).toFixed(0)} KB)</span></span>
                    {uploading && i < currentIndex && <span className="text-srg-green text-xs">✓</span>}
                    {uploading && i > currentIndex && <span className="text-gray-400 text-xs">{t('modal.waiting')}</span>}
                  </div>
                  {!uploading && <button onClick={() => removeFile(i)} className="text-gray-400 hover:text-srg-red text-xs">✕</button>}
                </div>
              ))}
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="mt-4 space-y-2">
              {results.map((r, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg text-sm border ${
                    r.type === "success"
                      ? "bg-green-50 text-srg-green border-green-200"
                      : "bg-red-50 text-srg-red border-red-200"
                  }`}
                >
                  <span className="font-medium">{r.file}:</span> {r.text}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t bg-gray-50 px-6 py-4 flex items-center gap-3 justify-end">
          {files.length > 0 && (
            <button
              onClick={() => setFiles([])}
              className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-100 transition-colors"
            >
              {t('modal.clearAll')}
            </button>
          )}
          <button
            onClick={results.length > 0 && files.length === 0 ? onClose : uploadAll}
            disabled={results.length === 0 && (files.length === 0 || uploading)}
            className="px-4 py-2 text-sm bg-black text-white rounded hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? t('modal.uploading') : results.length > 0 && files.length === 0 ? t('modal.done') : files.length > 0 ? t('modal.uploadCount', { n: files.length }) : t('modal.upload')}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-100 transition-colors"
          >
            {t('modal.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
