import { btn } from "../styles";

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

export const INITIAL_CONTACT = { name: "", email: "", phone: "" };

export const INITIAL_FORM = {
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

export function customerToForm(customer) {
  const contacts = Array.isArray(customer?.contacts) ? customer.contacts : [];
  const primaryIndex = contacts.findIndex(c => c.is_primary);
  const selectedPrimaryIndex = primaryIndex >= 0 ? primaryIndex : 0;
  const primary = contacts[selectedPrimaryIndex] || INITIAL_CONTACT;

  return {
    name: customer?.name || "",
    type: customer?.type || "international",
    country: customer?.country || "",
    billing_street: customer?.billing_street || "",
    billing_city: customer?.billing_city || "",
    billing_state: customer?.billing_state || "",
    billing_postal_code: customer?.billing_postal_code || "",
    shipping_street: customer?.shipping_street || "",
    shipping_city: customer?.shipping_city || "",
    shipping_state: customer?.shipping_state || "",
    shipping_postal_code: customer?.shipping_postal_code || "",
    shipping_country: customer?.shipping_country || "",
    primary_contact: {
      name: primary.name || "",
      email: primary.email || "",
      phone: primary.phone || "",
    },
    extra_contacts: contacts
      .filter((_, index) => index !== selectedPrimaryIndex)
      .map(contact => ({
        name: contact.name || "",
        email: contact.email || "",
        phone: contact.phone || "",
      })),
  };
}

export function formToPayload(form) {
  return {
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
}

export default function CustomerForm({ form, setForm, saving, isEditing, onSubmit, onCancel }) {
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

  return (
    <div className="border rounded-lg p-6 mb-8 bg-white shadow-sm">
      <h2 className="font-bold uppercase text-sm mb-4">
        {isEditing ? "Edit Customer" : "New Customer"}
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
                ? <option key={`sep-${i}`} disabled>----------</option>
                : <option key={i} value={c}>{c}</option>
            )}
          </select>
        </div>
      </div>

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
            <input className="w-full border rounded px-3 py-2 mt-1" value={form.shipping_postal_code} onChange={e => setForm({ ...form, shipping_postal_code: e.target.value })} />
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
                  ? <option key={`sep-${i}`} disabled>----------</option>
                  : <option key={i} value={c}>{c}</option>
              )}
            </select>
          </div>
        </div>
      </div>

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
          onClick={onSubmit}
          disabled={saving || !form.name.trim() || !form.country || form.country === "---" || !form.primary_contact.name.trim()}
          className={btn.primary}
        >
          {saving ? "Saving..." : isEditing ? "Save Changes" : "Create"}
        </button>
        <button onClick={onCancel} className={btn.secondary}>
          Cancel
        </button>
      </div>
    </div>
  );
}
