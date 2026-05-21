import { useState, useRef } from "react"

export default function AttachDocumentModal({ soNumber, client, invs, poNumber, ferralOrderNumber, onClose, onSuccess }) {
  const [activeTab, setActiveTab] = useState("po")
  const [files, setFiles] = useState({ po: null, ferral_ov: null, inv: null, vex: null })
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState(null)
  const [selectedInv, setSelectedInv] = useState(invs.length > 0 ? invs[0].inv_number : "")
  const dragRefs = useRef({})

  function getEndpoint() {
    if (activeTab === "vex") {
      return `http://localhost:8000/supplier-tracking/orders/${soNumber}/inv/${selectedInv}/vex`
    }
    const endpointMap = {
      po: "http://localhost:8000/supplier-tracking/attach/po",
      ferral_ov: "http://localhost:8000/supplier-tracking/attach/ferral-ov",
      inv: "http://localhost:8000/supplier-tracking/attach/inv",
    }
    return endpointMap[activeTab]
  }

  async function uploadFile() {
    const file = files[activeTab]
    if (!file) {
      setMessage({ type: "error", text: "No file selected" })
      return
    }

    if (activeTab === "vex" && !selectedInv) {
      setMessage({ type: "error", text: "Select an INV first" })
      return
    }

    setUploading(true)
    setMessage(null)

    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await fetch(getEndpoint(), { method: "POST", body: formData })
      const data = await res.json()

      if (res.ok) {
        const tabLabels = { po: "PO", ferral_ov: "Ferral OV", inv: "INV", vex: "VEX" }
        const doc = activeTab === "vex" ? data.vex_number : (data.po_number || data.inv_number || data.ferral_order_number)
        setMessage({ type: "success", text: `${tabLabels[activeTab]} uploaded: ${doc}` })
        setFiles(prev => ({ ...prev, [activeTab]: null }))
        onSuccess()
      } else {
        setMessage({ type: "error", text: data.detail || "Upload failed" })
      }
    } catch (err) {
      setMessage({ type: "error", text: "Connection error" })
    } finally {
      setUploading(false)
    }
  }

  function handleDragOver(tab, e) {
    e.preventDefault()
    e.stopPropagation()
    if (dragRefs.current[tab]) {
      dragRefs.current[tab].classList.add("border-blue-500", "bg-blue-50")
    }
  }

  function handleDragLeave(tab, e) {
    e.preventDefault()
    e.stopPropagation()
    if (dragRefs.current[tab]) {
      dragRefs.current[tab].classList.remove("border-blue-500", "bg-blue-50")
    }
  }

  function handleDrop(tab, e) {
    e.preventDefault()
    e.stopPropagation()
    if (dragRefs.current[tab]) {
      dragRefs.current[tab].classList.remove("border-blue-500", "bg-blue-50")
    }
    const droppedFiles = e.dataTransfer.files
    if (droppedFiles.length > 0 && droppedFiles[0].type === "application/pdf") {
      setFiles(prev => ({ ...prev, [tab]: droppedFiles[0] }))
    }
  }

  function handleFileInput(tab, e) {
    if (e.target.files.length > 0) {
      setFiles(prev => ({ ...prev, [tab]: e.target.files[0] }))
    }
  }

  const tabConfig = {
    po: { label: "PO", icon: "📄" },
    ferral_ov: { label: "Ferral OV", icon: "📋" },
    inv: { label: "INV", icon: "📊" },
    vex: { label: "VEX", icon: "📑" },
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">
            Attach Document — {soNumber} — {client}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-black text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-gray-50 px-6">
          {Object.entries(tabConfig).map(([tabKey, { label, icon }]) => (
            <button
              key={tabKey}
              onClick={() => {
                setActiveTab(tabKey)
                setMessage(null)
              }}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tabKey
                  ? "border-black text-black"
                  : "border-transparent text-gray-600 hover:text-black"
              }`}
            >
              {icon} {label}
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

              {/* Drag and Drop Area */}
              <div
                ref={el => dragRefs.current[activeTab] = el}
                onDragOver={e => handleDragOver(activeTab, e)}
                onDragLeave={e => handleDragLeave(activeTab, e)}
                onDrop={e => handleDrop(activeTab, e)}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center transition-colors"
              >
                <input
                  id={`file-input-${activeTab}`}
                  type="file"
                  accept=".pdf"
                  onChange={e => handleFileInput(activeTab, e)}
                  className="hidden"
                />
                {files[activeTab] ? (
                  <div className="text-sm">
                    <div className="text-2xl mb-2">📄</div>
                    <p className="font-medium text-gray-900">{files[activeTab].name}</p>
                    <p className="text-gray-400 text-xs mt-1">
                      {(files[activeTab].size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="text-4xl mb-3">📤</div>
                    <p className="text-sm text-gray-600 mb-1">Drag and drop a PDF here</p>
                    <p className="text-xs text-gray-400 mb-3">or</p>
                    <label
                      htmlFor={`file-input-${activeTab}`}
                      className="inline-block px-4 py-2 bg-gray-100 hover:bg-gray-200 text-sm rounded cursor-pointer transition-colors"
                    >
                      Browse files
                    </label>
                  </>
                )}
              </div>

              {/* Current State */}
              <div className="mt-6 p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-600">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Current State</p>
                {activeTab === "po" && (
                  <p>{files.po ? "Ready to upload" : (poNumber ? `PO already attached: ${poNumber}` : "No PO attached yet")}</p>
                )}
                {activeTab === "ferral_ov" && (
                  <p>{files.ferral_ov ? "Ready to upload" : (ferralOrderNumber ? `Ferral OV attached: ${ferralOrderNumber}` : "No Ferral OV attached yet")}</p>
                )}
                {activeTab === "inv" && (
                  <p>{files.inv ? "Ready to upload" : (`${invs.length} invoice(s) attached`)}</p>
                )}
                {activeTab === "vex" && selectedInv && (
                  <p>{files.vex ? "Ready to upload" : `VEX for ${selectedInv}`}</p>
                )}
              </div>

              {/* Message */}
              {message && (
                <div className={`mt-4 p-3 rounded-lg text-sm ${
                  message.type === "success"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}>
                  {message.text}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t bg-gray-50 px-6 py-4 flex items-center gap-3 justify-end">
          {files[activeTab] && (
            <button
              onClick={() => setFiles(prev => ({ ...prev, [activeTab]: null }))}
              className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-100 transition-colors"
            >
              Clear
            </button>
          )}
          <button
            onClick={uploadFile}
            disabled={!files[activeTab] || uploading || (activeTab === "vex" && !selectedInv)}
            className="px-4 py-2 text-sm bg-black text-white rounded hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? "Uploading..." : "Upload"}
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
