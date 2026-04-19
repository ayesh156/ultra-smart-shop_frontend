import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { X, UserPlus, Save, Loader2 } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

interface QuickAddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerCreated: (customer: { id: string; name: string; phone: string | null; email: string | null; }) => void;
  initialName?: string;
  initialPhone?: string;
}

export const QuickAddCustomerModal: React.FC<QuickAddCustomerModalProps> = ({ isOpen, onClose, onCustomerCreated, initialName = '', initialPhone = '' }) => {
  const { theme } = useTheme();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', nic: '', address: '', creditLimit: '0' });

  useEffect(() => {
    if (isOpen) {
      setForm(f => ({ ...f, name: initialName, phone: initialPhone }));
    }
  }, [isOpen, initialName, initialPhone]);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Customer name is required'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name, phone: form.phone || null, email: form.email || null,
        nic: form.nic || null, address: form.address || null,
        creditLimit: Number(form.creditLimit) || 0,
      };
      const r = await api.post('/customers', payload);
      const created = r.data.data;
      toast.success(`${created.name} saved!`);
      onCustomerCreated(created);
      setForm({ name: '', phone: '', email: '', nic: '', address: '', creditLimit: '0' });
      onClose();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create customer');
    } finally { setSaving(false); }
  };

  if (!isOpen) return null;

  const inputClass = `w-full px-3 py-2.5 rounded-xl border text-sm transition-all outline-none ${
    theme === 'dark' ? 'bg-slate-800/50 border-slate-700/50 text-white placeholder-slate-500 focus:border-emerald-500/50' : 'bg-white border-slate-200 text-slate-900 focus:border-emerald-500'
  }`;
  const labelClass = `block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
         onWheel={e => { if ((e.target as HTMLElement).closest('input[type="number"]')) e.preventDefault(); }}>
      <div className={`relative w-full max-w-md max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl ${
        theme === 'dark' ? 'bg-slate-900 border-slate-700/50' : 'bg-white border-slate-200'
      }`}>
        {/* Header */}
        <div className={`flex-shrink-0 flex items-center justify-between px-5 py-4 border-b ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Quick Add Customer</h2>
              <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Save customer and continue</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className={labelClass}>Customer Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Dilshan Perera" className={inputClass} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Phone</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="077XXXXXXX" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>NIC</label>
              <input value={form.nic} onChange={e => setForm(f => ({ ...f, nic: e.target.value }))} placeholder="200012345678" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Credit Limit</label>
              <input type="number" value={form.creditLimit} onChange={e => setForm(f => ({ ...f, creditLimit: e.target.value }))} placeholder="0" onWheel={e => (e.target as HTMLElement).blur()} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Address</label>
            <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Address (optional)" className={inputClass} />
          </div>
        </div>

        {/* Footer */}
        <div className={`flex-shrink-0 flex items-center justify-end gap-3 px-5 py-4 border-t ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
          <button onClick={onClose} className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            theme === 'dark' ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'
          }`}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-blue-500/25 transition-all disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Customer'}
          </button>
        </div>
      </div>
    </div>
  );
};
