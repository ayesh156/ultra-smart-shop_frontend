import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Search, Eye, XCircle, Printer, FileText, X, Zap, ShoppingCart, Filter, ChevronDown, RefreshCw } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../lib/utils';
import { Pagination } from '../components/ui/Pagination';
import { SearchableSelect, type SelectOption } from '../components/ui/SearchableSelect';
import { ViewToggle, type ViewMode } from '../components/ui/ViewToggle';
import { SortButton } from '../components/ui/SortButton';
import { DateRangePicker } from '../components/ui/DatePicker';
import { printThermalReceipt } from '../components/ThermalReceipt';
import { DeleteConfirmationModal } from '../components/modals/DeleteConfirmationModal';
import api from '../lib/api';
import toast from 'react-hot-toast';

interface Invoice {
  id: string; invoiceNumber: string; type: string;
  customerName: string | null; customerPhone: string | null;
  subtotal: string; discount: string; total: string;
  paidAmount: string; paymentMethod: string; paymentStatus: string;
  status: string; notes: string | null; createdAt: string;
  user: { name: string };
  items: Array<{ productName: string; quantity: number; unitPrice: string; total: string }>;
}

const Invoices: React.FC = () => {
  const { theme } = useTheme();
  const { shop, can } = useAuth();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [sortBy, setSortBy] = useState('date-desc');
  const [showFilters, setShowFilters] = useState(false);
  const [voidTarget, setVoidTarget] = useState<Invoice | null>(null);
  const [voiding, setVoiding] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set('type', typeFilter);
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      const r = await api.get(`/invoices?${params}`);
      setInvoices(r.data.data || []);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, [typeFilter, dateFrom, dateTo]);
  useEffect(() => { load(); }, [load]);

  const handleVoid = async () => {
    if (!voidTarget) return;
    setVoiding(true);
    try { await api.patch(`/invoices/${voidTarget.id}/void`); toast.success('Invoice voided'); setVoidTarget(null); load(); setSelectedInvoice(null); }
    catch (err: unknown) { toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed'); }
    finally { setVoiding(false); }
  };

  // Filter + search + sort
  const filtered = useMemo(() => {
    let result = invoices;
    if (statusFilter) result = result.filter(i => i.status === statusFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(i =>
        i.invoiceNumber.toLowerCase().includes(s) ||
        i.customerName?.toLowerCase().includes(s) ||
        i.customerPhone?.includes(s)
      );
    }
    return result.sort((a, b) => {
      switch (sortBy) {
        case 'date-asc': return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'date-desc': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'total-asc': return Number(a.total) - Number(b.total);
        case 'total-desc': return Number(b.total) - Number(a.total);
        case 'invoice-asc': return a.invoiceNumber.localeCompare(b.invoiceNumber);
        case 'invoice-desc': return b.invoiceNumber.localeCompare(a.invoiceNumber);
        default: return 0;
      }
    });
  }, [invoices, search, statusFilter, sortBy]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  useEffect(() => { setCurrentPage(1); }, [search, typeFilter, statusFilter, dateFrom, dateTo]);

  // Print invoice receipt
  const handlePrint = async (inv: Invoice) => {
    try {
      await printThermalReceipt({
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customerName,
        customerPhone: inv.customerPhone,
        items: inv.items.map(i => ({ productName: i.productName, quantity: i.quantity, unitPrice: Number(i.unitPrice), total: Number(i.total) })),
        subtotal: Number(inv.subtotal), discount: Number(inv.discount), total: Number(inv.total),
        paidAmount: Number(inv.paidAmount), change: Math.max(0, Number(inv.paidAmount) - Number(inv.total)),
        paymentMethod: inv.paymentMethod, cashierName: inv.user.name, shopName: shop?.name,
        createdAt: inv.createdAt,
      });
    } catch { toast.error('Print failed'); }
  };

  // Summary stats
  const stats = useMemo(() => {
    const completed = filtered.filter(i => i.status === 'COMPLETED');
    return {
      totalSales: completed.length,
      totalRevenue: completed.reduce((s, i) => s + Number(i.total), 0),
      totalVoid: filtered.filter(i => i.status === 'VOID').length,
    };
  }, [filtered]);

  const clearFilters = () => {
    setTypeFilter(''); setStatusFilter(''); setDateFrom(''); setDateTo('');
  };

  const hasFilters = typeFilter || statusFilter || dateFrom || dateTo;
  const activeFilterCount = [typeFilter, statusFilter, dateFrom || dateTo ? 'date' : ''].filter(Boolean).length;

  const statusBadge = (status: string) => {
    const cls = status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      : status === 'VOID' ? 'bg-red-500/10 text-red-400 border-red-500/20'
      : 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    return <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${cls}`}>{status}</span>;
  };

  const typeBadge = (type: string) => {
    return type === 'WHOLESALE'
      ? <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">WHOLESALE</span>
      : <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">QUICK</span>;
  };

  return (
    <div className="space-y-4 pb-8">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className={`text-2xl lg:text-3xl font-bold flex items-center gap-3 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg">
              <FileText className="w-5 h-5 text-white" />
            </div>
            Invoices
          </h1>
          <p className={`mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>View and manage all sales invoices</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className={`px-4 py-2 rounded-xl border ${theme === 'dark' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'}`}>
            <p className={`text-xs ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>{stats.totalSales} Sales</p>
            <p className={`text-sm font-bold ${theme === 'dark' ? 'text-emerald-300' : 'text-emerald-700'}`}>{formatCurrency(stats.totalRevenue)}</p>
          </div>
          {stats.totalVoid > 0 && (
            <div className={`px-4 py-2 rounded-xl border ${theme === 'dark' ? 'bg-red-500/5 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
              <p className={`text-xs ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>{stats.totalVoid} Void</p>
            </div>
          )}
          <button onClick={() => navigate('/quick-invoice')} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium shadow-lg hover:shadow-emerald-500/25 transition-all text-sm">
            <Zap className="w-4 h-4" /> Quick Invoice
          </button>
          <button onClick={() => navigate('/wholesale-invoice')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm border transition-all ${
            theme === 'dark' ? 'bg-slate-800/50 border-slate-700/50 text-slate-300 hover:bg-slate-700/50' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}>
            <ShoppingCart className="w-4 h-4" /> Wholesale
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className={`rounded-2xl border p-4 ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
          {/* Left: Search + Filter Toggle */}
          <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full">
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
              <input type="text" placeholder="Search by invoice #, customer..." value={search} onChange={e => setSearch(e.target.value)}
                className={`w-full pl-10 ${search ? 'pr-9' : 'pr-4'} py-2.5 rounded-xl border outline-none transition-all ${
                  theme === 'dark' ? 'bg-slate-800/50 border-slate-700/50 text-white placeholder-slate-500 focus:border-emerald-500/50' : 'bg-white border-slate-200 focus:border-emerald-500'
                }`} />
              {search && <button onClick={() => setSearch('')} className={`absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full transition-colors ${theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'}`}><X className="w-3.5 h-3.5" /></button>}
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-medium transition-all border ${
                hasFilters
                  ? 'bg-emerald-500 text-white border-emerald-500'
                  : theme === 'dark'
                    ? 'border-slate-700/50 bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-sm'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="w-5 h-5 bg-white/20 rounded-full text-xs flex items-center justify-center">{activeFilterCount}</span>
              )}
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>

            {hasFilters && (
              <button onClick={clearFilters}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl transition-colors ${
                  theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-slate-700/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                }`}>
                <RefreshCw className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>

          {/* Right: Sort + ViewToggle */}
          <div className="flex items-center gap-2">
            <SortButton
              options={[
                { value: 'date-desc', label: 'Date: Newest' },
                { value: 'date-asc', label: 'Date: Oldest' },
                { value: 'total-desc', label: 'Total: High → Low' },
                { value: 'total-asc', label: 'Total: Low → High' },
                { value: 'invoice-asc', label: 'Invoice # A → Z' },
                { value: 'invoice-desc', label: 'Invoice # Z → A' },
              ]}
              value={sortBy}
              onChange={setSortBy}
            />
            <ViewToggle mode={viewMode} onChange={setViewMode} />
          </div>
        </div>

        {/* Expandable Filters */}
        {showFilters && (
          <div className={`flex flex-wrap gap-4 pt-4 mt-4 border-t ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
            <div className="flex-1 min-w-[140px]">
              <label className={`block text-xs font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Type</label>
              <SearchableSelect
                options={[{ value: '', label: 'All Types' }, { value: 'QUICK', label: 'Quick' }, { value: 'WHOLESALE', label: 'Wholesale' }] as SelectOption[]}
                value={typeFilter}
                onValueChange={setTypeFilter}
                placeholder="All Types"
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className={`block text-xs font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Status</label>
              <SearchableSelect
                options={[{ value: '', label: 'All Status' }, { value: 'COMPLETED', label: 'Completed' }, { value: 'VOID', label: 'Void' }] as SelectOption[]}
                value={statusFilter}
                onValueChange={setStatusFilter}
                placeholder="All Status"
              />
            </div>
            <div className="flex-1 min-w-[280px]">
              <label className={`block text-xs font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Date Range</label>
              <DateRangePicker
                fromDate={dateFrom}
                toDate={dateTo}
                onFromChange={setDateFrom}
                onToChange={setDateTo}
              />
            </div>
          </div>
        )}

        {hasFilters && !showFilters && (
          <div className="flex items-center gap-2 mt-3">
            <span className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{filtered.length} results</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className={`text-center py-16 rounded-2xl border ${theme === 'dark' ? 'bg-slate-800/20 border-slate-700/50' : 'bg-white border-slate-200'}`}>
          <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-100'}`}>
            <FileText className={`w-8 h-8 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`} />
          </div>
          <h3 className={`text-lg font-semibold mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
            {search || hasFilters ? 'No matching invoices' : 'No invoices yet'}
          </h3>
          <p className={`text-sm max-w-sm mx-auto ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
            {search || hasFilters
              ? 'Try adjusting your search or filters to find what you\'re looking for.'
              : 'Invoices will appear here once you create your first sale.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <>
          {/* Card View */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginatedInvoices.map(inv => (
              <div key={inv.id} className={`rounded-2xl border p-5 transition-all hover:scale-[1.02] ${
                theme === 'dark' ? 'bg-slate-800/30 border-slate-700/50 hover:border-slate-600' : 'bg-white border-slate-200 shadow-sm hover:shadow-md'
              }`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className={`font-mono text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{inv.invoiceNumber}</p>
                    <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{formatDateTime(inv.createdAt)}</p>
                  </div>
                  {statusBadge(inv.status)}
                </div>
                <div className="flex items-center gap-2 mb-3">
                  {typeBadge(inv.type)}
                  <span className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{inv.customerName || 'Walk-in'}</span>
                </div>
                <div className={`flex justify-between items-end pt-3 border-t ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-100'}`}>
                  <div>
                    <p className={`text-[10px] uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Total</p>
                    <p className={`text-lg font-bold ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>{formatCurrency(Number(inv.total))}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setSelectedInvoice(inv)} className={`p-1.5 rounded-lg ${theme === 'dark' ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`} title="View">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button onClick={() => handlePrint(inv)} className={`p-1.5 rounded-lg ${theme === 'dark' ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`} title="Print">
                      <Printer className="w-4 h-4" />
                    </button>
                    {inv.status === 'COMPLETED' && can('voidInvoices') && (
                      <button onClick={() => setVoidTarget(inv)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400" title="Void">
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filtered.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
          />
        </>
      ) : (
        <>
          <div className={`rounded-2xl border overflow-hidden ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'}>
                  <tr>{['Invoice #', 'Type', 'Customer', 'Total', 'Paid', 'Status', 'Date', 'Actions'].map(h => (
                    <th key={h} className={`px-4 py-3 text-left text-xs font-semibold uppercase ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody className={`divide-y ${theme === 'dark' ? 'divide-slate-700/50' : 'divide-slate-200'}`}>
                  {paginatedInvoices.map(inv => (
                    <tr key={inv.id} className={`transition-colors ${theme === 'dark' ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'}`}>
                      <td className={`px-4 py-3 font-mono text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{inv.invoiceNumber}</td>
                      <td className="px-4 py-3">{typeBadge(inv.type)}</td>
                      <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{inv.customerName || 'Walk-in'}</td>
                      <td className={`px-4 py-3 text-sm font-semibold ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>{formatCurrency(Number(inv.total))}</td>
                      <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{formatCurrency(Number(inv.paidAmount))}</td>
                      <td className="px-4 py-3">{statusBadge(inv.status)}</td>
                      <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{formatDateTime(inv.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setSelectedInvoice(inv)} className={`p-1.5 rounded-lg ${theme === 'dark' ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`} title="View">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => handlePrint(inv)} className={`p-1.5 rounded-lg ${theme === 'dark' ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`} title="Print Receipt">
                            <Printer className="w-4 h-4" />
                          </button>
                          {inv.status === 'COMPLETED' && can('voidInvoices') && (
                            <button onClick={() => setVoidTarget(inv)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400" title="Void">
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            <div className={`border-t ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filtered.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
              />
            </div>
          </div>
        </>
      )}

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border p-6 ${theme === 'dark' ? 'bg-slate-900 border-slate-700/50' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{selectedInvoice.invoiceNumber}</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => handlePrint(selectedInvoice)} className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`} title="Print">
                  <Printer className="w-5 h-5" />
                </button>
                <button onClick={() => setSelectedInvoice(null)} className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Type</span>{typeBadge(selectedInvoice.type)}</div>
              <div className="flex justify-between"><span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Customer</span><span className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>{selectedInvoice.customerName || 'Walk-in'}</span></div>
              <div className="flex justify-between"><span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Status</span>{statusBadge(selectedInvoice.status)}</div>
              <div className="flex justify-between"><span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Cashier</span><span className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>{selectedInvoice.user.name}</span></div>
              <div className="flex justify-between"><span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Date</span><span className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>{formatDateTime(selectedInvoice.createdAt)}</span></div>

              <div className={`border-t pt-3 mt-3 ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
                <h3 className={`font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Items</h3>
                {selectedInvoice.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between py-1">
                    <span className={theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}>{item.productName} x{item.quantity}</span>
                    <span className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>{formatCurrency(Number(item.total))}</span>
                  </div>
                ))}
              </div>

              <div className={`border-t pt-3 ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
                <div className="flex justify-between"><span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Subtotal</span><span className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>{formatCurrency(Number(selectedInvoice.subtotal))}</span></div>
                <div className="flex justify-between"><span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Discount</span><span className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>-{formatCurrency(Number(selectedInvoice.discount))}</span></div>
                <div className="flex justify-between font-bold text-lg mt-2"><span className="text-emerald-400">Total</span><span className="text-emerald-400">{formatCurrency(Number(selectedInvoice.total))}</span></div>
                <div className="flex justify-between mt-1"><span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Paid</span><span className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>{formatCurrency(Number(selectedInvoice.paidAmount))}</span></div>
                {Number(selectedInvoice.paidAmount) > Number(selectedInvoice.total) && (
                  <div className="flex justify-between"><span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Change</span><span className="text-emerald-400">{formatCurrency(Number(selectedInvoice.paidAmount) - Number(selectedInvoice.total))}</span></div>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => handlePrint(selectedInvoice)}
                className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium flex items-center justify-center gap-2">
                <Printer className="w-4 h-4" /> Print Receipt
              </button>
              <button onClick={() => setSelectedInvoice(null)} className={`flex-1 py-2.5 rounded-xl ${theme === 'dark' ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'}`}>Close</button>
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmationModal isOpen={!!voidTarget} title="Void Invoice"
        message="Are you sure you want to void this invoice? Stock will be restored for all items."
        itemName={voidTarget?.invoiceNumber} onConfirm={handleVoid} onCancel={() => setVoidTarget(null)} isLoading={voiding} />
    </div>
  );
};
export default Invoices;
