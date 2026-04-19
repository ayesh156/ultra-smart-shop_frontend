import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { X, Package, Save, Loader2, Barcode, Layers, Plus, Edit, Trash2, Copy, ChevronDown, ToggleLeft, ToggleRight, Info } from 'lucide-react';
import { SearchableSelect, type SelectOption } from '../ui/SearchableSelect';
import { formatCurrency } from '../../lib/utils';
import api from '../../lib/api';
import toast from 'react-hot-toast';

interface Category { id: string; name: string; }
interface Brand { id: string; name: string; }
interface Variant {
  id: string;
  name: string;
  attributes: string;
  sku: string | null;
  barcode: string | null;
  costPrice: string;
  sellingPrice: string;
  wholesalePrice: string;
  stockQuantity: number;
  isActive: boolean;
}

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductCreated: (product: {
    id: string; name: string; barcode: string | null;
    sellingPrice: string; wholesalePrice: string; stockQuantity: number;
    category: { name: string } | null; brand: { name: string } | null;
  }) => void;
  initialName?: string;
  editProductId?: string | null; // If provided, opens in edit mode
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen, onClose, onProductCreated, initialName = '', editProductId = null
}) => {
  const { theme } = useTheme();
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', sku: '', barcode: '', costPrice: '', sellingPrice: '', wholesalePrice: '',
    stockQuantity: '1', minStockLevel: '5', categoryId: '', brandId: '', addStock: '',
  });

  // Variants
  const [variants, setVariants] = useState<Variant[]>([]);
  const [showVariants, setShowVariants] = useState(false);
  const [variantForm, setVariantForm] = useState({ name: '', sku: '', barcode: '', costPrice: '', sellingPrice: '', wholesalePrice: '', stockQuantity: '0', attributes: '' });
  const [editingVariant, setEditingVariant] = useState<Variant | null>(null);
  const [savingVariant, setSavingVariant] = useState(false);
  const [barcodeChecking, setBarcodeChecking] = useState(false);
  const [barcodeError, setBarcodeError] = useState('');
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Has Variants toggle (skip main pricing/stock, go to variants)
  const [hasVariants, setHasVariants] = useState(false);
  const [localEditId, setLocalEditId] = useState<string | null>(null);
  const effectiveEditId = editProductId || localEditId;

  useEffect(() => {
    if (isOpen) {
      Promise.all([api.get('/categories'), api.get('/brands')]).then(([cRes, bRes]) => {
        setCategories(cRes.data.data || []);
        setBrands(bRes.data.data || []);
      }).catch(() => {});

      if (editProductId) {
        // Load existing product
        api.get(`/products/${editProductId}`).then(r => {
          const p = r.data.data;
          setForm({
            name: p.name, description: p.description || '', sku: p.sku || '',
            barcode: p.barcode || '', costPrice: String(p.costPrice), sellingPrice: String(p.sellingPrice),
            wholesalePrice: String(p.wholesalePrice), stockQuantity: String(p.stockQuantity),
            minStockLevel: String(p.minStockLevel), categoryId: p.categoryId || '', brandId: p.brandId || '', addStock: '',
          });
          setBarcodeError('');
        }).catch(() => {});
        // Load variants
        api.get(`/variants/product/${editProductId}`).then(r => {
          const v = r.data.data || [];
          setVariants(v);
          if (v.length > 0) { setHasVariants(true); setShowVariants(true); }
        }).catch(() => setVariants([]));
      } else {
        setForm(f => ({ ...f, name: initialName }));
        setVariants([]);
        setShowVariants(false);
        setHasVariants(false);
        setLocalEditId(null);
        setBarcodeError('');
      }
    }
  }, [isOpen, initialName, editProductId]);

  useEffect(() => {
    if (!isOpen || (hasVariants && !effectiveEditId)) return;
    const timer = window.setTimeout(() => {
      barcodeInputRef.current?.focus();
      barcodeInputRef.current?.select();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [isOpen, hasVariants, effectiveEditId]);

  const checkBarcodeAvailability = useCallback(async (rawValue: string, silent = false): Promise<boolean> => {
    const value = rawValue.trim();
    if (!value) {
      setBarcodeError('');
      return true;
    }

    try {
      setBarcodeChecking(true);
      const r = await api.get(`/products/barcode-availability/${encodeURIComponent(value)}`, {
        params: effectiveEditId ? { excludeProductId: effectiveEditId } : undefined,
      });

      if (!r.data?.data?.available) {
        const msg = 'This barcode already exists. Please use a unique barcode.';
        setBarcodeError(msg);
        setForm(prev => ({ ...prev, barcode: '' }));
        if (!silent) toast.error(msg);
        window.setTimeout(() => barcodeInputRef.current?.focus(), 0);
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
  }, [effectiveEditId]);

  const generateBarcode = useCallback(async () => {
    try {
      const r = await api.post('/shop/generate-barcode');
      setForm(f => ({ ...f, barcode: r.data.data.barcode }));
    } catch {
      setForm(f => ({ ...f, barcode: String(Date.now()).slice(-10) }));
    }
  }, []);

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
    if (!hasVariants && !effectiveEditId && (!form.sellingPrice || Number(form.sellingPrice) <= 0)) {
      toast.error('Selling price is required'); return;
    }
    setSaving(true);
    try {
      if (!hasVariants && form.barcode.trim()) {
        const available = await checkBarcodeAvailability(form.barcode, true);
        if (!available) {
          toast.error('Please enter a new unique barcode before saving.');
          setSaving(false);
          return;
        }
      }

      const addStockVal = parseInt(form.addStock || '0') || 0;
      const computedStock = effectiveEditId
        ? (parseInt(form.stockQuantity) || 0) + addStockVal
        : (parseInt(form.stockQuantity) || 0);
      const payload = {
        name: form.name, description: form.description || null, sku: hasVariants ? null : (form.sku || null),
        barcode: hasVariants ? null : (form.barcode || null),
        costPrice: hasVariants ? 0 : (parseFloat(form.costPrice) || 0),
        sellingPrice: hasVariants ? 0 : (parseFloat(form.sellingPrice) || 0),
        wholesalePrice: hasVariants ? 0 : (parseFloat(form.wholesalePrice) || 0),
        stockQuantity: hasVariants ? 0 : computedStock,
        minStockLevel: parseInt(form.minStockLevel) || 5,
        categoryId: form.categoryId || null, brandId: form.brandId || null,
      };
      let created;
      if (effectiveEditId) {
        const r = await api.put(`/products/${effectiveEditId}`, payload);
        created = r.data.data;
        toast.success(`${created.name} updated!`);
      } else {
        const r = await api.post('/products', payload);
        created = r.data.data;
        toast.success(`${created.name} created!`);
      }

      // If hasVariants and just created, stay open for variants
      if (hasVariants && !effectiveEditId) {
        setLocalEditId(created.id);
        setShowVariants(true);
        toast.success('Now add variants below');
        setSaving(false);
        return;
      }

      onProductCreated(created);
      resetForm();
      onClose();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save product');
    } finally { setSaving(false); }
  };

  const resetForm = () => {
    setForm({ name: '', description: '', sku: '', barcode: '', costPrice: '', sellingPrice: '', wholesalePrice: '', stockQuantity: '1', minStockLevel: '5', categoryId: '', brandId: '', addStock: '' });
    setVariants([]); setShowVariants(false); setEditingVariant(null); setHasVariants(false); setLocalEditId(null);
    setVariantForm({ name: '', sku: '', barcode: '', costPrice: '', sellingPrice: '', wholesalePrice: '', stockQuantity: '0', attributes: '' });
  };

  const handleClose = async () => {
    if (localEditId) {
      // User created a product and added variants — pass back to parent
      try {
        const r = await api.get(`/products/${localEditId}`);
        onProductCreated(r.data.data);
      } catch { /* silent */ }
    }
    resetForm();
    onClose();
  };

  const handleSaveVariant = async () => {
    if (!effectiveEditId) { toast.error('Save the product first, then add variants'); return; }
    if (!variantForm.name.trim()) { toast.error('Variant name is required'); return; }
    setSavingVariant(true);
    try {
      const payload = {
        productId: effectiveEditId, name: variantForm.name,
        attributes: variantForm.attributes || '{}',
        sku: variantForm.sku || null, barcode: variantForm.barcode || null,
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
      const r = await api.get(`/variants/product/${effectiveEditId}`);
      setVariants(r.data.data || []);
      setEditingVariant(null);
      setVariantForm({ name: '', sku: '', barcode: '', costPrice: '', sellingPrice: '', wholesalePrice: '', stockQuantity: '0', attributes: '' });
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save variant');
    } finally { setSavingVariant(false); }
  };

  const handleDeleteVariant = async (variantId: string) => {
    try {
      await api.delete(`/variants/${variantId}`);
      toast.success('Variant deleted');
      if (effectiveEditId) {
        const r = await api.get(`/variants/product/${effectiveEditId}`);
        setVariants(r.data.data || []);
      }
    } catch (err: unknown) { toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to delete variant'); }
  };

  if (!isOpen) return null;

  const inputClass = `w-full px-3 py-2.5 rounded-xl border text-sm transition-all outline-none ${
    theme === 'dark' ? 'bg-slate-800/50 border-slate-700/50 text-white placeholder-slate-500 focus:border-emerald-500/50' : 'bg-white border-slate-200 text-slate-900 focus:border-emerald-500'
  }`;
  const labelClass = `block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onWheel={e => { if ((e.target as HTMLElement).closest('input[type="number"]')) e.preventDefault(); }}>
      <div className={`relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl ${
        theme === 'dark' ? 'bg-slate-900 border-slate-700/50' : 'bg-white border-slate-200'
      }`}>
        {/* Header */}
        <div className={`flex-shrink-0 flex items-center justify-between px-6 py-4 border-b ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {effectiveEditId ? 'Edit Product' : 'Add Product'}
              </h2>
              <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                {effectiveEditId ? 'Update product details & variants' : 'Create a new product'}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className={`p-2 rounded-xl transition-all ${
            theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
          }`}><X className="w-5 h-5" /></button>
        </div>

        {/* Form */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
          <div>
            <label className={labelClass}>Product Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. iPhone 15 Pro Max" className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2} placeholder="Product description..." className={inputClass} />
          </div>

          {/* Has Variants Toggle */}
          <div className={`flex items-center justify-between p-3 rounded-xl border ${
            hasVariants
              ? theme === 'dark' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'
              : theme === 'dark' ? 'bg-slate-800/30 border-slate-700/50' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center gap-2">
              <Layers className={`w-4 h-4 ${hasVariants ? 'text-emerald-500' : theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} />
              <div>
                <p className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  {hasVariants && effectiveEditId ? 'This product has variants' : 'Has Variants?'}
                </p>
                <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                  {hasVariants && effectiveEditId
                    ? `${variants.length} variant(s) — pricing & stock managed per variant`
                    : 'e.g. colors, storage, RAM — each variant has its own pricing & stock'}
                </p>
              </div>
            </div>
            {!(hasVariants && effectiveEditId) && (
              <button onClick={() => setHasVariants(!hasVariants)} type="button" className="flex-shrink-0">
                {hasVariants
                  ? <ToggleRight className="w-8 h-8 text-emerald-500" />
                  : <ToggleLeft className={`w-8 h-8 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
                }
              </button>
            )}
            {hasVariants && effectiveEditId && (
              <div className="flex-shrink-0">
                <Layers className="w-5 h-5 text-emerald-500" />
              </div>
            )}
          </div>

          {/* Short Code & Barcode — hidden when hasVariants */}
          {!hasVariants && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Short Code</label>
              <input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                placeholder="e.g. A1 or IP15" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Barcode</label>
              <div className="flex gap-2">
                <input
                  ref={barcodeInputRef}
                  value={form.barcode}
                  onChange={e => {
                    setForm(f => ({ ...f, barcode: e.target.value }));
                    if (barcodeError) setBarcodeError('');
                  }}
                  onBlur={() => { void checkBarcodeAvailability(form.barcode); }}
                  placeholder="Scan or generate"
                  className={`${inputClass} flex-1 ${barcodeError ? 'border-red-500/60 focus:border-red-500' : ''}`}
                />
                <button onClick={generateBarcode} className="px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm">
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

          {/* Pricing — hidden when hasVariants */}
          {!hasVariants && (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Cost Price (Rs.)</label>
              <input type="number" value={form.costPrice} onChange={e => setForm(f => ({ ...f, costPrice: e.target.value }))} onWheel={e => (e.target as HTMLElement).blur()} placeholder="0" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Selling Price (Rs.) *</label>
              <input type="number" value={form.sellingPrice} onChange={e => setForm(f => ({ ...f, sellingPrice: e.target.value }))} onWheel={e => (e.target as HTMLElement).blur()} placeholder="0" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Wholesale Price (Rs.)</label>
              <input type="number" value={form.wholesalePrice} onChange={e => setForm(f => ({ ...f, wholesalePrice: e.target.value }))} onWheel={e => (e.target as HTMLElement).blur()} placeholder="0" className={inputClass} />
            </div>
          </div>
          )}

          {/* Stock — hidden when hasVariants */}
          {!hasVariants && (
          <div className={`grid gap-3 ${effectiveEditId ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {effectiveEditId && (
            <div>
              <label className={labelClass}>Current Stock</label>
              <input type="number" value={form.stockQuantity} readOnly
                className={`${inputClass} cursor-not-allowed opacity-60`} />
            </div>
            )}
            <div>
              <label className={labelClass}>{effectiveEditId ? 'Add Stock (+)' : 'Stock Quantity'}</label>
              <input type="number" value={effectiveEditId ? form.addStock : form.stockQuantity}
                onChange={e => effectiveEditId
                  ? setForm(f => ({ ...f, addStock: e.target.value }))
                  : setForm(f => ({ ...f, stockQuantity: e.target.value }))}
                onWheel={e => (e.target as HTMLElement).blur()}
                placeholder={effectiveEditId ? '0' : '1'} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Min Stock Level</label>
              <input type="number" value={form.minStockLevel} onChange={e => setForm(f => ({ ...f, minStockLevel: e.target.value }))} onWheel={e => (e.target as HTMLElement).blur()} className={inputClass} />
            </div>
          </div>
          )}

          {/* Info box when hasVariants is ON and creating new */}
          {hasVariants && !localEditId && !editProductId && (
            <div className={`flex items-start gap-3 p-3 rounded-xl border ${
              theme === 'dark' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-200'
            }`}>
              <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className={`text-xs ${theme === 'dark' ? 'text-blue-300' : 'text-blue-700'}`}>
                <p className="font-medium">Variants handle pricing & stock</p>
                <p className="mt-0.5 opacity-80">Save the product first, then you'll be able to add variants with individual barcodes, prices and stock quantities.</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Category</label>
              <SearchableSelect
                options={[{ value: '', label: 'No Category' }, ...categories.map(c => ({ value: c.id, label: c.name }))] as SelectOption[]}
                value={form.categoryId} onValueChange={v => setForm(f => ({ ...f, categoryId: v }))}
                placeholder="Select Category" searchPlaceholder="Search categories..."
              />
            </div>
            <div>
              <label className={labelClass}>Brand</label>
              <SearchableSelect
                options={[{ value: '', label: 'No Brand' }, ...brands.map(b => ({ value: b.id, label: b.name }))] as SelectOption[]}
                value={form.brandId} onValueChange={v => setForm(f => ({ ...f, brandId: v }))}
                placeholder="Select Brand" searchPlaceholder="Search brands..."
              />
            </div>
          </div>

          {/* Variants Section */}
          {effectiveEditId && (
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
                <div className="mt-3 space-y-2">
                  {variants.map(v => {
                    let attrs: Record<string, string> = {};
                    try { attrs = JSON.parse(v.attributes); } catch { /* */ }
                    return (
                      <div key={v.id} className={`flex items-center gap-3 p-3 rounded-xl border ${
                        theme === 'dark' ? 'bg-slate-900/50 border-slate-700/50' : 'bg-white border-slate-200'
                      }`}>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{v.name}</p>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {Object.entries(attrs).map(([k, val]) => (
                              <span key={k} className={`text-[10px] px-1.5 py-0.5 rounded ${theme === 'dark' ? 'bg-slate-700/50 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                                {k}: {val}
                              </span>
                            ))}
                          </div>
                          <div className="flex gap-3 mt-0.5">
                            <span className={`text-xs ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>{formatCurrency(Number(v.sellingPrice))}</span>
                            <span className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Stock: {v.stockQuantity}</span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => {
                            setEditingVariant(v);
                            setVariantForm({ name: v.name, sku: v.sku || '', barcode: v.barcode || '', costPrice: String(v.costPrice), sellingPrice: String(v.sellingPrice), wholesalePrice: String(v.wholesalePrice), stockQuantity: String(v.stockQuantity), attributes: v.attributes || '{}' });
                          }} className={`p-1.5 rounded-lg ${theme === 'dark' ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDeleteVariant(v.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add/Edit Variant Form */}
                  <div className={`p-3 rounded-xl border-2 border-dashed ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
                    <p className={`text-xs font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                      {editingVariant ? 'Edit Variant' : 'Add Variant'}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <input value={variantForm.name} onChange={e => setVariantForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="e.g. Red 256GB" className={`${inputClass} !py-2`} />
                      <input value={variantForm.attributes} onChange={e => setVariantForm(f => ({ ...f, attributes: e.target.value }))}
                        placeholder='{"color":"Red","storage":"256GB"}' className={`${inputClass} !py-2 font-mono`} />
                      <div className="flex gap-1">
                        <input value={variantForm.barcode} onChange={e => setVariantForm(f => ({ ...f, barcode: e.target.value }))}
                          placeholder="Barcode" className={`${inputClass} !py-2 flex-1`} />
                        <button onClick={generateVariantBarcode} className="px-2 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg">
                          <Barcode className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <input value={variantForm.sku} onChange={e => setVariantForm(f => ({ ...f, sku: e.target.value }))}
                        placeholder="Short Code" className={`${inputClass} !py-2`} />
                      <input type="number" value={variantForm.costPrice} onChange={e => setVariantForm(f => ({ ...f, costPrice: e.target.value }))}
                        onWheel={e => (e.target as HTMLElement).blur()} placeholder="Cost Price" className={`${inputClass} !py-2`} />
                      <input type="number" value={variantForm.sellingPrice} onChange={e => setVariantForm(f => ({ ...f, sellingPrice: e.target.value }))}
                        onWheel={e => (e.target as HTMLElement).blur()} placeholder="Selling Price" className={`${inputClass} !py-2`} />
                      <input type="number" value={variantForm.wholesalePrice} onChange={e => setVariantForm(f => ({ ...f, wholesalePrice: e.target.value }))}
                        onWheel={e => (e.target as HTMLElement).blur()} placeholder="Wholesale" className={`${inputClass} !py-2`} />
                      <input type="number" value={variantForm.stockQuantity} onChange={e => setVariantForm(f => ({ ...f, stockQuantity: e.target.value }))}
                        onWheel={e => (e.target as HTMLElement).blur()} placeholder="Stock Qty" className={`${inputClass} !py-2`} />
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button onClick={handleSaveVariant} disabled={savingVariant}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg text-xs font-medium disabled:opacity-50">
                        {savingVariant ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                        {editingVariant ? 'Update' : 'Add'} Variant
                      </button>
                      {editingVariant && (
                        <button onClick={() => { setEditingVariant(null); setVariantForm({ name: '', sku: '', barcode: '', costPrice: '', sellingPrice: '', wholesalePrice: '', stockQuantity: '0', attributes: '' }); }}
                          className={`px-3 py-1.5 rounded-lg text-xs ${theme === 'dark' ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>Cancel</button>
                      )}
                      <button onClick={() => setVariantForm(f => ({ ...f, costPrice: f.costPrice || form.costPrice, sellingPrice: f.sellingPrice || form.sellingPrice, wholesalePrice: f.wholesalePrice || form.wholesalePrice }))}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs ${theme === 'dark' ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>
                        <Copy className="w-3 h-3" /> Copy Parent Prices
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex-shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
          <button onClick={handleClose} className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            theme === 'dark' ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'
          }`}>{localEditId ? 'Done' : 'Cancel'}</button>
          {!localEditId && (
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : hasVariants && !effectiveEditId ? 'Save & Add Variants' : effectiveEditId ? 'Update Product' : 'Save & Add to Cart'}
          </button>
          )}
        </div>
      </div>
    </div>
  );
};
