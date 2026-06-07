import { useState, useRef } from "react"

export default function AttachDocumentModal({ soNumber, client, invs, onClose, onSuccess }) {
  const [activeTab, setActiveTab] = useState("inv")
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [selectedInv, setSelectedInv] = useState(invs.length > 0 ? invs[0].inv_number : "")
  const dragRef = useRef(null)

  function getEndpoint() {
    if (activeTab === "vex") {
      return `http://localhost:8000/supplier-tracking/orders/${soNumber}/inv/${selectedInv}/vex`
    }
    return "http://localhost:8000/supplier-tracking/attach/inv"
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
    if (activeTab === "vex" && !selectedInv) return
    setUploading(true)
    setResults([])

    for (let i = 0; i < files.length; i++) {
      setCurrentIndex(i)
      const file = files[i]
      const formData = new FormData()
      formData.append("file", file)
      try {
        const res = await fetch(getEndpoint(), { method: "POST", body: formData })
        const data = await res.json()
        if (res.ok) {
          const doc = data.inv_number || data.vex_number || "OK"
          setResults(prev => [...prev, { file: file.name, type: "success", text: `${doc} uploaded` }])
        } else {
          setResults(prev => [...prev, { file: file.name, type: "error", text: data.detail || "Upload failed" }])
        }
      } catch {
        setResults(prev => [...prev, { file: file.name, type: "error", text: "Connection error" }])
      }
    }

    setCurrentIndex(-1)
    setFiles([])
    setUploading(false)
    onSuccess()
  }

  const tabConfig = {
    inv: { label: "INV" },
    vex: { label: "VEX" },
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">
            Attach Document — {soNumber} — {client}
          </h2>
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
          {activeTab === "vex" && invs.length === 0 ? (
            <div className="text-center text-gray-400 py-8">No invoices available. Attach an INV first.</div>
          ) : (
            <>
              {/* INV Dropdown for VEX tab */}
              {activeTab === "vex" && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select INV</label>
                  <select
                    value={selectedInv}
                    onChange={e => setSelectedInv(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  >
                    {invs.map(inv => (
                      <option key={inv.id} value={inv.inv_number}>
                        {inv.inv_number} ({inv.inv_date || "No date"})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Drag and Drop */}
              <div
                ref={dragRef}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center transition-colors"
              >
                <input
                  id={`attach-file-input-${activeTab}`}
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={handleFileInput}
                  className="hidden"
                />
                <div className="text-4xl mb-3">📤</div>
                <p className="text-sm text-gray-600 mb-1">Drag and drop PDF files here</p>
                <p className="text-xs text-gray-400 mb-3">or</p>
                <label
                  htmlFor={`attach-file-input-${activeTab}`}
                  className="inline-block px-4 py-2 bg-gray-100 hover:bg-gray-200 text-sm rounded cursor-pointer transition-colors"
                >
                  Browse files
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
                    {uploading && i > currentIndex && <span className="text-gray-400 text-xs">waiting</span>}
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

              {/* Current State */}
              <div className="mt-6 p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-600">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Current State</p>
                {activeTab === "inv" && <p>{invs.length} invoice(s) attached</p>}
                {activeTab === "vex" && selectedInv && (
                  <p>VEX for {selectedInv}: {invs.find(i => i.inv_number === selectedInv)?.vex?.length || 0} attached</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t bg-gray-50 px-6 py-4 flex items-center gap-3 justify-end">
          {files.length > 0 && (
            <button
              onClick={() => setFiles([])}
              className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-100 transition-colors"
            >
              Clear All
            </button>
          )}
          <button
            onClick={results.length > 0 && files.length === 0 ? onClose : uploadAll}
            disabled={results.length === 0 && (files.length === 0 || uploading || (activeTab === "vex" && !selectedInv))}
            className="px-4 py-2 text-sm bg-black text-white rounded hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? "Uploading..." : results.length > 0 && files.length === 0 ? "Done" : `Upload ${files.length > 0 ? `(${files.length})` : ""}`}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}