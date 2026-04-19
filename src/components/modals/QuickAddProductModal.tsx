import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { X, Package, Save, Loader2 } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

interface Category { id: string; name: string; }
interface Brand { id: string; name: string; }

interface QuickAddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductCreated: (product: { id: string; name: string; barcode: string | null; sellingPrice: string; wholesalePrice: string; stockQuantity: number; category: { name: string } | null; brand: { name: string } | null; }) => void;
  initialName?: string;
}

export const QuickAddProductModal: React.FC<QuickAddProductModalProps> = ({ isOpen, onClose, onProductCreated, initialName = '' }) => {
  const { theme } = useTheme();
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', barcode: '', costPrice: '', sellingPrice: '', wholesalePrice: '',
    stockQuantity: '1', minStockLevel: '5', categoryId: '', brandId: '',
  });

  useEffect(() => {
    if (isOpen) {
      setForm(f => ({ ...f, name: initialName }));
      Promise.all([api.get('/categories'), api.get('/brands')]).then(([cRes, bRes]) => {
        setCategories(cRes.data.data || []);
        setBrands(bRes.data.data || []);
      }).catch(() => {});
    }
  }, [isOpen, initialName]);

  const generateBarcode = useCallback(async () => {
    try {
      const r = await api.post('/shop/generate-barcode');
      setForm(f => ({ ...f, barcode: r.data.data.barcode }));
    } catch {
      setForm(f => ({ ...f, barcode: String(Date.now()).slice(-10) }));
    }
  }, []);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Product name is required'); return; }
    if (!form.sellingPrice || Number(form.sellingPrice) <= 0) { toast.error('Selling price is required'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name, barcode: form.barcode || null,
        costPrice: parseFloat(form.costPrice) || 0,
        sellingPrice: parseFloat(form.sellingPrice) || 0,
        wholesalePrice: parseFloat(form.wholesalePrice) || 0,
        stockQuantity: parseInt(form.stockQuantity) || 0,
        minStockLevel: parseInt(form.minStockLevel) || 5,
        categoryId: form.categoryId || null, brandId: form.brandId || null,
      };
      const r = await api.post('/products', payload);
      const created = r.data.data;
      toast.success(`${created.name} created!`);
      onProductCreated(created);
      setForm({ name: '', barcode: '', costPrice: '', sellingPrice: '', wholesalePrice: '', stockQuantity: '1', minStockLevel: '5', categoryId: '', brandId: '' });
      onClose();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create product');
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
      <div className={`relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl ${
        theme === 'dark' ? 'bg-slate-900 border-slate-700/50' : 'bg-white border-slate-200'
      }`}>
        {/* Header */}
        <div className={`flex-shrink-0 flex items-center justify-between px-5 py-4 border-b ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Quick Add Product</h2>
              <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Add product and continue checkout</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className={labelClass}>Product Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. iPhone 15 Pro Max 256GB" className={inputClass} autoFocus />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelClass}>Barcode</label>
              <div className="flex gap-2">
                <input value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))} placeholder="Barcode" className={inputClass} />
                <button onClick={generateBarcode} className="px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-all whitespace-nowrap border border-emerald-500/20">
                  Auto
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Cost Price</label>
              <input type="number" value={form.costPrice} onChange={e => setForm(f => ({ ...f, costPrice: e.target.value }))} placeholder="0.00" onWheel={e => (e.target as HTMLElement).blur()} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Selling Price *</label>
              <input type="number" value={form.sellingPrice} onChange={e => setForm(f => ({ ...f, sellingPrice: e.target.value }))} placeholder="0.00" onWheel={e => (e.target as HTMLElement).blur()} className={`${inputClass} ring-1 ring-emerald-500/20`} />
            </div>
            <div>
              <label className={labelClass}>Wholesale Price</label>
              <input type="number" value={form.wholesalePrice} onChange={e => setForm(f => ({ ...f, wholesalePrice: e.target.value }))} placeholder="0.00" onWheel={e => (e.target as HTMLElement).blur()} className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Stock Qty</label>
              <input type="number" value={form.stockQuantity} onChange={e => setForm(f => ({ ...f, stockQuantity: e.target.value }))} onWheel={e => (e.target as HTMLElement).blur()} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Min Stock</label>
              <input type="number" value={form.minStockLevel} onChange={e => setForm(f => ({ ...f, minStockLevel: e.target.value }))} onWheel={e => (e.target as HTMLElement).blur()} className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Category</label>
              <select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))} className={inputClass}>
                <option value="">None</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Brand</label>
              <select value={form.brandId} onChange={e => setForm(f => ({ ...f, brandId: e.target.value }))} className={inputClass}>
                <option value="">None</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`flex-shrink-0 flex items-center justify-end gap-3 px-5 py-4 border-t ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
          <button onClick={onClose} className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            theme === 'dark' ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'
          }`}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save & Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  );
};
