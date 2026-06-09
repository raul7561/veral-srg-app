import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getCustomerDocuments, getCustomers } from "../api";
import { btn, table } from "../styles";

const API = "http://localhost:8000";

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState(customer?.type === "domestic" ? "tax_certificate" : "other");
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploadExpiry, setUploadExpiry] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => { fetchAll(); }, [id]);

  useEffect(() => {
    if (customer) {
      setUploadType(customer.type === "domestic" ? "tax_certificate" : "other");
    }
  }, [customer]);

  async function fetchAll() {
    setLoading(true);
    const [allCustomers, docs] = await Promise.all([
      getCustomers(),
      getCustomerDocuments(id),
    ]);
    const found = allCustomers.find(c => c.id === id);
    setCustomer(found || null);
    setDocuments(docs);
    setLoading(false);
  }

  async function handleUpload() {
    if (!uploadFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("document_type", uploadType);
      formData.append("file", uploadFile);
      if (uploadLabel) formData.append("label", uploadLabel);
      if (uploadExpiry) formData.append("expiry_date", uploadExpiry);

      await fetch(`${API}/customers/${id}/documents`, {
        method: "POST",
        body: formData,
      });

      setUploadFile(null);
      setUploadLabel("");
      setUploadExpiry("");
      setShowUploadForm(false);
      fetchAll();
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteDoc(docId) {
    await fetch(`${API}/customers/${id}/documents/${docId}`, { method: "DELETE" });
    setConfirmDelete(null);
    fetchAll();
  }

  if (loading) return <div className="p-8 text-gray-400">Loading...</div>;
  if (!customer) return <div className="p-8 text-gray-400">Customer not found.</div>;

  const primary = customer.contacts?.find(c => c.is_primary) || {};
  const extras = customer.contacts?.filter(c => !c.is_primary) || [];

  const taxCert = documents.find(d => d.document_type === "tax_certificate");
  const otherDocs = documents.filter(d => d.document_type === "other");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const taxExpiry = taxCert?.expiry_date ? new Date(taxCert.expiry_date) : null;
  const taxExpired = taxExpiry && taxExpiry < today;
  const taxExpiringSoon = taxExpiry && !taxExpired && (taxExpiry - today) / (1000 * 60 * 60 * 24) <= 30;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Back */}
      <button
        onClick={() => navigate("/customers")}
        className="text-xs uppercase font-semibold text-gray-400 hover:text-black mb-6 inline-block"
      >
        ← Customers
      </button>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold uppercase tracking-wide">{customer.name}</h1>
        <p className="text-sm text-gray-500 mt-1">{customer.country} · {customer.type === "international" ? "International" : "Domestic"}</p>
      </div>

      {/* Contacts */}
      <section className="mb-8">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Contacts</h2>
        <div className={table.wrapper}>
          <table className={table.base}>
            <thead>
              <tr className={table.head}>
                <th className={table.th}>Name</th>
                <th className={table.th}>Email</th>
                <th className={table.th}>Phone</th>
                <th className={table.th}>Role</th>
              </tr>
            </thead>
            <tbody>
              <tr className={table.row}>
                <td className={table.td}>{primary.name || "—"}</td>
                <td className={`${table.td} text-gray-600`}>{primary.email || "—"}</td>
                <td className={`${table.td} text-gray-600`}>{primary.phone || "—"}</td>
                <td className={table.td}><span className="text-xs bg-srg-yellow text-srg-black font-semibold px-2 py-0.5 rounded">Primary</span></td>
              </tr>
              {extras.map((c, i) => (
                <tr key={i} className={table.row}>
                  <td className={table.td}>{c.name || "—"}</td>
                  <td className={`${table.td} text-gray-600`}>{c.email || "—"}</td>
                  <td className={`${table.td} text-gray-600`}>{c.phone || "—"}</td>
                  <td className={`${table.td} text-gray-400 text-xs`}>Additional</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Documents */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Documents</h2>
          <button
            onClick={() => setShowUploadForm(!showUploadForm)}
            className="text-xs uppercase font-semibold text-srg-yellow hover:underline"
          >
            + Upload
          </button>
        </div>

        {showUploadForm && (
          <div className="border rounded-lg p-4 mb-4 bg-white">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs uppercase font-semibold text-gray-500">Type</label>
                <select
                  className="w-full border rounded px-3 py-2 mt-1 text-sm"
                  value={uploadType}
                  onChange={e => setUploadType(e.target.value)}
                >
                  {customer.type === "domestic" && (
                    <option value="tax_certificate">Tax Certificate</option>
                  )}
                  <option value="other">Document</option>
                </select>
              </div>
              {uploadType === "tax_certificate" && (
                <div>
                  <label className="text-xs uppercase font-semibold text-gray-500">Expiry Date</label>
                  <input
                    type="date"
                    className="w-full border rounded px-3 py-2 mt-1 text-sm"
                    value={uploadExpiry}
                    onChange={e => setUploadExpiry(e.target.value)}
                  />
                </div>
              )}
              {uploadType === "other" && (
                <>
                  <div>
                    <label className="text-xs uppercase font-semibold text-gray-500">Label</label>
                    <input
                      className="w-full border rounded px-3 py-2 mt-1 text-sm"
                      value={uploadLabel}
                      onChange={e => setUploadLabel(e.target.value)}
                      placeholder="e.g. W-9 Form"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase font-semibold text-gray-500">Expiry Date</label>
                    <input
                      type="date"
                      className="w-full border rounded px-3 py-2 mt-1 text-sm"
                      value={uploadExpiry}
                      onChange={e => setUploadExpiry(e.target.value)}
                    />
                  </div>
                </>
              )}
              
            </div>
            <div className="mb-4">
              <label className="text-xs uppercase font-semibold text-gray-500">File</label>
              <input
                type="file"
                accept=".pdf"
                className="block mt-1 text-sm"
                onChange={e => setUploadFile(e.target.files[0])}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleUpload}
                disabled={uploading || !uploadFile}
                className={btn.primary}
              >
                {uploading ? "Uploading..." : "Upload"}
              </button>
              <button
                onClick={() => setShowUploadForm(false)}
                className={btn.secondary}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Tax Certificate */}
        {customer.type === "domestic" ? (
          <div className="mb-4">
            <p className="text-xs uppercase font-semibold text-gray-400 mb-2">Tax Certificate</p>
            {!taxCert ? (
              <div className="border rounded-lg px-4 py-3 bg-white flex items-center gap-2 text-sm text-gray-400">
                <span>⚠️</span> No tax certificate on file
              </div>
            ) : (
              <div className={`border rounded-lg px-4 py-3 bg-white flex items-center justify-between text-sm ${taxExpired ? "border-srg-red" : taxExpiringSoon ? "border-srg-orange" : ""}`}>
                <div className="flex items-center gap-3">
                  {taxExpired && <span className="text-xs bg-srg-red text-white font-semibold px-2 py-0.5 rounded">Expired</span>}
                  {taxExpiringSoon && <span className="text-xs bg-srg-orange text-srg-black font-semibold px-2 py-0.5 rounded">Expiring soon</span>}
                  <span className="font-medium">{taxCert.file_name}</span>
                  {taxCert.expiry_date && <span className="text-gray-400">· Expires {taxCert.expiry_date}</span>}
                </div>
                <div className="flex items-center gap-4">
                  <a href={taxCert.file_url} target="_blank" rel="noreferrer" className="text-xs text-srg-yellow font-semibold hover:underline uppercase">Download</a>
                  <button onClick={() => setConfirmDelete(taxCert.id)} className="text-xs text-srg-red hover:underline">Delete</button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mb-4">
            <p className="text-xs uppercase font-semibold text-gray-400 mb-2">Tax Certificate</p>
            <div className="border rounded-lg px-4 py-3 bg-white text-sm text-gray-400">
              Not required for international customers. Proof of Export is managed per Sales Order in Supplier Tracking.
            </div>
          </div>
        )}

        {/* Other docs */}
        {otherDocs.length > 0 && (
          <div>
            <p className="text-xs uppercase font-semibold text-gray-400 mb-2">Other</p>
            <div className="border rounded-lg overflow-hidden bg-white">
              {otherDocs.map((doc, i) => (
                <div key={doc.id} className={`flex items-center justify-between px-4 py-3 text-sm ${i > 0 ? "border-t" : ""}`}>
                  <span className="font-medium">{doc.label || doc.file_name}</span>
                  <div className="flex items-center gap-4">
                    <a href={doc.file_url} target="_blank" rel="noreferrer" className="text-xs text-srg-yellow font-semibold hover:underline uppercase">Download</a>
                    <button onClick={() => setConfirmDelete(doc.id)} className="text-xs text-srg-red hover:underline">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-80 shadow-xl">
            <p className="font-semibold mb-4">Delete this document?</p>
            <p className="text-sm text-gray-500 mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => handleDeleteDoc(confirmDelete)} className={btn.destructive}>Delete</button>
              <button onClick={() => setConfirmDelete(null)} className={btn.secondary}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
