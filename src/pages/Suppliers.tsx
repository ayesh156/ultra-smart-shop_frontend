import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Search, Plus, Truck, Phone, Mail, Edit, Trash2, ChevronDown, X, Clock } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Pagination } from '../components/ui/Pagination';
import { SortButton } from '../components/ui/SortButton';
import { ViewToggle } from '../components/ui/ViewToggle';
import { DeleteConfirmationModal } from '../components/modals/DeleteConfirmationModal';

interface Supplier {
  id: string; name: string; contactName: string | null; phone: string | null;
  email: string | null; address: string | null; notes: string | null;
  paymentTerms: string | null; isActive: boolean; createdAt: string;
}

const Suppliers: React.FC = () => {
  const { theme } = useTheme();
  const { can } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [sortBy, setSortBy] = useState('name-asc');
  const [showFilters, setShowFilters] = useState(false);
  const [termsFilter, setTermsFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({ name: '', contactName: '', phone: '', email: '', address: '', notes: '', paymentTerms: '' });

  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadSuppliers = useCallback(async () => {
    try {
      const r = await api.get('/suppliers');
      setSuppliers(r.data.data || []);
    } catch { toast.error('Failed to load suppliers'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadSuppliers(); }, [loadSuppliers]);

  const paymentTermsOptions = useMemo(() => {
    const terms = new Set(suppliers.filter(s => s.paymentTerms).map(s => s.paymentTerms!));
    return Array.from(terms);
  }, [suppliers]);

  const filtered = useMemo(() => {
    let items = suppliers.filter(s => s.isActive);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(s => s.name.toLowerCase().includes(q) || s.contactName?.toLowerCase().includes(q) || s.phone?.includes(q) || s.email?.toLowerCase().includes(q));
    }
    if (termsFilter !== 'all') items = items.filter(s => s.paymentTerms === termsFilter);

    const [field, dir] = sortBy.split('-');
    items.sort((a, b) => {
      let cmp = 0;
      if (field === 'name') cmp = a.name.localeCompare(b.name);
      else if (field === 'date') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return dir === 'desc' ? -cmp : cmp;
    });
    return items;
  }, [suppliers, search, sortBy, termsFilter]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [search, termsFilter, sortBy]);

  const activeFilters = termsFilter !== 'all' ? 1 : 0;

  const openCreate = () => {
    setEditingSupplier(null);
    setFormData({ name: '', contactName: '', phone: '', email: '', address: '', notes: '', paymentTerms: '' });
    setShowModal(true);
  };

  const openEdit = (s: Supplier) => {
    setEditingSupplier(s);
    setFormData({
      name: s.name, contactName: s.contactName || '', phone: s.phone || '', email: s.email || '',
      address: s.address || '', notes: s.notes || '', paymentTerms: s.paymentTerms || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      if (editingSupplier) {
        await api.put(`/suppliers/${editingSupplier.id}`, formData);
        toast.success('Supplier updated');
      } else {
        await api.post('/suppliers', formData);
        toast.success('Supplier created');
      }
      setShowModal(false);
      loadSuppliers();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/suppliers/${deleteTarget.id}`);
      toast.success('Supplier deleted');
      setDeleteTarget(null);
      loadSuppliers();
    } catch (err: unknown) { toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to delete supplier'); }
    finally { setDeleting(false); }
  };

  const inputClass = `w-full px-4 py-2.5 rounded-xl border transition-all outline-none ${
    theme === 'dark'
      ? 'bg-slate-800/50 border-slate-700/50 text-white placeholder-slate-500 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20'
      : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
  }`;

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className={`text-2xl lg:text-3xl font-bold flex items-center gap-3 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Truck className="w-6 h-6 text-white" />
            </div>
            Suppliers
          </h1>
          <p className={`mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Manage your supplier network</p>
        </div>
        {can('createSuppliers') && <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium shadow-lg hover:shadow-emerald-500/25 transition-all">
          <Plus className="w-5 h-5" /> Add Supplier
        </button>}
      </div>

      {/* Toolbar */}
      <div className={`rounded-2xl border p-4 ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
            <input type="text" placeholder="Search by name, contact, phone, email..." value={search} onChange={e => setSearch(e.target.value)}
              className={`w-full pl-10 ${search ? 'pr-9' : 'pr-4'} py-2.5 rounded-xl border transition-all outline-none ${
                theme === 'dark' ? 'bg-slate-800/50 border-slate-700/50 text-white placeholder-slate-500 focus:border-emerald-500/50' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500'
              }`} />
            {search && <button onClick={() => setSearch('')} className={`absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full transition-colors ${theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'}`}><X className="w-3.5 h-3.5" /></button>}
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all whitespace-nowrap ${
              activeFilters > 0
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : theme === 'dark' ? 'border-slate-700/50 text-slate-400 hover:border-slate-600' : 'border-slate-200 text-slate-600 hover:border-slate-300'
            }`}>
            <Search className="w-4 h-4" /> Filters {activeFilters > 0 && <span className="bg-emerald-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">{activeFilters}</span>}
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
          {activeFilters > 0 && <button onClick={() => setTermsFilter('all')} className="text-xs text-red-400 hover:text-red-300 whitespace-nowrap">Clear</button>}
          <div className="flex items-center gap-2 ml-auto">
            <SortButton value={sortBy} onChange={setSortBy} options={[
              { value: 'name-asc', label: 'Name A → Z' }, { value: 'name-desc', label: 'Name Z → A' },
              { value: 'date-desc', label: 'Newest First' }, { value: 'date-asc', label: 'Oldest First' },
            ]} />
            <ViewToggle mode={viewMode} onChange={setViewMode} />
          </div>
        </div>
        {showFilters && (
          <div className={`mt-4 pt-4 border-t flex flex-wrap gap-3 ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
            <select value={termsFilter} onChange={e => setTermsFilter(e.target.value)}
              className={`px-3 py-2 rounded-xl border text-sm ${
                theme === 'dark' ? 'bg-slate-800/50 border-slate-700/50 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`}>
              <option value="all">All Payment Terms</option>
              {paymentTermsOptions.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className={`text-center py-16 rounded-2xl border ${theme === 'dark' ? 'bg-slate-800/20 border-slate-700/50' : 'bg-white border-slate-200'}`}>
          <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-100'}`}>
            <Truck className={`w-8 h-8 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`} />
          </div>
          <h3 className={`text-lg font-semibold mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
            {search ? 'No matching suppliers' : 'No suppliers yet'}
          </h3>
          <p className={`text-sm max-w-sm mx-auto ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
            {search
              ? 'Try adjusting your search to find what you\'re looking for.'
              : 'Add your first supplier to manage your supply chain.'}
          </p>
          {!search && can('createSuppliers') && (
            <button onClick={openCreate} className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium text-sm hover:shadow-lg hover:shadow-emerald-500/25 transition-all">
              <Plus className="w-4 h-4" /> Add Supplier
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {paginated.map(s => (
            <div key={s.id} className={`rounded-2xl border p-5 transition-all hover:shadow-lg group ${
              theme === 'dark' ? 'bg-slate-800/30 border-slate-700/50 hover:border-slate-600' : 'bg-white border-slate-200 shadow-sm hover:shadow-md'
            }`}>
              <div className="flex items-start justify-between mb-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold ${
                  theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                }`}>{s.name.charAt(0).toUpperCase()}</div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {can('editSuppliers') && <button onClick={() => openEdit(s)} className={`p-1.5 rounded-lg ${theme === 'dark' ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
                    <Edit className="w-4 h-4" />
                  </button>}
                  {can('deleteSuppliers') && <button onClick={() => setDeleteTarget(s)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>}
                </div>
              </div>
              <h3 className={`font-semibold truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{s.name}</h3>
              {s.contactName && <p className={`text-sm mt-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{s.contactName}</p>}
              {s.phone && <p className={`text-sm flex items-center gap-1.5 mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}><Phone className="w-3.5 h-3.5" /> {s.phone}</p>}
              {s.email && <p className={`text-sm flex items-center gap-1.5 mt-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}><Mail className="w-3.5 h-3.5" /> {s.email}</p>}
              {s.paymentTerms && (
                <div className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                  theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}><Clock className="w-3 h-3" /> {s.paymentTerms}</div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className={`rounded-2xl border overflow-hidden ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'}>
                <tr>
                  {['Name', 'Contact Person', 'Phone', 'Email', 'Payment Terms', 'Actions'].map(h => (
                    <th key={h} className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y ${theme === 'dark' ? 'divide-slate-700/50' : 'divide-slate-200'}`}>
                {paginated.map(s => (
                  <tr key={s.id} className={`transition-colors ${theme === 'dark' ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'}`}>
                    <td className={`px-4 py-3 font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{s.name}</td>
                    <td className={`px-4 py-3 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{s.contactName || '-'}</td>
                    <td className={`px-4 py-3 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{s.phone || '-'}</td>
                    <td className={`px-4 py-3 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{s.email || '-'}</td>
                    <td className="px-4 py-3">
                      {s.paymentTerms ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-700'
                        }`}>{s.paymentTerms}</span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {can('editSuppliers') && <button onClick={() => openEdit(s)} className={`p-1.5 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
                          <Edit className="w-4 h-4" />
                        </button>}
                        {can('deleteSuppliers') && <button onClick={() => setDeleteTarget(s)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400">
                          <Trash2 className="w-4 h-4" />
                        </button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage}
        pageSize={pageSize} onPageSizeChange={s => { setPageSize(s); setPage(1); }} totalItems={filtered.length} />

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className={`rounded-2xl max-w-lg w-full shadow-2xl border ${
            theme === 'dark' ? 'bg-slate-900 border-slate-700/50' : 'bg-white border-slate-200'
          }`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
              <h2 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {editingSupplier ? 'Edit Supplier' : 'New Supplier'}
              </h2>
              <button onClick={() => setShowModal(false)} className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Company Name *</label>
                <input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} className={inputClass} placeholder="Supplier company name" />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Contact Person</label>
                <input value={formData.contactName} onChange={e => setFormData(p => ({ ...p, contactName: e.target.value }))} className={inputClass} placeholder="Contact person name" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Phone</label>
                  <input value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} className={inputClass} placeholder="07X XXXXXXX" />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Email</label>
                  <input value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} className={inputClass} placeholder="orders@supplier.lk" />
                </div>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Payment Terms</label>
                <input value={formData.paymentTerms} onChange={e => setFormData(p => ({ ...p, paymentTerms: e.target.value }))} className={inputClass} placeholder="e.g. Net 30, COD, Advance Payment" />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Address</label>
                <textarea value={formData.address} onChange={e => setFormData(p => ({ ...p, address: e.target.value }))} className={`${inputClass} resize-none`} rows={2} />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Notes</label>
                <textarea value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} className={`${inputClass} resize-none`} rows={2} />
              </div>
            </div>
            <div className={`flex justify-end gap-3 px-6 py-4 border-t ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
              <button onClick={() => setShowModal(false)} className={`px-4 py-2.5 rounded-xl font-medium ${
                theme === 'dark' ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}>Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium disabled:opacity-50">
                {saving ? 'Saving...' : editingSupplier ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmationModal isOpen={!!deleteTarget} title="Delete Supplier"
        message="Are you sure you want to delete this supplier? This action cannot be undone."
        itemName={deleteTarget?.name} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} isLoading={deleting} />
    </div>
  );
};
export default Suppliers;
