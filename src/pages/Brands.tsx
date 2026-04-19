import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Building, Plus, Edit, Trash2, Search, X } from 'lucide-react';
import { Pagination } from '../components/ui/Pagination';
import { ViewToggle, type ViewMode } from '../components/ui/ViewToggle';
import { SortButton } from '../components/ui/SortButton';
import { DeleteConfirmationModal } from '../components/modals/DeleteConfirmationModal';
import api from '../lib/api';
import toast from 'react-hot-toast';

interface Brand { id: string; name: string; description: string | null; _count: { products: number }; }

const Brands: React.FC = () => {
  const { theme } = useTheme();
  const { can } = useAuth();
  const [items, setItems] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Brand | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState('name-asc');
  const [deleteTarget, setDeleteTarget] = useState<Brand | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try { const r = await api.get('/brands'); setItems(r.data.data || []); }
    catch { toast.error('Failed to load'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditItem(null); setName(''); setDescription(''); setModalOpen(true); };
  const openEdit = (b: Brand) => { setEditItem(b); setName(b.name); setDescription(b.description || ''); setModalOpen(true); };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      if (editItem) { await api.put(`/brands/${editItem.id}`, { name, description: description || null }); toast.success('Updated'); }
      else { await api.post('/brands', { name, description: description || null }); toast.success('Created'); }
      setModalOpen(false); load();
    } catch (err: unknown) { toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try { await api.delete(`/brands/${deleteTarget.id}`); toast.success('Deleted'); setDeleteTarget(null); load(); }
    catch (err: unknown) { toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed'); }
    finally { setDeleting(false); }
  };

  const filtered = useMemo(() => {
    const result = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
    return result.sort((a, b) => {
      switch (sortBy) {
        case 'name-asc': return a.name.localeCompare(b.name);
        case 'name-desc': return b.name.localeCompare(a.name);
        case 'products-desc': return b._count.products - a._count.products;
        case 'products-asc': return a._count.products - b._count.products;
        default: return 0;
      }
    });
  }, [items, search, sortBy]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  useEffect(() => { setCurrentPage(1); }, [search]);

  return (
    <div className="space-y-4 pb-8">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className={`text-2xl lg:text-3xl font-bold flex items-center gap-3 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Building className="w-6 h-6 text-white" />
            </div>
            Brands
          </h1>
          <p className={`mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Manage product brands</p>
        </div>
        {can('editBrands') && <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium shadow-lg hover:shadow-emerald-500/25 transition-all">
            <Plus className="w-5 h-5" /> Add Brand
          </button>}
      </div>

      <div className={`rounded-2xl border p-4 ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
            <input type="text" placeholder="Search brands..." value={search} onChange={e => setSearch(e.target.value)}
              className={`w-full pl-10 ${search ? 'pr-9' : 'pr-4'} py-2.5 rounded-xl border transition-all outline-none ${
                theme === 'dark' ? 'bg-slate-800/50 border-slate-700/50 text-white placeholder-slate-500 focus:border-emerald-500/50' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500'
              }`} />
            {search && <button onClick={() => setSearch('')} className={`absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full transition-colors ${theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'}`}><X className="w-3.5 h-3.5" /></button>}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <SortButton
              options={[
                { value: 'name-asc', label: 'Name A → Z' },
                { value: 'name-desc', label: 'Name Z → A' },
                { value: 'products-desc', label: 'Most Products' },
                { value: 'products-asc', label: 'Least Products' },
              ]}
              value={sortBy}
              onChange={setSortBy}
            />
            <ViewToggle mode={viewMode} onChange={setViewMode} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className={`text-center py-16 rounded-2xl border ${theme === 'dark' ? 'bg-slate-800/20 border-slate-700/50' : 'bg-white border-slate-200'}`}>
          <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-100'}`}>
            <Building className={`w-8 h-8 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`} />
          </div>
          <h3 className={`text-lg font-semibold mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
            {search ? 'No matching brands' : 'No brands yet'}
          </h3>
          <p className={`text-sm max-w-sm mx-auto ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
            {search
              ? 'Try adjusting your search to find what you\'re looking for.'
              : 'Create your first brand to organize your products.'}
          </p>
          {!search && can('editBrands') && (
            <button onClick={openCreate} className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium text-sm hover:shadow-lg hover:shadow-emerald-500/25 transition-all">
              <Plus className="w-4 h-4" /> Add Brand
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginated.map(b => (
              <div key={b.id} className={`rounded-2xl border p-5 transition-all hover:scale-[1.02] ${
                theme === 'dark' ? 'bg-slate-800/30 border-slate-700/50 hover:border-slate-600' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <Building className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex items-center gap-1">
                    {can('editBrands') && <button onClick={() => openEdit(b)} className={`p-1.5 rounded-lg ${theme === 'dark' ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}>
                      <Edit className="w-4 h-4" />
                    </button>}
                    {can('deleteBrands') && <button onClick={() => setDeleteTarget(b)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </button>}
                  </div>
                </div>
                <h3 className={`mt-3 font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{b.name}</h3>
                {b.description && <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{b.description}</p>}
                <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{b._count.products} products</p>
              </div>
            ))}
          </div>
          <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize}
            onPageChange={setCurrentPage} onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }} />
        </>
      ) : (
        <div className={`rounded-2xl border overflow-hidden ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'}>
                <tr>
                  {['Brand', 'Description', 'Products', 'Actions'].map(h => (
                    <th key={h} className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y ${theme === 'dark' ? 'divide-slate-700/50' : 'divide-slate-200'}`}>
                {paginated.map(b => (
                  <tr key={b.id} className={theme === 'dark' ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                          <Building className="w-4 h-4 text-white" />
                        </div>
                        <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{b.name}</span>
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{b.description || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        theme === 'dark' ? 'bg-slate-700/50 text-slate-300' : 'bg-slate-100 text-slate-600'
                      }`}>{b._count.products}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {can('editBrands') && <button onClick={() => openEdit(b)} className={`p-1.5 rounded-lg ${theme === 'dark' ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}><Edit className="w-4 h-4" /></button>}
                        {can('deleteBrands') && <button onClick={() => setDeleteTarget(b)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400"><Trash2 className="w-4 h-4" /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={`border-t ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
            <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize}
              onPageChange={setCurrentPage} onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }} />
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl border p-6 ${theme === 'dark' ? 'bg-slate-900 border-slate-700/50' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{editItem ? 'Edit' : 'Add'} Brand</h2>
              <button onClick={() => setModalOpen(false)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Samsung"
                  className={`w-full px-4 py-2.5 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700/50 text-white placeholder-slate-500' : 'bg-white border-slate-200'}`} />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                  className={`w-full px-4 py-2.5 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700/50 text-white placeholder-slate-500' : 'bg-white border-slate-200'}`} />
              </div>
            </div>
            <div className={`flex justify-end gap-3 mt-6 pt-4 border-t ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
              <button onClick={() => setModalOpen(false)} className={`px-4 py-2 rounded-xl ${theme === 'dark' ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'}`}>Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium disabled:opacity-50">
                {saving ? 'Saving...' : editItem ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmationModal isOpen={!!deleteTarget} title="Delete Brand"
        message="Are you sure you want to delete this brand? Products with this brand will have no brand."
        itemName={deleteTarget?.name} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} isLoading={deleting} />
    </div>
  );
};
export default Brands;
