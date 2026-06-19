import { btn } from "../styles";
import { useTranslation } from "react-i18next";
import { COUNTRY_OPTIONS, INITIAL_CONTACT } from "./customerFormHelpers";

export default function CustomerForm({ form, setForm, saving, isEditing, onSubmit, onCancel }) {
  const { t } = useTranslation();

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
        {isEditing ? t('customerForm.editCustomer') : t('customerForm.newCustomer')}
      </h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="text-xs uppercase font-semibold text-gray-500">{t('customerForm.name')}</label>
          <input
            className="w-full border rounded px-3 py-2 mt-1"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs uppercase font-semibold text-gray-500">{t('customerForm.type')}</label>
          <select
            className="w-full border rounded px-3 py-2 mt-1"
            value={form.type}
            onChange={e => setForm({ ...form, type: e.target.value })}
          >
            <option value="international">{t('customerForm.international')}</option>
            <option value="domestic">{t('customerForm.domestic')}</option>
          </select>
        </div>
        <div>
          <label className="text-xs uppercase font-semibold text-gray-500">{t('customerForm.billingCountry')}</label>
          <select
            className="w-full border rounded px-3 py-2 mt-1"
            value={form.country}
            onChange={e => setForm({ ...form, country: e.target.value })}
          >
            <option value="">{t('customerForm.selectCountry')}</option>
            {COUNTRY_OPTIONS.map((c, i) =>
              c === "---"
                ? <option key={`sep-${i}`} disabled>----------</option>
                : <option key={i} value={c}>{c}</option>
            )}
          </select>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-xs uppercase font-semibold text-gray-500 mb-3">{t('customerForm.billingAddress')}</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-xs text-gray-400">{t('customerForm.street')}</label>
            <input className="w-full border rounded px-3 py-2 mt-1" value={form.billing_street} onChange={e => setForm({ ...form, billing_street: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-gray-400">{t('customerForm.city')}</label>
            <input className="w-full border rounded px-3 py-2 mt-1" value={form.billing_city} onChange={e => setForm({ ...form, billing_city: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-gray-400">{t('customerForm.stateProvince')}</label>
            <input className="w-full border rounded px-3 py-2 mt-1" value={form.billing_state} onChange={e => setForm({ ...form, billing_state: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-gray-400">{t('customerForm.postalCode')}</label>
            <input className="w-full border rounded px-3 py-2 mt-1" value={form.billing_postal_code} onChange={e => setForm({ ...form, billing_postal_code: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-xs uppercase font-semibold text-gray-500 mb-3">{t('customerForm.shippingAddress')}</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-xs text-gray-400">{t('customerForm.street')}</label>
            <input className="w-full border rounded px-3 py-2 mt-1" value={form.shipping_street} onChange={e => setForm({ ...form, shipping_street: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-gray-400">{t('customerForm.city')}</label>
            <input className="w-full border rounded px-3 py-2 mt-1" value={form.shipping_city} onChange={e => setForm({ ...form, shipping_city: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-gray-400">{t('customerForm.stateProvince')}</label>
            <input className="w-full border rounded px-3 py-2 mt-1" value={form.shipping_state} onChange={e => setForm({ ...form, shipping_state: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-gray-400">{t('customerForm.postalCode')}</label>
            <input className="w-full border rounded px-3 py-2 mt-1" value={form.shipping_postal_code} onChange={e => setForm({ ...form, shipping_postal_code: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-gray-400">{t('customerForm.country')}</label>
            <select
              className="w-full border rounded px-3 py-2 mt-1"
              value={form.shipping_country}
              onChange={e => setForm({ ...form, shipping_country: e.target.value })}
            >
              <option value="">{t('customerForm.sameAsBilling')}</option>
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
        <p className="text-xs uppercase font-semibold text-gray-500 mb-3">{t('customerForm.primaryContact')}</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-400">{t('customerForm.contactName')}</label>
            <input
              className="w-full border rounded px-3 py-2 mt-1"
              value={form.primary_contact.name}
              onChange={e => setForm({ ...form, primary_contact: { ...form.primary_contact, name: e.target.value } })}
            />
          </div>
          <div>
            <label className="text-xs text-gray-400">{t('customerForm.contactEmail')}</label>
            <input
              className="w-full border rounded px-3 py-2 mt-1"
              value={form.primary_contact.email}
              onChange={e => setForm({ ...form, primary_contact: { ...form.primary_contact, email: e.target.value } })}
            />
          </div>
          <div>
            <label className="text-xs text-gray-400">{t('customerForm.contactPhone')}</label>
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
            <p className="text-xs uppercase font-semibold text-gray-400">{t('customerForm.contactN', { n: i + 2 })}</p>
            <button onClick={() => removeExtraContact(i)} className="text-xs text-srg-red hover:underline">{t('customerForm.remove')}</button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-400">{t('customerForm.contactName')}</label>
              <input
                className="w-full border rounded px-3 py-2 mt-1"
                value={contact.name}
                onChange={e => updateExtraContact(i, "name", e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">{t('customerForm.contactEmail')}</label>
              <input
                className="w-full border rounded px-3 py-2 mt-1"
                value={contact.email}
                onChange={e => updateExtraContact(i, "email", e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">{t('customerForm.contactPhone')}</label>
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
        {t('customerForm.addContact')}
      </button>

      <div className="flex gap-3 mt-6">
        <button
          onClick={onSubmit}
          disabled={saving || !form.name.trim() || !form.country || form.country === "---" || !form.primary_contact.name.trim()}
          className={btn.primary}
        >
          {saving ? t('customerForm.saving') : isEditing ? t('customerForm.saveChanges') : t('customerForm.create')}
        </button>
        <button onClick={onCancel} className={btn.secondary}>
          {t('customerForm.cancel')}
        </button>
      </div>
    </div>
  );
}
