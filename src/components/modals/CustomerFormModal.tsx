import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { X, UserPlus, Save, Loader2, Users } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

interface Customer {
  id: string; name: string; phone: string | null; email: string | null; nic: string | null;
  address: string | null; notes: string | null; creditLimit: string; creditBalance: string;
  isActive: boolean; createdAt: string;
}

interface CustomerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerSaved: (customer: { id: string; name: string; phone: string | null; email: string | null; }) => void;
  editCustomer?: Customer | null;
  initialName?: string;
  initialPhone?: string;
}

export const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  isOpen, onClose, onCustomerSaved, editCustomer = null, initialName = '', initialPhone = '',
}) => {
  const { theme } = useTheme();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', nic: '', address: '', notes: '', creditLimit: '0' });

  useEffect(() => {
    if (isOpen) {
      if (editCustomer) {
        setFormData({
          name: editCustomer.name, phone: editCustomer.phone || '', email: editCustomer.email || '',
          nic: editCustomer.nic || '', address: editCustomer.address || '', notes: editCustomer.notes || '',
          creditLimit: String(editCustomer.creditLimit),
        });
      } else {
        setFormData({ name: initialName, phone: initialPhone, email: '', nic: '', address: '', notes: '', creditLimit: '0' });
      }
    }
  }, [isOpen, editCustomer, initialName, initialPhone]);

  const handleSave = async () => {
    if (!formData.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const payload = { ...formData, creditLimit: Number(formData.creditLimit) || 0 };
      let saved;
      if (editCustomer) {
        const r = await api.put(`/customers/${editCustomer.id}`, payload);
        saved = r.data.data;
        toast.success('Customer updated');
      } else {
        const r = await api.post('/customers', payload);
        saved = r.data.data;
        toast.success(`${saved.name} created!`);
      }
      onCustomerSaved(saved);
      onClose();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save customer');
    } finally { setSaving(false); }
  };

  if (!isOpen) return null;

  const inputClass = `w-full px-4 py-2.5 rounded-xl border transition-all outline-none ${
    theme === 'dark'
      ? 'bg-slate-800/50 border-slate-700/50 text-white placeholder-slate-500 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20'
      : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
  }`;
  const labelClass = `block text-sm font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
         onWheel={e => { if ((e.target as HTMLElement).closest('input[type="number"]')) e.preventDefault(); }}>
      <div className={`rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border ${
        theme === 'dark' ? 'bg-slate-900 border-slate-700/50' : 'bg-white border-slate-200'
      }`}>
        {/* Header */}
        <div className={`flex-shrink-0 flex items-center justify-between px-6 py-4 border-b ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg">
              {editCustomer ? <Users className="w-5 h-5 text-white" /> : <UserPlus className="w-5 h-5 text-white" />}
            </div>
            <div>
              <h2 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {editCustomer ? 'Edit Customer' : 'New Customer'}
              </h2>
              <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                {editCustomer ? 'Update customer details' : 'Add a new customer to your database'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
          <div>
            <label className={labelClass}>Name *</label>
            <input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} className={inputClass} placeholder="Customer name" autoFocus />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Phone</label>
              <input value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} className={inputClass} placeholder="07X XXXXXXX" />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} className={inputClass} placeholder="email@example.com" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>NIC</label>
              <input value={formData.nic} onChange={e => setFormData(p => ({ ...p, nic: e.target.value }))} className={inputClass} placeholder="National ID Card" />
            </div>
            <div>
              <label className={labelClass}>Credit Limit (Rs.)</label>
              <input type="number" value={formData.creditLimit} onChange={e => setFormData(p => ({ ...p, creditLimit: e.target.value }))} onWheel={e => (e.target as HTMLElement).blur()} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Address</label>
            <textarea value={formData.address} onChange={e => setFormData(p => ({ ...p, address: e.target.value }))} className={`${inputClass} resize-none`} rows={2} />
          </div>
          <div>
            <label className={labelClass}>Notes</label>
            <textarea value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} className={`${inputClass} resize-none`} rows={2} />
          </div>
        </div>

        {/* Footer */}
        <div className={`flex-shrink-0 flex justify-end gap-3 px-6 py-4 border-t ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
          <button onClick={onClose} className={`px-4 py-2.5 rounded-xl font-medium ${
            theme === 'dark' ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : editCustomer ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
};
