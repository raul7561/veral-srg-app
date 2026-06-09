import { useEffect, useState } from "react";
import { getCustomers } from "../api";
import { btn, pageTitle, table } from "../styles";

const API = "http://localhost:8000";

const PRIORITY_COUNTRIES = [
  "United States", "Chile", "Peru", "Argentina", "Bolivia",
  "Colombia", "Brazil", "Ecuador", "Mexico"
];

const ALL_COUNTRIES = [
  "Afghanistan","Albania","Algeria","Andorra","Angola","Antigua and Barbuda",
  "Argentina","Armenia","Australia","Austria","Azerbaijan","Bahamas","Bahrain",
  "Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan","Bolivia",
  "Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso",
  "Burundi","Cabo Verde","Cambodia","Cameroon","Canada","Central African Republic",
  "Chad","Chile","China","Colombia","Comoros","Congo","Costa Rica","Croatia","Cuba",
  "Cyprus","Czech Republic","Denmark","Djibouti","Dominica","Dominican Republic",
  "Ecuador","Egypt","El Salvador","Equatorial Guinea","Eritrea","Estonia","Eswatini",
  "Ethiopia","Fiji","Finland","France","Gabon","Gambia","Georgia","Germany","Ghana",
  "Greece","Grenada","Guatemala","Guinea","Guinea-Bissau","Guyana","Haiti","Honduras",
  "Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy",
  "Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kiribati","Kuwait","Kyrgyzstan",
  "Laos","Latvia","Lebanon","Lesotho","Liberia","Libya","Liechtenstein","Lithuania",
  "Luxembourg","Madagascar","Malawi","Malaysia","Maldives","Mali","Malta","Marshall Islands",
  "Mauritania","Mauritius","Mexico","Micronesia","Moldova","Monaco","Mongolia","Montenegro",
  "Morocco","Mozambique","Myanmar","Namibia","Nauru","Nepal","Netherlands","New Zealand",
  "Nicaragua","Niger","Nigeria","North Korea","North Macedonia","Norway","Oman","Pakistan",
  "Palau","Palestine","Panama","Papua New Guinea","Paraguay","Peru","Philippines","Poland",
  "Portugal","Qatar","Romania","Russia","Rwanda","Saint Kitts and Nevis","Saint Lucia",
  "Saint Vincent and the Grenadines","Samoa","San Marino","Sao Tome and Principe",
  "Saudi Arabia","Senegal","Serbia","Seychelles","Sierra Leone","Singapore","Slovakia",
  "Slovenia","Solomon Islands","Somalia","South Africa","South Korea","South Sudan","Spain",
  "Sri Lanka","Sudan","Suriname","Sweden","Switzerland","Syria","Taiwan","Tajikistan",
  "Tanzania","Thailand","Timor-Leste","Togo","Tonga","Trinidad and Tobago","Tunisia",
  "Turkey","Turkmenistan","Tuvalu","Uganda","Ukraine","United Arab Emirates",
  "United Kingdom","United States","Uruguay","Uzbekistan","Vanuatu","Vatican City",
  "Venezuela","Vietnam","Yemen","Zambia","Zimbabwe"
];

const OTHER_COUNTRIES = ALL_COUNTRIES.filter(c => !PRIORITY_COUNTRIES.includes(c)).sort();
const COUNTRY_OPTIONS = [...PRIORITY_COUNTRIES, "---", ...OTHER_COUNTRIES];

const INITIAL_CONTACT = { name: "", email: "", phone: "" };

const INITIAL_FORM = {
  name: "",
  type: "international",
  country: "",
  billing_street: "",
  billing_city: "",
  billing_state: "",
  billing_postal_code: "",
  shipping_street: "",
  shipping_city: "",
  shipping_state: "",
  shipping_postal_code: "",
  shipping_country: "",
  primary_contact: { ...INITIAL_CONTACT },
  extra_contacts: [],
};

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => { fetchCustomers(); }, []);

  async function fetchCustomers() {
    setLoading(true);
    const data = await getCustomers();
    setCustomers(data);
    setLoading(false);
  }

  async function handleSubmit() {
    if (!form.name.trim() || !form.country || form.country === "---") return;
    if (!form.primary_contact.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        type: form.type,
        country: form.country,
        billing_street: form.billing_street || null,
        billing_city: form.billing_city || null,
        billing_state: form.billing_state || null,
        billing_postal_code: form.billing_postal_code || null,
        shipping_street: form.shipping_street || null,
        shipping_city: form.shipping_city || null,
        shipping_state: form.shipping_state || null,
        shipping_postal_code: form.shipping_postal_code || null,
        shipping_country: form.shipping_country || null,
        contacts: [
          { ...form.primary_contact, is_primary: true },
          ...form.extra_contacts.map(c => ({ ...c, is_primary: false }))
        ]
      };

      if (editingId) {
        await fetch(`${API}/customers/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch(`${API}/customers/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setForm(INITIAL_FORM);
      setShowForm(false);
      setEditingId(null);
      fetchCustomers();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    await fetch(`${API}/customers/${id}`, { method: "DELETE" });
    setConfirmDelete(null);
    fetchCustomers();
  }

  function addExtraContact() {
    setForm({ ...form, extra_contacts: [...form.extra_contacts, { ...INITIAL_CONTACT }] });
  }

  function updateExtraContact(index, field, value) {
    const updated = [...form.extra_contacts];
    updated[index] = { ...updated[index], [field]: value };
    setForm({ ...form, extra_contacts: updated });
  }

  function removeExtraContact(index) {
    setForm({ ...form, extra_contacts: form.extra_contacts.filter((_, i) => i !== index) });
  }

  const domestic = customers.filter(c => c.type === "domestic");
  const international = customers.filter(c => c.type === "international");

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className={pageTitle}>Customers</h1>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm(INITIAL_FORM); }}
          className={btn.primary}
        >
          + Add Customer
        </button>
      </div>

      {showForm && (
        <div className="border rounded-lg p-6 mb-8 bg-white shadow-sm">
          <h2 className="font-bold uppercase text-sm mb-4">
            {editingId ? "Edit Customer" : "New Customer"}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs uppercase font-semibold text-gray-500">Name *</label>
              <input
                className="w-full border rounded px-3 py-2 mt-1"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs uppercase font-semibold text-gray-500">Type *</label>
              <select
                className="w-full border rounded px-3 py-2 mt-1"
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value })}
              >
                <option value="international">International</option>
                <option value="domestic">Domestic</option>
              </select>
            </div>
            <div>
              <label className="text-xs uppercase font-semibold text-gray-500">Billing Country *</label>
              <select
                className="w-full border rounded px-3 py-2 mt-1"
                value={form.country}
                onChange={e => setForm({ ...form, country: e.target.value })}
              >
                <option value="">Select country...</option>
                {COUNTRY_OPTIONS.map((c, i) =>
                  c === "---"
                    ? <option key="sep" disabled>──────────</option>
                    : <option key={i} value={c}>{c}</option>
                )}
              </select>
            </div>
          </div>

          {/* Billing Address */}
          <div className="mt-6">
            <p className="text-xs uppercase font-semibold text-gray-500 mb-3">Billing Address</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs text-gray-400">Street</label>
                <input className="w-full border rounded px-3 py-2 mt-1" value={form.billing_street} onChange={e => setForm({ ...form, billing_street: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-400">City</label>
                <input className="w-full border rounded px-3 py-2 mt-1" value={form.billing_city} onChange={e => setForm({ ...form, billing_city: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-400">State / Province</label>
                <input className="w-full border rounded px-3 py-2 mt-1" value={form.billing_state} onChange={e => setForm({ ...form, billing_state: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-400">Postal Code</label>
                <input className="w-full border rounded px-3 py-2 mt-1" value={form.billing_postal_code} onChange={e => setForm({ ...form, billing_postal_code: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Shipping Address */}
          <div className="mt-6">
            <p className="text-xs uppercase font-semibold text-gray-500 mb-3">Shipping Address</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs text-gray-400">Street</label>
                <input className="w-full border rounded px-3 py-2 mt-1" value={form.shipping_street} onChange={e => setForm({ ...form, shipping_street: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-400">City</label>
                <input className="w-full border rounded px-3 py-2 mt-1" value={form.shipping_city} onChange={e => setForm({ ...form, shipping_city: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-400">State / Province</label>
                <input className="w-full border rounded px-3 py-2 mt-1" value={form.shipping_state} onChange={e => setForm({ ...form, shipping_state: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-400">Postal Code</label>
                <input className="w-full border rounded px-3 py-2 mt-1" value={form.billing_postal_code} onChange={e => setForm({ ...form, billing_postal_code: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-400">Country</label>
                <select
                  className="w-full border rounded px-3 py-2 mt-1"
                  value={form.shipping_country}
                  onChange={e => setForm({ ...form, shipping_country: e.target.value })}
                >
                  <option value="">Same as billing...</option>
                  {COUNTRY_OPTIONS.map((c, i) =>
                    c === "---"
                      ? <option key="sep" disabled>──────────</option>
                      : <option key={i} value={c}>{c}</option>
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* Primary contact */}
          <div className="mt-6">
            <p className="text-xs uppercase font-semibold text-gray-500 mb-3">Primary Contact *</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-gray-400">Name</label>
                <input
                  className="w-full border rounded px-3 py-2 mt-1"
                  value={form.primary_contact.name}
                  onChange={e => setForm({ ...form, primary_contact: { ...form.primary_contact, name: e.target.value } })}
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Email</label>
                <input
                  className="w-full border rounded px-3 py-2 mt-1"
                  value={form.primary_contact.email}
                  onChange={e => setForm({ ...form, primary_contact: { ...form.primary_contact, email: e.target.value } })}
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Phone</label>
                <input
                  className="w-full border rounded px-3 py-2 mt-1"
                  value={form.primary_contact.phone}
                  onChange={e => setForm({ ...form, primary_contact: { ...form.primary_contact, phone: e.target.value } })}
                />
              </div>
            </div>
          </div>

          {/* Extra contacts */}
          {form.extra_contacts.map((contact, i) => (
            <div key={i} className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs uppercase font-semibold text-gray-400">Contact {i + 2}</p>
                <button onClick={() => removeExtraContact(i)} className="text-xs text-srg-red hover:underline">Remove</button>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-gray-400">Name</label>
                  <input
                    className="w-full border rounded px-3 py-2 mt-1"
                    value={contact.name}
                    onChange={e => updateExtraContact(i, "name", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Email</label>
                  <input
                    className="w-full border rounded px-3 py-2 mt-1"
                    value={contact.email}
                    onChange={e => updateExtraContact(i, "email", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Phone</label>
                  <input
                    className="w-full border rounded px-3 py-2 mt-1"
                    value={contact.phone}
                    onChange={e => updateExtraContact(i, "phone", e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={addExtraContact}
            className="mt-4 text-xs text-srg-yellow hover:underline uppercase font-semibold"
          >
            + Add Another Contact
          </button>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleSubmit}
              disabled={saving || !form.name.trim() || !form.country || form.country === "---" || !form.primary_contact.name.trim()}
              className={btn.primary}
            >
              {saving ? "Saving..." : editingId ? "Save Changes" : "Create"}
            </button>
            <button
              onClick={() => { setShowForm(false); setEditingId(null); setForm(INITIAL_FORM); }}
              className={btn.secondary}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : (
        <>
          <CustomerGroup title="International" customers={international} onEdit={() => {}} onDelete={id => setConfirmDelete(id)} />
          <CustomerGroup title="Domestic" customers={domestic} onEdit={() => {}} onDelete={id => setConfirmDelete(id)} />
        </>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-80 shadow-xl">
            <p className="font-semibold mb-4">Delete this customer?</p>
            <p className="text-sm text-gray-500 mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(confirmDelete)} className={btn.destructive}>Delete</button>
              <button onClick={() => setConfirmDelete(null)} className={btn.secondary}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerGroup({ title, customers, onEdit, onDelete }) {
  if (customers.length === 0) return null;
  return (
    <div className="mb-8">
      <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
        {title} — {customers.length}
      </h2>
      <div className={table.wrapper}>
        <table className={table.base}>
          <thead>
            <tr className={table.head}>
              <th className={table.th}>Name</th>
              <th className={table.th}>Country</th>
              <th className={table.th}>Primary Contact</th>
              <th className={table.th}>Email</th>
              <th className={table.th}>Phone</th>
              <th className={table.th}></th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => {
              const primary = c.contacts?.find(ct => ct.is_primary) || {};
              return (
                <tr key={c.id} className={table.row}>
                  <td className={table.td}>
                    <a href={`/customers/${c.id}`} className="hover:underline text-srg-black">{c.name}</a>
                  </td>
                  <td className={`${table.td} text-gray-600`}>{c.country}</td>
                  <td className={`${table.td} text-gray-600`}>{primary.name || "—"}</td>
                  <td className={`${table.td} text-gray-600`}>{primary.email || "—"}</td>
                  <td className={`${table.td} text-gray-600`}>{primary.phone || "—"}</td>
                  <td className={`${table.td} text-right`}>
                    <button onClick={() => onDelete(c.id)} className="text-xs text-srg-red hover:underline">Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
