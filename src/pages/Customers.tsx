import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Search, Plus, Users, Phone, Mail, Edit, Trash2, ChevronDown, X } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Pagination } from '../components/ui/Pagination';
import { SortButton } from '../components/ui/SortButton';
import { ViewToggle } from '../components/ui/ViewToggle';
import { DeleteConfirmationModal } from '../components/modals/DeleteConfirmationModal';
import { CustomerFormModal } from '../components/modals/CustomerFormModal';

interface Customer {
  id: string; name: string; phone: string | null; email: string | null; nic: string | null;
  address: string | null; notes: string | null; creditLimit: string; creditBalance: string;
  isActive: boolean; createdAt: string;
}

const Customers: React.FC = () => {
  const { theme } = useTheme();
  const { can } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [sortBy, setSortBy] = useState('name-asc');
  const [showFilters, setShowFilters] = useState(false);
  const [creditFilter, setCreditFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadCustomers = useCallback(async () => {
    try {
      const r = await api.get('/customers');
      setCustomers(r.data.data || []);
    } catch { toast.error('Failed to load customers'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const filtered = useMemo(() => {
    let items = customers.filter(c => c.isActive);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(c => c.name.toLowerCase().includes(q) || c.phone?.includes(q) || c.email?.toLowerCase().includes(q) || c.nic?.includes(q));
    }
    if (creditFilter === 'has-credit') items = items.filter(c => Number(c.creditBalance) > 0);
    if (creditFilter === 'no-credit') items = items.filter(c => Number(c.creditBalance) === 0);

    const [field, dir] = sortBy.split('-');
    items.sort((a, b) => {
      let cmp = 0;
      if (field === 'name') cmp = a.name.localeCompare(b.name);
      else if (field === 'credit') cmp = Number(a.creditBalance) - Number(b.creditBalance);
      else if (field === 'date') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return dir === 'desc' ? -cmp : cmp;
    });
    return items;
  }, [customers, search, sortBy, creditFilter]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [search, creditFilter, sortBy]);

  const activeFilters = [creditFilter !== 'all' ? 1 : 0].reduce((a, b) => a + b, 0);

  const openCreate = () => {
    setEditingCustomer(null);
    setShowModal(true);
  };

  const openEdit = (c: Customer) => {
    setEditingCustomer(c);
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/customers/${deleteTarget.id}`);
      toast.success('Customer deleted');
      setDeleteTarget(null);
      loadCustomers();
    } catch (err: unknown) { toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to delete customer'); }
    finally { setDeleting(false); }
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className={`text-2xl lg:text-3xl font-bold flex items-center gap-3 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Users className="w-6 h-6 text-white" />
            </div>
            Customers
          </h1>
          <p className={`mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Manage your customer database</p>
        </div>
        {can('createCustomers') && <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium shadow-lg hover:shadow-emerald-500/25 transition-all">
          <Plus className="w-5 h-5" /> Add Customer
        </button>}
      </div>

      {/* Toolbar */}
      <div className={`rounded-2xl border p-4 ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
            <input type="text" placeholder="Search by name, phone, email, NIC..." value={search} onChange={e => setSearch(e.target.value)}
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
          {activeFilters > 0 && (
            <button onClick={() => setCreditFilter('all')}
              className="text-xs text-red-400 hover:text-red-300 whitespace-nowrap">Clear</button>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <SortButton value={sortBy} onChange={setSortBy} options={[
              { value: 'name-asc', label: 'Name A → Z' }, { value: 'name-desc', label: 'Name Z → A' },
              { value: 'credit-desc', label: 'Credit High → Low' }, { value: 'credit-asc', label: 'Credit Low → High' },
              { value: 'date-desc', label: 'Newest First' }, { value: 'date-asc', label: 'Oldest First' },
            ]} />
            <ViewToggle mode={viewMode} onChange={setViewMode} />
          </div>
        </div>
        {showFilters && (
          <div className={`mt-4 pt-4 border-t flex flex-wrap gap-3 ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
            <select value={creditFilter} onChange={e => setCreditFilter(e.target.value)}
              className={`px-3 py-2 rounded-xl border text-sm ${
                theme === 'dark' ? 'bg-slate-800/50 border-slate-700/50 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`}>
              <option value="all">All Customers</option>
              <option value="has-credit">Has Outstanding Credit</option>
              <option value="no-credit">No Outstanding Credit</option>
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
            <Users className={`w-8 h-8 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`} />
          </div>
          <h3 className={`text-lg font-semibold mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
            {search ? 'No matching customers' : 'No customers yet'}
          </h3>
          <p className={`text-sm max-w-sm mx-auto ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
            {search
              ? 'Try adjusting your search to find what you\'re looking for.'
              : 'Start building your customer base by adding your first customer.'}
          </p>
          {!search && can('createCustomers') && (
            <button onClick={() => { setEditingCustomer(null); setShowModal(true); }} className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium text-sm hover:shadow-lg hover:shadow-emerald-500/25 transition-all">
              <Plus className="w-4 h-4" /> Add Customer
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {paginated.map(c => (
            <div key={c.id} className={`rounded-2xl border p-5 transition-all hover:shadow-lg group ${
              theme === 'dark' ? 'bg-slate-800/30 border-slate-700/50 hover:border-slate-600' : 'bg-white border-slate-200 shadow-sm hover:shadow-md'
            }`}>
              <div className="flex items-start justify-between mb-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold ${
                  theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                }`}>{c.name.charAt(0).toUpperCase()}</div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {can('editCustomers') && <button onClick={() => openEdit(c)} className={`p-1.5 rounded-lg ${theme === 'dark' ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
                    <Edit className="w-4 h-4" />
                  </button>}
                  {can('deleteCustomers') && <button onClick={() => setDeleteTarget(c)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>}
                </div>
              </div>
              <h3 className={`font-semibold truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{c.name}</h3>
              {c.phone && <p className={`text-sm flex items-center gap-1.5 mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}><Phone className="w-3.5 h-3.5" /> {c.phone}</p>}
              {c.email && <p className={`text-sm flex items-center gap-1.5 mt-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}><Mail className="w-3.5 h-3.5" /> {c.email}</p>}
              {Number(c.creditBalance) > 0 && (
                <div className={`mt-3 px-3 py-2 rounded-xl text-sm ${theme === 'dark' ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
                  <span className="text-red-400 font-medium">Credit: {formatCurrency(Number(c.creditBalance))}</span>
                  <span className={`text-xs block ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Limit: {formatCurrency(Number(c.creditLimit))}</span>
                </div>
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
                  {['Name', 'Phone', 'Email', 'NIC', 'Credit Balance', 'Credit Limit', 'Actions'].map(h => (
                    <th key={h} className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y ${theme === 'dark' ? 'divide-slate-700/50' : 'divide-slate-200'}`}>
                {paginated.map(c => (
                  <tr key={c.id} className={`transition-colors ${theme === 'dark' ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'}`}>
                    <td className={`px-4 py-3 font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{c.name}</td>
                    <td className={`px-4 py-3 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{c.phone || '-'}</td>
                    <td className={`px-4 py-3 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{c.email || '-'}</td>
                    <td className={`px-4 py-3 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{c.nic || '-'}</td>
                    <td className={`px-4 py-3 font-medium ${Number(c.creditBalance) > 0 ? 'text-red-400' : theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                      {formatCurrency(Number(c.creditBalance))}
                    </td>
                    <td className={`px-4 py-3 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{formatCurrency(Number(c.creditLimit))}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {can('editCustomers') && <button onClick={() => openEdit(c)} className={`p-1.5 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
                          <Edit className="w-4 h-4" />
                        </button>}
                        {can('deleteCustomers') && <button onClick={() => setDeleteTarget(c)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400">
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

      <CustomerFormModal isOpen={showModal} onClose={() => setShowModal(false)}
        editCustomer={editingCustomer} onCustomerSaved={() => { setShowModal(false); loadCustomers(); }} />

      <DeleteConfirmationModal isOpen={!!deleteTarget} title="Delete Customer"
        message="Are you sure you want to delete this customer? This action cannot be undone."
        itemName={deleteTarget?.name} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} isLoading={deleting} />
    </div>
  );
};
export default Customers;
