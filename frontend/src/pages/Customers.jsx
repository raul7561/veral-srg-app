import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { getCustomers } from "../api";
import CustomerForm from "../components/CustomerForm";
import { INITIAL_FORM, formToPayload } from "../components/customerFormHelpers";
import { btn, pageTitle, table } from "../styles";

const API = import.meta.env.VITE_API_URL;

export default function Customers() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
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
      await fetch(`${API}/customers/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formToPayload(form)),
      });
      setForm(INITIAL_FORM);
      setShowForm(false);
      fetchCustomers();
      const returnId = location.state?.returnToConvertQuoteId;
      if (returnId) {
        navigate('/quotes/history', { state: { returnToConvertQuoteId: returnId } });
        return;
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    await fetch(`${API}/customers/${id}`, { method: "DELETE" });
    setConfirmDelete(null);
    fetchCustomers();
  }

  const domestic = customers.filter(c => c.type === "domestic");
  const international = customers.filter(c => c.type === "international");

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className={pageTitle}>{t('customers.title')}</h1>
        <button
          onClick={() => { setShowForm(true); setForm(INITIAL_FORM); }}
          className={btn.primary}
        >
          {t('customers.addCustomer')}
        </button>
      </div>

      {showForm && (
        <CustomerForm
          form={form}
          setForm={setForm}
          saving={saving}
          isEditing={false}
          onSubmit={handleSubmit}
          onCancel={() => { setShowForm(false); setForm(INITIAL_FORM); }}
        />
      )}

      {loading ? (
        <p className="text-gray-400">{t('customers.loading')}</p>
      ) : (
        <>
          <CustomerGroup title={t('customers.international')} customers={international} onDelete={id => setConfirmDelete(id)} />
          <CustomerGroup title={t('customers.domestic')} customers={domestic} onDelete={id => setConfirmDelete(id)} />
        </>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-80 shadow-xl">
            <p className="font-semibold mb-4">{t('customers.deleteCustomerTitle')}</p>
            <p className="text-sm text-gray-500 mb-6">{t('customers.deleteWarning')}</p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(confirmDelete)} className={btn.destructive}>{t('customers.delete')}</button>
              <button onClick={() => setConfirmDelete(null)} className={btn.secondary}>{t('customers.cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerGroup({ title, customers, onDelete }) {
  const { t } = useTranslation();
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
              <th className={table.th}>{t('customers.name')}</th>
              <th className={table.th}>{t('customers.country')}</th>
              <th className={table.th}>{t('customers.primaryContact')}</th>
              <th className={table.th}>{t('customers.email')}</th>
              <th className={table.th}>{t('customers.phone')}</th>
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
                    <button onClick={() => onDelete(c.id)} className="text-xs text-srg-red hover:underline">{t('customers.delete')}</button>
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
