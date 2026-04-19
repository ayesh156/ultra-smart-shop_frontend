import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Package, Search, Plus, Edit, Trash2, Barcode, AlertTriangle, X, Filter, ChevronDown, RefreshCw, Layers, Copy, Loader2, ToggleLeft, ToggleRight, Info, Printer } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { Pagination } from '../components/ui/Pagination';
import { SearchableSelect, type SelectOption } from '../components/ui/SearchableSelect';
import { ViewToggle, type ViewMode } from '../components/ui/ViewToggle';
import { SortButton } from '../components/ui/SortButton';
import { DeleteConfirmationModal } from '../components/modals/DeleteConfirmationModal';
import api from '../lib/api';
import toast from 'react-hot-toast';
import JsBarcode from 'jsbarcode';

interface ProductVariant {
  id: string;
  name: string;
  attributes: string; // JSON string
  sku: string | null;
  barcode: string | null;
  costPrice: string;
  sellingPrice: string;
  wholesalePrice: string;
  stockQuantity: number;
  isActive: boolean;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  image: string | null;
  costPrice: string;
  sellingPrice: string;
  wholesalePrice: string;
  stockQuantity: number;
  minStockLevel: number;
  categoryId: string | null;
  brandId: string | null;
  isActive: boolean;
  category: { id: string; name: string } | null;
  brand: { id: string; name: string } | null;
  variants?: ProductVariant[];
}

interface Category { id: string; name: string; }
interface Brand { id: string; name: string; }

interface FormData {
  name: string;
  description: string;
  sku: string;
  barcode: string;
  costPrice: string;
  sellingPrice: string;
  wholesalePrice: string;
  stockQuantity: string;
  minStockLevel: string;
  categoryId: string;
  brandId: string;
  addStock: string;
}

const defaultForm: FormData = {
  name: '', description: '', sku: '', barcode: '',
  costPrice: '0', sellingPrice: '0', wholesalePrice: '0',
  stockQuantity: '0', minStockLevel: '5', categoryId: '', brandId: '', addStock: '',
};

const Products: React.FC = () => {
  const { theme } = useTheme();
  const { can } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [modalOpen, setModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [sortBy, setSortBy] = useState('name-asc');
  const [showFilters, setShowFilters] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Variant state
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [showVariants, setShowVariants] = useState(false);
  const [variantForm, setVariantForm] = useState({ name: '', sku: '', barcode: '', costPrice: '', sellingPrice: '', wholesalePrice: '', stockQuantity: '0', attributes: '' });
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [savingVariant, setSavingVariant] = useState(false);
  const [variantDeleteTarget, setVariantDeleteTarget] = useState<ProductVariant | null>(null);
  const [hasVariants, setHasVariants] = useState(false);
  const [barcodeChecking, setBarcodeChecking] = useState(false);
  const [barcodeError, setBarcodeError] = useState('');
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    try {
      const [pRes, cRes, bRes] = await Promise.all([
        api.get('/products'), api.get('/categories'), api.get('/brands')
      ]);
      setProducts(pRes.data.data || []);
      setCategories(cRes.data.data || []);
      setBrands(bRes.data.data || []);
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openCreate = () => {
    setEditProduct(null);
    setForm(defaultForm);
    setVariants([]);
    setShowVariants(false);
    setHasVariants(false);
    setBarcodeError('');
    setModalOpen(true);
  };
  const openEdit = (p: Product) => {
    setEditProduct(p);
    setForm({
      name: p.name, description: p.description || '', sku: p.sku || '',
      barcode: p.barcode || '', costPrice: String(p.costPrice), sellingPrice: String(p.sellingPrice),
      wholesalePrice: String(p.wholesalePrice), stockQuantity: String(p.stockQuantity),
      minStockLevel: String(p.minStockLevel), categoryId: p.categoryId || '', brandId: p.brandId || '', addStock: '',
    });
    setBarcodeError('');
    setShowVariants(false);
    // Load variants
    api.get(`/variants/product/${p.id}`).then(r => {
      const v = r.data.data || [];
      setVariants(v);
      if (v.length > 0) setHasVariants(true); else setHasVariants(false);
    }).catch(() => setVariants([]));
    setModalOpen(true);
  };

  useEffect(() => {
    if (!modalOpen || (hasVariants && !editProduct)) return;
    const timer = window.setTimeout(() => {
      barcodeInputRef.current?.focus();
      barcodeInputRef.current?.select();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [modalOpen, editProduct, hasVariants]);

  const checkBarcodeAvailability = useCallback(async (rawValue: string, silent = false): Promise<boolean> => {
    const value = rawValue.trim();
    if (!value) {
      setBarcodeError('');
      return true;
    }

    try {
      setBarcodeChecking(true);
      const r = await api.get(`/products/barcode-availability/${encodeURIComponent(value)}`, {
        params: editProduct ? { excludeProductId: editProduct.id } : undefined,
      });

      if (!r.data?.data?.available) {
        const msg = 'This barcode already exists. Please use a unique barcode.';
        setBarcodeError(msg);
        setForm(prev => ({ ...prev, barcode: '' }));
        if (!silent) toast.error(msg);
        window.setTimeout(() => {
          barcodeInputRef.current?.focus();
        }, 0);
        return false;
      }

      setBarcodeError('');
      return true;
    } catch {
      if (!silent) toast.error('Could not validate barcode right now. Please try again.');
      return false;
    } finally {
      setBarcodeChecking(false);
    }
  }, [editProduct]);

  const resetVariantForm = () => {
    setVariantForm({ name: '', sku: '', barcode: '', costPrice: '', sellingPrice: '', wholesalePrice: '', stockQuantity: '0', attributes: '' });
    setEditingVariant(null);
  };

  const handleSaveVariant = async () => {
    if (!editProduct) return;
    if (!variantForm.name.trim()) { toast.error('Variant name is required'); return; }
    setSavingVariant(true);
    try {
      const payload = {
        productId: editProduct.id,
        name: variantForm.name,
        attributes: variantForm.attributes || '{}',
        sku: variantForm.sku || null,
        barcode: variantForm.barcode || null,
        costPrice: parseFloat(variantForm.costPrice) || 0,
        sellingPrice: parseFloat(variantForm.sellingPrice) || 0,
        wholesalePrice: parseFloat(variantForm.wholesalePrice) || 0,
        stockQuantity: parseInt(variantForm.stockQuantity) || 0,
      };
      if (editingVariant) {
        await api.put(`/variants/${editingVariant.id}`, payload);
        toast.success('Variant updated');
      } else {
        await api.post('/variants', payload);
        toast.success('Variant added');
      }
      // Reload variants
      const r = await api.get(`/variants/product/${editProduct.id}`);
      setVariants(r.data.data || []);
      resetVariantForm();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save variant');
    } finally { setSavingVariant(false); }
  };

  const handleDeleteVariant = async () => {
    if (!variantDeleteTarget || !editProduct) return;
    try {
      await api.delete(`/variants/${variantDeleteTarget.id}`);
      toast.success('Variant deleted');
      const r = await api.get(`/variants/product/${editProduct.id}`);
      setVariants(r.data.data || []);
      setVariantDeleteTarget(null);
    } catch (err: unknown) { toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to delete variant'); }
  };

  const generateVariantBarcode = async () => {
    try {
      const r = await api.post('/shop/generate-barcode');
      setVariantForm(prev => ({ ...prev, barcode: r.data.data.barcode }));
    } catch {
      setVariantForm(prev => ({ ...prev, barcode: String(Date.now()).slice(-10) }));
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Product name is required'); return; }
    if (!hasVariants && !editProduct && (!form.sellingPrice || Number(form.sellingPrice) <= 0)) {
      toast.error('Selling price is required'); return;
    }
    setSaving(true);
    try {
      if (form.barcode.trim()) {
        const available = await checkBarcodeAvailability(form.barcode, true);
        if (!available) {
          toast.error('Please enter a new unique barcode before saving.');
          setSaving(false);
          return;
        }
      }

      const addStockVal = editProduct ? (parseInt(form.addStock) || 0) : 0;
      const computedStock = editProduct
        ? (parseInt(form.stockQuantity) || 0) + addStockVal
        : (parseInt(form.stockQuantity) || 0);
      const payload = {
        name: form.name, description: form.description || null,
        sku: hasVariants && !editProduct ? null : (form.sku || null),
        barcode: hasVariants && !editProduct ? null : (form.barcode || null),
        costPrice: hasVariants && !editProduct ? 0 : (parseFloat(form.costPrice) || 0),
        sellingPrice: hasVariants && !editProduct ? 0 : (parseFloat(form.sellingPrice) || 0),
        wholesalePrice: hasVariants && !editProduct ? 0 : (parseFloat(form.wholesalePrice) || 0),
        stockQuantity: hasVariants && !editProduct ? 0 : computedStock,
        minStockLevel: parseInt(form.minStockLevel) || 5,
        categoryId: form.categoryId || null, brandId: form.brandId || null,
      };
      if (editProduct) {
        await api.put(`/products/${editProduct.id}`, payload);
        toast.success('Product updated');
      } else {
        const r = await api.post('/products', payload);
        const created = r.data.data;
        toast.success('Product created');

        // If hasVariants, switch to edit mode to add variants
        if (hasVariants) {
          setEditProduct(created);
          setForm({
            name: created.name, description: created.description || '', sku: created.sku || '',
            barcode: created.barcode || '', costPrice: String(created.costPrice), sellingPrice: String(created.sellingPrice),
            wholesalePrice: String(created.wholesalePrice), stockQuantity: String(created.stockQuantity),
            minStockLevel: String(created.minStockLevel), categoryId: created.categoryId || '', brandId: created.brandId || '', addStock: '',
          });
          setShowVariants(true);
          toast.success('Now add variants below');
          setSaving(false);
          loadData();
          return;
        }
      }
      setModalOpen(false);
      loadData();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/products/${deleteTarget.id}`);
      toast.success('Product deactivated');
      setDeleteTarget(null);
      loadData();
    } catch (err: unknown) { toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to delete product'); }
    finally { setDeleting(false); }
  };

  const filtered = useMemo(() => {
    let result = products.filter(p => p.isActive);
    if (categoryFilter) result = result.filter(p => p.category?.id === categoryFilter);
    if (brandFilter) result = result.filter(p => p.brand?.id === brandFilter);
    if (stockFilter === 'low') result = result.filter(p => p.stockQuantity > 0 && p.stockQuantity <= p.minStockLevel);
    if (stockFilter === 'out') result = result.filter(p => p.stockQuantity === 0);
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(s) ||
        p.barcode?.toLowerCase().includes(s) ||
        p.sku?.toLowerCase().includes(s) ||
        p.category?.name.toLowerCase().includes(s) ||
        p.brand?.name.toLowerCase().includes(s)
      );
    }
    // Sort
    return result.sort((a, b) => {
      switch (sortBy) {
        case 'name-asc': return a.name.localeCompare(b.name);
        case 'name-desc': return b.name.localeCompare(a.name);
        case 'price-asc': return Number(a.sellingPrice) - Number(b.sellingPrice);
        case 'price-desc': return Number(b.sellingPrice) - Number(a.sellingPrice);
        case 'stock-asc': return a.stockQuantity - b.stockQuantity;
        case 'stock-desc': return b.stockQuantity - a.stockQuantity;
        default: return 0;
      }
    });
  }, [products, search, categoryFilter, brandFilter, stockFilter, sortBy]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  useEffect(() => { setCurrentPage(1); }, [search, categoryFilter, brandFilter, stockFilter]);

  const generateBarcode = async () => {
    try {
      const r = await api.post('/shop/generate-barcode');
      setForm(prev => ({ ...prev, barcode: r.data.data.barcode }));
    } catch {
      const code = `${Date.now()}`.slice(-10);
      setForm(prev => ({ ...prev, barcode: code }));
    }
  };

  const inputClass = `w-full px-4 py-2.5 rounded-xl border transition-all outline-none ${
    theme === 'dark'
      ? 'bg-slate-800/50 border-slate-700/50 text-white placeholder-slate-500 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20'
      : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
  }`;

  // Barcode SVG renderer for previews
  const renderBarcode = (node: SVGSVGElement | null, value: string) => {
    if (!node || !value) return;
    const fmt = /^\d{12,13}$/.test(value) ? 'EAN13' : 'CODE128';
    try {
      JsBarcode(node, value, { format: fmt, width: fmt === 'EAN13' ? 1.3 : 1, height: 30, displayValue: true, fontSize: fmt === 'EAN13' ? 11 : 10, margin: 2, textMargin: 2, flat: false });
    } catch {
      try { JsBarcode(node, value, { format: 'CODE128', width: 1, height: 28, displayValue: true, fontSize: 10, margin: 2, textMargin: 1 }); } catch { /* skip */ }
    }
  };

  const hasActiveFilters = categoryFilter || brandFilter || stockFilter !== 'all';
  const activeFilterCount = [categoryFilter, brandFilter, stockFilter !== 'all' ? stockFilter : ''].filter(Boolean).length;

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className={`text-2xl lg:text-3xl font-bold flex items-center gap-3 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Package className="w-5 h-5 text-white" />
            </div>
            Products
          </h1>
          <p className={`mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Manage your product inventory</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/barcode-print')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium border transition-all ${
            theme === 'dark' ? 'border-slate-700/50 bg-slate-800/50 text-slate-300 hover:bg-slate-700/50' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-sm'
          }`}>
            <Printer className="w-5 h-5" /> Barcode Print
          </button>
          {can('createProducts') && <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium shadow-lg hover:shadow-emerald-500/25 transition-all">
            <Plus className="w-5 h-5" /> Add Product
          </button>}
        </div>
      </div>

      {/* Toolbar */}
      <div className={`rounded-2xl border p-4 ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
          {/* Left: Search + Filter Toggle */}
          <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full">
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
              <input type="text" placeholder="Search by name, barcode, short code..."
                value={search} onChange={(e) => setSearch(e.target.value)}
                className={`w-full pl-10 ${search ? 'pr-9' : 'pr-4'} py-2.5 rounded-xl border outline-none transition-all ${
                  theme === 'dark' ? 'bg-slate-800/50 border-slate-700/50 text-white placeholder-slate-500 focus:border-emerald-500/50' : 'bg-white border-slate-200 focus:border-emerald-500'
                }`} />
              {search && <button onClick={() => setSearch('')} className={`absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full transition-colors ${theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'}`}><X className="w-3.5 h-3.5" /></button>}
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-medium transition-all border ${
                hasActiveFilters
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

            {hasActiveFilters && (
              <button onClick={() => { setCategoryFilter(''); setBrandFilter(''); setStockFilter('all'); }}
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
                { value: 'name-asc', label: 'Name A → Z' },
                { value: 'name-desc', label: 'Name Z → A' },
                { value: 'price-asc', label: 'Price: Low → High' },
                { value: 'price-desc', label: 'Price: High → Low' },
                { value: 'stock-asc', label: 'Stock: Low → High' },
                { value: 'stock-desc', label: 'Stock: High → Low' },
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
            <div className="flex-1 min-w-[170px]">
              <label className={`block text-xs font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Category</label>
              <SearchableSelect
                options={[{ value: '', label: 'All Categories' }, ...categories.map(c => ({ value: c.id, label: c.name }))] as SelectOption[]}
                value={categoryFilter}
                onValueChange={setCategoryFilter}
                placeholder="All Categories"
                searchPlaceholder="Search categories..."
              />
            </div>
            <div className="flex-1 min-w-[170px]">
              <label className={`block text-xs font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Brand</label>
              <SearchableSelect
                options={[{ value: '', label: 'All Brands' }, ...brands.map(b => ({ value: b.id, label: b.name }))] as SelectOption[]}
                value={brandFilter}
                onValueChange={setBrandFilter}
                placeholder="All Brands"
                searchPlaceholder="Search brands..."
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className={`block text-xs font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Stock Status</label>
              <SearchableSelect
                options={[
                  { value: 'all', label: 'All Stock' },
                  { value: 'low', label: 'Low Stock' },
                  { value: 'out', label: 'Out of Stock' },
                ] as SelectOption[]}
                value={stockFilter}
                onValueChange={(v) => setStockFilter(v as 'all' | 'low' | 'out')}
                placeholder="All Stock"
              />
            </div>
          </div>
        )}

        {hasActiveFilters && !showFilters && (
          <div className="flex items-center gap-2 mt-3">
            <span className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{filtered.length} results</span>
          </div>
        )}
      </div>

      {/* Products Content */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className={`text-center py-16 rounded-2xl border ${theme === 'dark' ? 'bg-slate-800/20 border-slate-700/50' : 'bg-white border-slate-200'}`}>
          <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-100'}`}>
            <Package className={`w-8 h-8 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`} />
          </div>
          <h3 className={`text-lg font-semibold mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
            {search || hasActiveFilters ? 'No matching products' : 'No products yet'}
          </h3>
          <p className={`text-sm max-w-sm mx-auto ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
            {search || hasActiveFilters
              ? 'Try adjusting your search or filters to find what you\'re looking for.'
              : 'Get started by adding your first product to the inventory.'}
          </p>
          {!search && !hasActiveFilters && can('createProducts') && (
            <button onClick={openCreate} className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium text-sm hover:shadow-lg hover:shadow-emerald-500/25 transition-all">
              <Plus className="w-4 h-4" /> Add Product
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <>
          {/* Card View */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginatedProducts.map(p => (
              <div key={p.id} className={`relative rounded-2xl border p-5 transition-all hover:scale-[1.02] group ${
                theme === 'dark' ? 'bg-slate-800/30 border-slate-700/50 hover:border-slate-600' : 'bg-white border-slate-200 shadow-sm hover:shadow-md'
              }`}>
                {/* Stock Badge */}
                <span className={`absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                  p.stockQuantity === 0
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                    : p.stockQuantity <= p.minStockLevel
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}>
                  {p.stockQuantity <= p.minStockLevel && <AlertTriangle className="w-3 h-3" />}
                  {p.stockQuantity} in stock
                </span>

                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mb-3">
                  <Package className="w-5 h-5 text-white" />
                </div>

                <h3 className={`font-semibold truncate pr-16 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{p.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  {p.brand && <span className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{p.brand.name}</span>}
                  {p.brand && p.category && <span className={`text-xs ${theme === 'dark' ? 'text-slate-600' : 'text-slate-300'}`}>·</span>}
                  {p.category && <span className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{p.category.name}</span>}
                </div>
                {p.barcode && <p className={`text-xs font-mono mt-1.5 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-300'}`}>{p.barcode}</p>}
                {p.barcode && (
                  <div className="mt-2 bg-white rounded-lg p-1.5 inline-block">
                    <svg ref={node => renderBarcode(node, p.barcode!)} style={{ height: '32px' }} />
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 mt-4">
                  <div>
                    <p className={`text-[10px] uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Cost</p>
                    <p className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{formatCurrency(Number(p.costPrice))}</p>
                  </div>
                  <div>
                    <p className={`text-[10px] uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Price</p>
                    <p className={`text-sm font-bold ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>{formatCurrency(Number(p.sellingPrice))}</p>
                  </div>
                  <div>
                    <p className={`text-[10px] uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>W/Sale</p>
                    <p className={`text-sm font-medium ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{formatCurrency(Number(p.wholesalePrice))}</p>
                  </div>
                </div>

                {/* Hover Actions */}
                <div className={`flex items-center gap-1 mt-3 pt-3 border-t ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-100'}`}>
                  {can('editProducts') && <button onClick={() => openEdit(p)} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    theme === 'dark' ? 'hover:bg-slate-700 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-700'
                  }`}><Edit className="w-3.5 h-3.5" /> Edit</button>}
                  {can('deleteProducts') && <button onClick={() => setDeleteTarget(p)} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>}
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
        <div className={`rounded-2xl border overflow-hidden ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'}>
                <tr>
                  {['Product', 'Barcode', 'Category', 'Cost', 'Price', 'Wholesale', 'Stock', 'Actions'].map(h => (
                    <th key={h} className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                    }`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y ${theme === 'dark' ? 'divide-slate-700/50' : 'divide-slate-200'}`}>
                {paginatedProducts.map((p) => (
                  <tr key={p.id} className={`transition-colors ${theme === 'dark' ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'}`}>
                    <td className="px-4 py-3">
                      <div>
                        <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{p.name}</p>
                        {p.brand && <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{p.brand.name}</p>}
                      </div>
                    </td>
                    <td className={`px-4 py-3 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                      {p.barcode ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-mono">{p.barcode}</span>
                          <div className="bg-white rounded p-1 inline-block w-fit">
                            <svg ref={node => renderBarcode(node, p.barcode!)} style={{ height: '28px' }} />
                          </div>
                        </div>
                      ) : <span className={theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}>—</span>}
                    </td>
                    <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                      {p.category?.name || '—'}
                    </td>
                    <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                      {formatCurrency(Number(p.costPrice))}
                    </td>
                    <td className={`px-4 py-3 text-sm font-medium ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>
                      {formatCurrency(Number(p.sellingPrice))}
                    </td>
                    <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                      {formatCurrency(Number(p.wholesalePrice))}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        p.stockQuantity <= p.minStockLevel
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {p.stockQuantity <= p.minStockLevel && <AlertTriangle className="w-3 h-3" />}
                        {p.stockQuantity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {can('editProducts') && <button onClick={() => openEdit(p)} className={`p-1.5 rounded-lg transition-colors ${
                          theme === 'dark' ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-600'
                        }`}><Edit className="w-4 h-4" /></button>}
                        {can('deleteProducts') && <button onClick={() => setDeleteTarget(p)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400">
                          <Trash2 className="w-4 h-4" />
                        </button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
             onWheel={e => { if ((e.target as HTMLElement).closest('input[type="number"]')) e.preventDefault(); }}>
          <div className={`relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border shadow-xl ${
            theme === 'dark' ? 'bg-slate-900 border-slate-700/50' : 'bg-white border-slate-200'
          }`}>
            <div className={`flex-shrink-0 flex items-center justify-between px-6 py-4 border-b ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
              <h2 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {editProduct ? 'Edit Product' : 'Add Product'}
              </h2>
              <button onClick={() => setModalOpen(false)} className={`p-2 rounded-lg ${
                theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
              }`}><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">

            <div className="space-y-4">
              {/* Has Variants Toggle — FIRST */}
              {!editProduct && (
                <div className={`flex items-center justify-between p-3 rounded-xl border ${
                  hasVariants
                    ? theme === 'dark' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'
                    : theme === 'dark' ? 'bg-slate-800/30 border-slate-700/50' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center gap-2">
                    <Layers className={`w-4 h-4 ${hasVariants ? 'text-emerald-500' : theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} />
                    <div>
                      <p className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Has Variants?</p>
                      <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                        e.g. colors, storage, RAM — each variant has its own pricing & stock
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setHasVariants(!hasVariants)} type="button" className="flex-shrink-0">
                    {hasVariants
                      ? <ToggleRight className="w-8 h-8 text-emerald-500" />
                      : <ToggleLeft className={`w-8 h-8 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
                    }
                  </button>
                </div>
              )}

              {/* Product Name */}
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Product Name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g., iPhone 15 Pro Max Case" className={inputClass} />
              </div>

              {/* Description + Barcode Preview side by side */}
              <div className={`grid gap-4 ${form.barcode && !(hasVariants && !editProduct) ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Description</label>
                  <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    rows={3} placeholder="Product description..." className={inputClass} />
                </div>
                {form.barcode && !(hasVariants && !editProduct) && (
                  <div>
                    <label className={`block text-sm font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Barcode Preview</label>
                    <div className={`flex items-center justify-center p-3 rounded-xl border h-[calc(100%-28px)] ${theme === 'dark' ? 'bg-white/5 border-slate-700/30' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="bg-white rounded-lg p-2 inline-block">
                        <svg ref={node => renderBarcode(node, form.barcode)} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Short Code + Barcode — hidden when hasVariants new product */}
              {!(hasVariants && !editProduct) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Short Code</label>
                  <input value={form.sku} onChange={e => setForm(p => ({ ...p, sku: e.target.value }))} placeholder="e.g. A1 or IP15" className={inputClass} />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Barcode</label>
                  <div className="flex gap-2">
                    <input
                      ref={barcodeInputRef}
                      value={form.barcode}
                      onChange={e => {
                        setForm(p => ({ ...p, barcode: e.target.value }));
                        if (barcodeError) setBarcodeError('');
                      }}
                      onBlur={() => { void checkBarcodeAvailability(form.barcode); }}
                      placeholder="Scan or generate"
                      className={`${inputClass} flex-1 ${barcodeError ? 'border-red-500/60 focus:border-red-500' : ''}`}
                    />
                    <button onClick={generateBarcode} className="px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm" title="Generate Barcode">
                      <Barcode className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="mt-1.5 min-h-[18px]">
                    {barcodeChecking && (
                      <p className={`text-xs flex items-center gap-1.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                        <Loader2 className="w-3 h-3 animate-spin" /> Checking barcode availability...
                      </p>
                    )}
                    {!barcodeChecking && barcodeError && (
                      <p className="text-xs text-red-500">{barcodeError}</p>
                    )}
                  </div>
                </div>
              </div>
              )}

              {/* Pricing — hidden when hasVariants new product */}
              {!(hasVariants && !editProduct) && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Cost Price (Rs.)</label>
                  <input type="number" value={form.costPrice} onChange={e => setForm(p => ({ ...p, costPrice: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Selling Price (Rs.)</label>
                  <input type="number" value={form.sellingPrice} onChange={e => setForm(p => ({ ...p, sellingPrice: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Wholesale Price (Rs.)</label>
                  <input type="number" value={form.wholesalePrice} onChange={e => setForm(p => ({ ...p, wholesalePrice: e.target.value }))} className={inputClass} />
                </div>
              </div>
              )}

              {/* Stock — hidden when hasVariants new product */}
              {!(hasVariants && !editProduct) && (
              <div className={`grid gap-4 ${editProduct ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
                {editProduct && (
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Current Stock</label>
                  <input type="number" value={form.stockQuantity} readOnly
                    className={`${inputClass} cursor-not-allowed opacity-60`} />
                </div>
                )}
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{editProduct ? 'Add Stock (+)' : 'Stock Quantity'}</label>
                  <input type="number" value={editProduct ? form.addStock : form.stockQuantity}
                    onChange={e => editProduct
                      ? setForm(p => ({ ...p, addStock: e.target.value }))
                      : setForm(p => ({ ...p, stockQuantity: e.target.value }))}
                    onWheel={e => (e.target as HTMLElement).blur()}
                    placeholder={editProduct ? '0' : '1'} className={inputClass} />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Min Stock Level</label>
                  <input type="number" value={form.minStockLevel} onChange={e => setForm(p => ({ ...p, minStockLevel: e.target.value }))} onWheel={e => (e.target as HTMLElement).blur()} className={inputClass} />
                </div>
              </div>
              )}

              {/* Info box when hasVariants is ON and creating */}
              {hasVariants && !editProduct && (
                <div className={`flex items-start gap-3 p-3 rounded-xl border ${
                  theme === 'dark' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-200'
                }`}>
                  <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className={`text-xs ${theme === 'dark' ? 'text-blue-300' : 'text-blue-700'}`}>
                    <p className="font-medium">Variants handle pricing & stock</p>
                    <p className="mt-0.5 opacity-80">Save the product first, then add variants with individual barcodes, prices and stock quantities.</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Category</label>
                  <SearchableSelect
                    options={[{ value: '', label: 'No Category' }, ...categories.map(c => ({ value: c.id, label: c.name }))] as SelectOption[]}
                    value={form.categoryId}
                    onValueChange={(v) => setForm(p => ({ ...p, categoryId: v }))}
                    placeholder="Select Category"
                    searchPlaceholder="Search categories..."
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Brand</label>
                  <SearchableSelect
                    options={[{ value: '', label: 'No Brand' }, ...brands.map(b => ({ value: b.id, label: b.name }))] as SelectOption[]}
                    value={form.brandId}
                    onValueChange={(v) => setForm(p => ({ ...p, brandId: v }))}
                    placeholder="Select Brand"
                    searchPlaceholder="Search brands..."
                  />
                </div>
              </div>

            {/* Variants Section */}
            {editProduct && (
              <div className={`rounded-xl border p-4 ${theme === 'dark' ? 'border-slate-700/50 bg-slate-800/30' : 'border-slate-200 bg-slate-50'}`}>
                <button onClick={() => setShowVariants(!showVariants)}
                  className={`flex items-center justify-between w-full text-left ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-500" />
                    <span className="font-semibold text-sm">Variants</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${theme === 'dark' ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>
                      {variants.length}
                    </span>
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showVariants ? 'rotate-180' : ''} ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} />
                </button>

                {showVariants && (
                  <div className="mt-4 space-y-3">
                    {/* Existing variants */}
                    {variants.map(v => {
                      let attrs: Record<string, string> = {};
                      try { attrs = JSON.parse(v.attributes); } catch { /* empty */ }
                      return (
                        <div key={v.id} className={`flex items-center gap-3 p-3 rounded-xl border ${
                          theme === 'dark' ? 'bg-slate-900/50 border-slate-700/50' : 'bg-white border-slate-200'
                        }`}>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{v.name}</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Object.entries(attrs).map(([k, val]) => (
                                <span key={k} className={`text-[10px] px-1.5 py-0.5 rounded ${theme === 'dark' ? 'bg-slate-700/50 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                                  {k}: {val}
                                </span>
                              ))}
                            </div>
                            <div className="flex gap-3 mt-1">
                              <span className={`text-xs ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>{formatCurrency(Number(v.sellingPrice))}</span>
                              <span className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Stock: {v.stockQuantity}</span>
                              {v.barcode && <span className={`text-xs font-mono ${theme === 'dark' ? 'text-slate-600' : 'text-slate-300'}`}>{v.barcode}</span>}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => {
                              setEditingVariant(v);
                              setVariantForm({
                                name: v.name, sku: v.sku || '', barcode: v.barcode || '',
                                costPrice: String(v.costPrice), sellingPrice: String(v.sellingPrice),
                                wholesalePrice: String(v.wholesalePrice), stockQuantity: String(v.stockQuantity),
                                attributes: v.attributes || '{}',
                              });
                            }} className={`p-1.5 rounded-lg ${theme === 'dark' ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            {can('deleteProducts') && <button onClick={() => setVariantDeleteTarget(v)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>}
                          </div>
                        </div>
                      );
                    })}

                    {/* Add/Edit Variant Form */}
                    <div className={`p-3 rounded-xl border-2 border-dashed ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
                      <p className={`text-xs font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                        {editingVariant ? 'Edit Variant' : 'Add Variant'} (e.g. color, storage)
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <input value={variantForm.name} onChange={e => setVariantForm(f => ({ ...f, name: e.target.value }))}
                          placeholder="Variant name (e.g. Red 256GB)" className={`${inputClass} text-sm !py-2`} />
                        <input value={variantForm.attributes} onChange={e => setVariantForm(f => ({ ...f, attributes: e.target.value }))}
                          placeholder='{"color":"Red","storage":"256GB"}' className={`${inputClass} text-sm !py-2 font-mono`} />
                        <div className="flex gap-1">
                          <input value={variantForm.barcode} onChange={e => setVariantForm(f => ({ ...f, barcode: e.target.value }))}
                            placeholder="Barcode" className={`${inputClass} text-sm !py-2 flex-1`} />
                          <button onClick={generateVariantBarcode} className="px-2 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg">
                            <Barcode className="w-4 h-4" />
                          </button>
                        </div>
                        <input value={variantForm.sku} onChange={e => setVariantForm(f => ({ ...f, sku: e.target.value }))}
                          placeholder="SKU" className={`${inputClass} text-sm !py-2`} />
                        <input type="number" value={variantForm.costPrice} onChange={e => setVariantForm(f => ({ ...f, costPrice: e.target.value }))}
                          placeholder="Cost Price" className={`${inputClass} text-sm !py-2`} />
                        <input type="number" value={variantForm.sellingPrice} onChange={e => setVariantForm(f => ({ ...f, sellingPrice: e.target.value }))}
                          placeholder="Selling Price" className={`${inputClass} text-sm !py-2`} />
                        <input type="number" value={variantForm.wholesalePrice} onChange={e => setVariantForm(f => ({ ...f, wholesalePrice: e.target.value }))}
                          placeholder="Wholesale Price" className={`${inputClass} text-sm !py-2`} />
                        <input type="number" value={variantForm.stockQuantity} onChange={e => setVariantForm(f => ({ ...f, stockQuantity: e.target.value }))}
                          placeholder="Stock Qty" className={`${inputClass} text-sm !py-2`} />
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button onClick={handleSaveVariant} disabled={savingVariant}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg text-xs font-medium disabled:opacity-50">
                          {savingVariant ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                          {editingVariant ? 'Update' : 'Add'} Variant
                        </button>
                        {editingVariant && (
                          <button onClick={resetVariantForm} className={`px-3 py-1.5 rounded-lg text-xs ${
                            theme === 'dark' ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'
                          }`}>Cancel</button>
                        )}
                        <button onClick={() => {
                          // Copy parent product prices as defaults
                          setVariantForm(f => ({
                            ...f,
                            costPrice: f.costPrice || form.costPrice,
                            sellingPrice: f.sellingPrice || form.sellingPrice,
                            wholesalePrice: f.wholesalePrice || form.wholesalePrice,
                          }));
                        }} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs ${
                          theme === 'dark' ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'
                        }`}>
                          <Copy className="w-3 h-3" /> Copy Parent Prices
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            </div>
            </div>

            <div className={`flex-shrink-0 flex justify-end gap-3 px-6 py-4 border-t ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
              <button onClick={() => setModalOpen(false)} className={`px-4 py-2 rounded-xl ${
                theme === 'dark' ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}>Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium disabled:opacity-50">
                {saving ? 'Saving...' : hasVariants && !editProduct ? 'Save & Add Variants' : editProduct ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmationModal isOpen={!!deleteTarget} title="Deactivate Product"
        message="Are you sure you want to deactivate this product? It will be hidden from listings."
        itemName={deleteTarget?.name} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} isLoading={deleting} />

      <DeleteConfirmationModal isOpen={!!variantDeleteTarget} title="Delete Variant"
        message="Are you sure you want to delete this variant? This cannot be undone."
        itemName={variantDeleteTarget?.name} onConfirm={handleDeleteVariant} onCancel={() => setVariantDeleteTarget(null)} />
    </div>
  );
};
export default Products;
