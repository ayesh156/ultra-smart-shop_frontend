import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { BarChart3, ArrowDown, ArrowUp, AlertTriangle, RefreshCw, Search, Filter, ChevronDown, X, PackageSearch } from 'lucide-react';
import { formatDate } from '../lib/utils';
import { Pagination } from '../components/ui/Pagination';
import { SearchableSelect, type SelectOption } from '../components/ui/SearchableSelect';
import { ViewToggle, type ViewMode } from '../components/ui/ViewToggle';
import { SortButton } from '../components/ui/SortButton';
import api from '../lib/api';
import toast from 'react-hot-toast';

interface StockMovement {
  id: string; type: string; quantity: number; reason: string | null; reference: string | null;
  createdAt: string; product: { id: string; name: string; barcode: string | null; sku: string | null };
}

interface LowStockProduct {
  id: string; name: string; barcode: string | null; stockQuantity: number; minStockLevel: number;
}

const StockManagement: React.FC = () => {
  const { theme } = useTheme();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [lowStock, setLowStock] = useState<LowStockProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [tab, setTab] = useState<'movements' | 'low-stock'>('movements');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [sortBy, setSortBy] = useState('date-desc');
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    try {
      const [mRes, lRes] = await Promise.all([api.get('/stock'), api.get('/stock/low-stock')]);
      setMovements(mRes.data.data || []);
      setLowStock(lRes.data.data || []);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let result = movements;
    if (typeFilter) result = result.filter(m => m.type === typeFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(m =>
        m.product.name.toLowerCase().includes(s) ||
        m.product.barcode?.toLowerCase().includes(s) ||
        m.reference?.toLowerCase().includes(s)
      );
    }
    return result.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'date-asc': return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'qty-desc': return b.quantity - a.quantity;
        case 'qty-asc': return a.quantity - b.quantity;
        case 'product-asc': return a.product.name.localeCompare(b.product.name);
        case 'product-desc': return b.product.name.localeCompare(a.product.name);
        default: return 0;
      }
    });
  }, [movements, search, typeFilter, sortBy]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginatedMovements = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  useEffect(() => { setCurrentPage(1); }, [search, typeFilter]);

  const typeIcon = (type: string) => {
    if (type === 'IN') return <ArrowDown className="w-4 h-4 text-emerald-400" />;
    if (type === 'OUT') return <ArrowUp className="w-4 h-4 text-red-400" />;
    return <RefreshCw className="w-4 h-4 text-amber-400" />;
  };

  const typeBadge = (type: string) => {
    const cls = type === 'IN' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      : type === 'OUT' ? 'bg-red-500/10 text-red-400 border-red-500/20'
      : 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    return <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {typeIcon(type)} {type}
    </span>;
  };

  return (
    <div className="space-y-4 pb-8">
      <div>
        <h1 className={`text-2xl lg:text-3xl font-bold flex items-center gap-3 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <PackageSearch className="w-5 h-5 text-white" />
          </div>
          Stock Management
        </h1>
        <p className={`mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Track inventory movements and low stock alerts</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[{ key: 'movements' as const, label: 'Movements', icon: BarChart3 }, { key: 'low-stock' as const, label: `Low Stock (${lowStock.length})`, icon: AlertTriangle }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg'
                : theme === 'dark' ? 'bg-slate-800/50 text-slate-400 hover:text-white border border-slate-700/50' : 'bg-white text-slate-600 border border-slate-200'
            }`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'movements' && (
        <>
          {/* Toolbar */}
          <div className={`rounded-2xl border p-4 ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'}`}>
            <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full">
                <div className="relative flex-1">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
                  <input type="text" placeholder="Search by product, barcode, or reference..." value={search} onChange={e => setSearch(e.target.value)}
                    className={`w-full pl-10 ${search ? 'pr-9' : 'pr-4'} py-2.5 rounded-xl border outline-none transition-all ${
                      theme === 'dark' ? 'bg-slate-800/50 border-slate-700/50 text-white placeholder-slate-500 focus:border-emerald-500/50' : 'bg-white border-slate-200 focus:border-emerald-500'
                    }`} />
                  {search && <button onClick={() => setSearch('')} className={`absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full transition-colors ${theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'}`}><X className="w-3.5 h-3.5" /></button>}
                </div>

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-medium transition-all border ${
                    typeFilter
                      ? 'bg-emerald-500 text-white border-emerald-500'
                      : theme === 'dark'
                        ? 'border-slate-700/50 bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-sm'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  Filters
                  {typeFilter && <span className="w-5 h-5 bg-white/20 rounded-full text-xs flex items-center justify-center">1</span>}
                  <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                </button>

                {typeFilter && (
                  <button onClick={() => setTypeFilter('')}
                    className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl transition-colors ${
                      theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-slate-700/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                    }`}>
                    <RefreshCw className="w-3.5 h-3.5" /> Clear
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <SortButton
                  options={[
                    { value: 'date-desc', label: 'Date: Newest' },
                    { value: 'date-asc', label: 'Date: Oldest' },
                    { value: 'qty-desc', label: 'Qty: High → Low' },
                    { value: 'qty-asc', label: 'Qty: Low → High' },
                    { value: 'product-asc', label: 'Product A → Z' },
                    { value: 'product-desc', label: 'Product Z → A' },
                  ]}
                  value={sortBy}
                  onChange={setSortBy}
                />
                <ViewToggle mode={viewMode} onChange={setViewMode} />
              </div>
            </div>

            {showFilters && (
              <div className={`flex flex-wrap gap-4 pt-4 mt-4 border-t ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
                <div className="flex-1 min-w-[160px] max-w-[250px]">
                  <label className={`block text-xs font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Movement Type</label>
                  <SearchableSelect
                    options={[
                      { value: '', label: 'All Types' },
                      { value: 'IN', label: 'Stock In' },
                      { value: 'OUT', label: 'Stock Out' },
                      { value: 'ADJUSTMENT', label: 'Adjustment' },
                    ] as SelectOption[]}
                    value={typeFilter}
                    onValueChange={setTypeFilter}
                    placeholder="All Types"
                  />
                </div>
              </div>
            )}

            {typeFilter && !showFilters && (
              <div className="flex items-center gap-2 mt-3">
                <span className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{filtered.length} results</span>
              </div>
            )}
          </div>

          {loading ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div> : filtered.length === 0 ? (
            <div className={`text-center py-16 rounded-2xl border ${theme === 'dark' ? 'bg-slate-800/20 border-slate-700/50' : 'bg-white border-slate-200'}`}>
              <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-100'}`}>
                <BarChart3 className={`w-8 h-8 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`} />
              </div>
              <h3 className={`text-lg font-semibold mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                {search || typeFilter ? 'No matching stock movements' : 'No stock movements yet'}
              </h3>
              <p className={`text-sm max-w-sm mx-auto ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                {search || typeFilter
                  ? 'Try adjusting your search or filters to find what you\'re looking for.'
                  : 'Stock movements will appear here as products are added, sold, or adjusted.'}
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            <>
              {/* Card View */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {paginatedMovements.map(m => (
                  <div key={m.id} className={`rounded-2xl border p-5 transition-all hover:scale-[1.02] ${
                    theme === 'dark' ? 'bg-slate-800/30 border-slate-700/50 hover:border-slate-600' : 'bg-white border-slate-200 shadow-sm hover:shadow-md'
                  }`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        m.type === 'IN' ? 'bg-emerald-500/10' : m.type === 'OUT' ? 'bg-red-500/10' : 'bg-amber-500/10'
                      }`}>
                        {m.type === 'IN' ? <ArrowDown className="w-5 h-5 text-emerald-400" /> : m.type === 'OUT' ? <ArrowUp className="w-5 h-5 text-red-400" /> : <RefreshCw className="w-5 h-5 text-amber-400" />}
                      </div>
                      {typeBadge(m.type)}
                    </div>
                    <h3 className={`font-semibold truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{m.product.name}</h3>
                    {m.product.barcode && <p className="text-xs text-slate-500 font-mono mt-0.5">{m.product.barcode}</p>}
                    <div className={`mt-3 pt-3 border-t ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-100'}`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-2xl font-bold ${m.type === 'IN' ? 'text-emerald-400' : m.type === 'OUT' ? 'text-red-400' : 'text-amber-400'}`}>
                          {m.type === 'IN' ? '+' : m.type === 'OUT' ? '-' : '±'}{m.quantity}
                        </span>
                        <span className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{formatDate(m.createdAt)}</span>
                      </div>
                      {m.reason && <p className={`text-xs mt-1.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{m.reason}</p>}
                      {m.reference && <p className={`text-xs font-mono mt-0.5 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Ref: {m.reference}</p>}
                    </div>
                  </div>
                ))}
              </div>
              <Pagination
                currentPage={currentPage} totalPages={totalPages} totalItems={filtered.length}
                pageSize={pageSize} onPageChange={setCurrentPage}
                onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
              />
            </>
          ) : (
            <div className={`rounded-2xl border overflow-hidden ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'}>
                    <tr>{['Product', 'Type', 'Quantity', 'Reason', 'Reference', 'Date'].map(h => (
                      <th key={h} className={`px-4 py-3 text-left text-xs font-semibold uppercase ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className={`divide-y ${theme === 'dark' ? 'divide-slate-700/50' : 'divide-slate-200'}`}>
                    {paginatedMovements.map(m => (
                      <tr key={m.id} className={theme === 'dark' ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'}>
                        <td className={`px-4 py-3 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                          <div><p className="font-medium">{m.product.name}</p>
                            {m.product.barcode && <p className="text-xs text-slate-500 font-mono">{m.product.barcode}</p>}
                          </div>
                        </td>
                        <td className="px-4 py-3">{typeBadge(m.type)}</td>
                        <td className={`px-4 py-3 font-semibold ${m.type === 'IN' ? 'text-emerald-400' : m.type === 'OUT' ? 'text-red-400' : 'text-amber-400'}`}>
                          {m.type === 'IN' ? '+' : m.type === 'OUT' ? '-' : '±'}{m.quantity}
                        </td>
                        <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{m.reason || '—'}</td>
                        <td className={`px-4 py-3 text-sm font-mono ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{m.reference || '—'}</td>
                        <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{formatDate(m.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={`border-t ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
                <Pagination
                  currentPage={currentPage} totalPages={totalPages} totalItems={filtered.length}
                  pageSize={pageSize} onPageChange={setCurrentPage}
                  onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
                />
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'low-stock' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {lowStock.map(p => (
            <div key={p.id} className={`rounded-2xl border p-5 ${theme === 'dark' ? 'bg-red-500/5 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={`font-semibold truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{p.name}</h3>
                  {p.barcode && <p className="text-xs text-slate-500 font-mono">{p.barcode}</p>}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-red-400 font-bold text-lg">{p.stockQuantity} left</span>
                <span className={`text-sm ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Min: {p.minStockLevel}</span>
              </div>
            </div>
          ))}
          {lowStock.length === 0 && (
            <div className="col-span-full text-center py-12">
              <AlertTriangle className={`w-12 h-12 mx-auto mb-4 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`} />
              <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>No low stock items - great!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default StockManagement;
