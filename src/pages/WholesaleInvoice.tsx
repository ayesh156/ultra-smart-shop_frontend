import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { ShoppingCart, Search, Plus, Minus, Trash2, Barcode, User, UserPlus, CreditCard, Banknote, Sparkles, Landmark, X } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { printThermalReceipt } from '../components/ThermalReceipt';
import { ProductFormModal } from '../components/modals/ProductFormModal';
import { CustomerFormModal } from '../components/modals/CustomerFormModal';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useDropdownPosition } from '../hooks/useDropdownPosition';

interface Product {
  id: string; name: string; barcode: string | null; sku?: string | null; wholesalePrice: string; sellingPrice: string; stockQuantity: number;
  category?: { name: string } | null; brand?: { name: string } | null;
  isVariant?: boolean; variantId?: string;
}

interface Customer {
  id: string; name: string; phone: string | null; email: string | null;
}

interface CartItem {
  productId: string; variantId?: string; productName: string; barcode: string | null;
  quantity: number; unitPrice: number; discount: number; total: number;
}

const WholesaleInvoice: React.FC = () => {
  const { theme } = useTheme();
  const { user, shop, can } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paidAmount, setPaidAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showCustomProductForm, setShowCustomProductForm] = useState(false);
  const [customProduct, setCustomProduct] = useState({ name: '', price: '', cost: '', qty: 1 });
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomerIndex, setSelectedCustomerIndex] = useState(-1);
  const [selectedProductIndex, setSelectedProductIndex] = useState(-1);
  const [scanQty, setScanQty] = useState(1);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);

  const barcodeRef = useRef<HTMLInputElement>(null);
  const scanQtyRef = useRef<HTMLInputElement>(null);
  const custDropdownRef = useRef<HTMLDivElement>(null);
  const cartRef = useRef<HTMLDivElement>(null);
  const barcodeScanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const custDropPos = useDropdownPosition(custDropdownRef, showCustomerDropdown, 200, 300);

  const loadProducts = useCallback(async () => {
    try { const r = await api.get('/products'); setProducts(r.data.data || []); }
    catch { /* silent */ }
  }, []);
  useEffect(() => { loadProducts(); }, [loadProducts]);

  const loadCustomers = useCallback(async () => {
    try { const r = await api.get('/customers'); setAllCustomers(r.data.data || []); }
    catch { /* silent */ }
  }, []);
  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return [];
    const q = customerSearch.toLowerCase();
    return allCustomers.filter(c =>
      c.name.toLowerCase().includes(q) || c.phone?.includes(q) || c.email?.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [allCustomers, customerSearch]);

  useEffect(() => { setSelectedCustomerIndex(-1); }, [filteredCustomers.length]);

  const selectCustomer = useCallback((c: Customer) => {
    setCustomerName(c.name);
    setCustomerPhone(c.phone || '');
    setCustomerEmail(c.email || '');
    setSelectedCustomerId(c.id);
    setCustomerSearch('');
    setShowCustomerDropdown(false);
  }, []);

  const handleBarcodeScan = useCallback(async (code: string) => {
    if (!code.trim()) return;
    // Check local products by barcode or short code
    const local = products.find(p => p.barcode === code || p.sku === code);
    if (local) {
      setPendingProduct(local);
      setScanQty(1);
      setBarcodeInput('');
      setTimeout(() => { scanQtyRef.current?.focus(); scanQtyRef.current?.select(); }, 50);
      return;
    }
    try {
      const r = await api.get(`/products/barcode/${code}`);
      const p = r.data.data;
      setPendingProduct(p);
      setScanQty(1);
    } catch {
      toast.error('Product not found');
      setBarcodeInput('');
      setTimeout(() => { barcodeRef.current?.focus(); }, 50);
      return;
    }
    setBarcodeInput('');
    setTimeout(() => { scanQtyRef.current?.focus(); scanQtyRef.current?.select(); }, 50);
  }, [products]);

  // Add pending product to cart with the entered qty
  const handleScanAdd = useCallback(() => {
    if (!pendingProduct) return;
    const qty = scanQty || 1;
    const price = Number(pendingProduct.wholesalePrice) || Number(pendingProduct.sellingPrice);
    const cartKey = pendingProduct.variantId || pendingProduct.id;
    const existing = cart.find(i => (i.variantId || i.productId) === cartKey);
    if (existing) {
      setCart(prev => prev.map(i => (i.variantId || i.productId) === cartKey
        ? { ...i, quantity: i.quantity + qty, total: (i.quantity + qty) * i.unitPrice - i.discount } : i));
    } else {
      setCart(prev => [...prev, { productId: pendingProduct.id, variantId: pendingProduct.variantId, productName: pendingProduct.name, barcode: pendingProduct.barcode, quantity: qty, unitPrice: price, discount: 0, total: qty * price }]);
    }
    toast.success(`${pendingProduct.name} ×${qty} added`);
    setPendingProduct(null);
    setScanQty(1);
    setBarcodeInput('');
    setTimeout(() => { barcodeRef.current?.focus(); }, 50);
  }, [pendingProduct, scanQty, cart]);

  // Auto-scan: when barcode input changes, debounce 300ms then auto-lookup
  const handleBarcodeChange = useCallback((value: string) => {
    setBarcodeInput(value);
    if (barcodeScanTimer.current) clearTimeout(barcodeScanTimer.current);
    if (value.trim().length >= 3) {
      barcodeScanTimer.current = setTimeout(() => { handleBarcodeScan(value.trim()); }, 300);
    }
  }, [handleBarcodeScan]);

  const addToCart = (p: Product) => {
    const cartKey = p.variantId || p.id;
    const existing = cart.find(i => (i.variantId || i.productId) === cartKey);
    const existingIdx = cart.findIndex(i => (i.variantId || i.productId) === cartKey);
    // Use wholesale price for wholesale invoices
    const price = Number(p.wholesalePrice) || Number(p.sellingPrice);
    // Stock validation
    const currentQty = existing ? existing.quantity : 0;
    if (currentQty + 1 > p.stockQuantity) {
      toast.error(`Only ${p.stockQuantity} in stock for ${p.name}`);
      return;
    }
    if (existing) {
      setCart(prev => prev.map(i => (i.variantId || i.productId) === cartKey ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unitPrice - i.discount } : i));
      setTimeout(() => { const el = document.getElementById(`ws-qty-${existingIdx}`); if (el) { (el as HTMLInputElement).focus(); (el as HTMLInputElement).select(); } }, 50);
    } else {
      setCart(prev => [...prev, { productId: p.id, variantId: p.variantId, productName: p.name, barcode: p.barcode, quantity: 1, unitPrice: price, discount: 0, total: price }]);
      setTimeout(() => { const el = document.getElementById(`ws-qty-${cart.length}`); if (el) { (el as HTMLInputElement).focus(); (el as HTMLInputElement).select(); } }, 50);
    }
    setSearch('');
  };

  const updateQuantity = (idx: number, qty: number) => {
    if (qty < 1) return;
    setCart(prev => prev.map((item, i) => i === idx ? { ...item, quantity: qty, total: qty * item.unitPrice - item.discount } : item));
  };

  const updateItemPrice = (idx: number, price: number) => {
    setCart(prev => prev.map((item, i) => i === idx ? { ...item, unitPrice: price, total: item.quantity * price - item.discount } : item));
  };

  const removeItem = (idx: number) => setCart(prev => prev.filter((_, i) => i !== idx));

  const subtotal = cart.reduce((s, i) => s + i.total, 0);
  const total = subtotal - discount;
  const paid = paidAmount ? parseFloat(paidAmount) : total;

  const handleSubmit = async () => {
    if (cart.length === 0) { toast.error('Add items'); return; }
    if (!customerName.trim()) { toast.error('Customer name is required for wholesale'); return; }
    setProcessing(true);
    try {
      const payload = {
        type: 'WHOLESALE',
        customerName, customerPhone: customerPhone || null, customerEmail: customerEmail || null,
        items: cart.map(i => ({ productId: i.productId, variantId: i.variantId || null, productName: i.productName, barcode: i.barcode, quantity: i.quantity, unitPrice: i.unitPrice, discount: i.discount })),
        discount, discountType: 'AMOUNT', paymentMethod, paidAmount: paid, notes: notes || null,
      };
      const r = await api.post('/invoices', payload);
      const inv = r.data.data;
      toast.success(`Wholesale Invoice ${inv.invoiceNumber} created!`);

      // Auto-print receipt
      try {
        await printThermalReceipt({
          invoiceNumber: inv.invoiceNumber, customerName, customerPhone: customerPhone || null,
          items: cart.map(i => ({ productName: i.productName, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total })),
          subtotal, discount, total, paidAmount: paid, change: Math.max(0, paid - total),
          paymentMethod, cashierName: user?.name, shopName: shop?.name,
          shopAddress: shop?.address || undefined, shopPhone: shop?.phone || undefined,
          createdAt: new Date().toISOString(),
        });
      } catch { /* print blocked */ }

      setCart([]); setCustomerName(''); setCustomerPhone(''); setCustomerEmail('');
      setDiscount(0); setPaidAmount(''); setNotes(''); setSelectedCustomerId(null); setCustomerSearch(''); setScanQty(1); setPendingProduct(null);
      loadProducts(); barcodeRef.current?.focus();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed');
    } finally { setProcessing(false); }
  };

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return [];
    return products.filter(p =>
      p.stockQuantity > 0 && (p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode?.toLowerCase().includes(search.toLowerCase()))
    ).slice(0, 10);
  }, [products, search]);

  useEffect(() => { setSelectedProductIndex(-1); }, [filteredProducts.length]);

  const inputClass = `w-full px-4 py-2.5 rounded-xl border transition-all outline-none ${
    theme === 'dark' ? 'bg-slate-800/50 border-slate-700/50 text-white placeholder-slate-500 focus:border-emerald-500/50' : 'bg-white border-slate-200 text-slate-900 focus:border-emerald-500'
  }`;

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className={`text-2xl lg:text-3xl font-bold flex items-center gap-3 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
          <ShoppingCart className="w-8 h-8 text-blue-500" /> Wholesale Invoice
        </h1>
        <p className={`mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Create wholesale invoices with wholesale pricing — requires customer details</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Products */}
        <div className="lg:col-span-3 space-y-4">
          {/* Barcode scanner → find product → enter qty → add to cart */}
          <div className={`rounded-2xl border p-4 ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'}`}>
            <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
              <Barcode className="w-4 h-4 inline mr-1" /> Scan Barcode
            </label>
            <div className="flex gap-2">
              <input ref={barcodeRef} type="text" value={barcodeInput}
                onChange={e => handleBarcodeChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (barcodeScanTimer.current) clearTimeout(barcodeScanTimer.current); handleBarcodeScan(barcodeInput); }}}
                placeholder="Scan barcode or short code..."
                className={`${inputClass} flex-1`} autoFocus />
              <div className="relative w-16 sm:w-[90px]">
                <input ref={scanQtyRef} type="number" min={1} value={scanQty}
                  onChange={e => setScanQty(Math.max(1, parseInt(e.target.value) || 1))}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleScanAdd(); } }}
                  onWheel={e => (e.target as HTMLElement).blur()}
                  onFocus={e => e.target.select()}
                  className={`${inputClass} text-center font-bold text-lg ${pendingProduct ? 'border-emerald-500/50 ring-2 ring-emerald-500/20' : ''}`}
                  title="Quantity — Enter to add to cart" />
                <span className={`absolute -top-2 left-2 text-[10px] px-1 ${theme === 'dark' ? 'bg-slate-800 text-slate-500' : 'bg-white text-slate-400'}`}>QTY</span>
              </div>
            </div>
            {pendingProduct ? (
              <div className={`flex items-center justify-between mt-2 px-3 py-2 rounded-xl border ${theme === 'dark' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'}`}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className={`text-sm font-medium ${theme === 'dark' ? 'text-emerald-300' : 'text-emerald-700'}`}>{pendingProduct.name}</span>
                  <span className={`text-xs ${theme === 'dark' ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>Rs. {(Number(pendingProduct.wholesalePrice) || Number(pendingProduct.sellingPrice)).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Enter qty → press Enter</span>
                  <button onClick={() => { setPendingProduct(null); setScanQty(1); barcodeRef.current?.focus(); }}
                    className={`p-1 rounded-lg hover:bg-red-500/10 ${theme === 'dark' ? 'text-red-400' : 'text-red-500'}`}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* Search */}
          <div className={`rounded-2xl border p-4 ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'}`}>
            <div className="relative">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search products... (↑↓ navigate, Enter add)" className={`${inputClass} pl-10`} />
                </div>
              <button onClick={() => setShowAddProductModal(true)}
                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20 hover:bg-emerald-500/20 transition-all whitespace-nowrap ${!can('createProducts') ? 'hidden' : ''}`}
                title="Add new product">
                <Plus className="w-4 h-4" /> New
              </button>
              <button onClick={() => setShowCustomProductForm(!showCustomProductForm)}
                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-purple-500/10 text-purple-400 text-xs font-semibold border border-purple-500/20 hover:bg-purple-500/20 transition-all whitespace-nowrap`}
                title="Quickly add an unregistered item">
                <Plus className="w-4 h-4" /> Custom
              </button>
            </div>
            
            {showCustomProductForm && (
              <div className={`mt-3 p-3 rounded-xl border ${theme === 'dark' ? 'bg-purple-500/5 border-purple-500/20' : 'bg-purple-50 border-purple-200'}`}>
                <h4 className={`text-xs font-semibold mb-2 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-700'}`}>Quick Add Unregistered Item</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                  <input type="text" placeholder="Item Name" value={customProduct.name} onChange={e => setCustomProduct({...customProduct, name: e.target.value})} className={`${inputClass} text-sm py-1.5 px-2`} />
                  <input type="number" placeholder="Wholesale Price" value={customProduct.price} onChange={e => setCustomProduct({...customProduct, price: e.target.value})} className={`${inputClass} text-sm py-1.5 px-2`} />
                  <input type="number" placeholder="Cost Price (Opt)" value={customProduct.cost} onChange={e => setCustomProduct({...customProduct, cost: e.target.value})} className={`${inputClass} text-sm py-1.5 px-2`} />
                  <input type="number" placeholder="Qty" value={customProduct.qty} min="1" onChange={e => setCustomProduct({...customProduct, qty: parseInt(e.target.value) || 1})} className={`${inputClass} text-sm py-1.5 px-2`} />
                </div>
                <button 
                  onClick={() => {
                    if (!customProduct.name || !customProduct.price || customProduct.qty < 1) {
                      toast.error('Name and Price are required'); return;
                    }
                    const price = parseFloat(customProduct.price);
                    const cost = parseFloat(customProduct.cost) || 0;
                    setCart(prev => [...prev, { 
                      productId: '', variantId: undefined, 
                      productName: customProduct.name, barcode: null, 
                      quantity: customProduct.qty, unitPrice: price, 
                      costPrice: cost, discount: 0, 
                      total: price * customProduct.qty 
                    } as any]);
                    toast.success('Custom item added');
                    setCustomProduct({ name: '', price: '', cost: '', qty: 1 });
                    setShowCustomProductForm(false);
                    if (cartRef.current) cartRef.current.scrollTop = cartRef.current.scrollHeight;
                  }}
                  className={`w-full py-2 rounded-lg text-xs font-bold transition-all bg-purple-500 hover:bg-purple-600 text-white`}>
                  Add to Cart
                </button>
              </div>
            )}
            </div>
            {search && filteredProducts.length > 0 && (
              <div className={`mt-2 rounded-xl border max-h-60 overflow-y-auto ${theme === 'dark' ? 'border-slate-700/50 bg-slate-800' : 'border-slate-200 bg-white'}`}>
                {filteredProducts.map((p, idx) => (
                  <button key={p.id} onClick={() => addToCart(p)}
                    className={`w-full flex items-center justify-between px-4 py-3 border-b transition-all ${
                      idx === selectedProductIndex
                        ? theme === 'dark' ? 'bg-blue-500/10 border-l-2 border-l-blue-500' : 'bg-blue-50 border-l-2 border-l-blue-500'
                        : theme === 'dark' ? 'hover:bg-slate-700/50 text-white border-slate-700/30' : 'hover:bg-slate-50 border-slate-100'
                    }`}>
                    <div className="text-left">
                      <p className={`font-medium text-sm ${idx === selectedProductIndex ? 'text-blue-400' : theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{p.name}</p>
                      <p className="text-xs text-slate-500">Stock: {p.stockQuantity}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-blue-400 font-semibold text-sm">{formatCurrency(Number(p.wholesalePrice) || Number(p.sellingPrice))}</p>
                      <p className="text-xs text-slate-500">Wholesale</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cart Table */}
          <div ref={cartRef} className={`rounded-2xl border overflow-hidden ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
            <div className={`px-4 py-3 font-semibold border-b flex items-center gap-2 ${
              theme === 'dark' ? 'text-white bg-slate-800/50 border-slate-700/50' : 'text-slate-900 bg-slate-50 border-slate-200'
            }`}>
              <ShoppingCart className="w-5 h-5" /> Items ({cart.length})
            </div>
            {cart.length === 0 ? (
              <div className={`text-center py-8 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Add products for wholesale order</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={theme === 'dark' ? 'bg-slate-800/30' : 'bg-slate-50'}>
                    <tr>{['Product', 'Unit Price', 'Qty', 'Total', ''].map(h => (
                      <th key={h} className={`px-3 py-2 text-left text-xs font-semibold uppercase ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className={`divide-y ${theme === 'dark' ? 'divide-slate-700/30' : 'divide-slate-200'}`}>
                    {cart.map((item, idx) => (
                      <tr key={idx}>
                        <td className={`px-3 py-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                          <p className="font-medium text-sm">{item.productName}</p>
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" value={item.unitPrice} onChange={e => updateItemPrice(idx, Number(e.target.value) || 0)}
                            className={`w-28 px-2 py-1 rounded-lg border text-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200'}`} />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <button onClick={() => updateQuantity(idx, item.quantity - 1)} className="w-6 h-6 rounded bg-slate-700 text-white flex items-center justify-center text-xs"><Minus className="w-3 h-3" /></button>
                            <input id={`ws-qty-${idx}`} type="number" min="1" value={item.quantity}
                              onChange={e => updateQuantity(idx, parseInt(e.target.value) || 1)}
                              onFocus={e => e.target.select()}
                              className={`w-14 text-center font-semibold text-sm rounded-lg border py-1 outline-none ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700 text-white focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-900 focus:border-emerald-500'}`} />
                            <button onClick={() => updateQuantity(idx, item.quantity + 1)} className="w-6 h-6 rounded bg-slate-700 text-white flex items-center justify-center text-xs"><Plus className="w-3 h-3" /></button>
                          </div>
                        </td>
                        <td className={`px-3 py-2 font-semibold text-sm ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>{formatCurrency(item.total)}</td>
                        <td className="px-3 py-2">
                          <button onClick={() => removeItem(idx)} className="p-1 rounded hover:bg-red-500/10 text-red-400"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right: Customer + Payment */}
        <div className="lg:col-span-2 space-y-4">
          {/* Customer details (required for wholesale) */}
          <div className={`rounded-2xl border p-4 ${theme === 'dark' ? 'bg-blue-500/5 border-blue-500/20' : 'bg-blue-50 border-blue-200'}`}>
            <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 text-blue-400`}>
              <User className="w-4 h-4" /> Customer Details (Required)
            </h3>
            {selectedCustomerId ? (
              <div className="space-y-3">
                <div className={`flex items-center justify-between p-3 rounded-xl border ${theme === 'dark' ? 'bg-blue-500/5 border-blue-500/20' : 'bg-blue-50 border-blue-200'}`}>
                  <div>
                    <p className={`font-medium text-sm ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{customerName}</p>
                    <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                      {[customerPhone, customerEmail].filter(Boolean).join(' · ') || 'No contact'}
                    </p>
                  </div>
                  <button onClick={() => { setCustomerName(''); setCustomerPhone(''); setCustomerEmail(''); setSelectedCustomerId(null); }}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-all"><X className="w-4 h-4" /></button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative" ref={custDropdownRef}>
                  <div className="flex gap-2">
                    <input type="text" value={customerSearch}
                      onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      placeholder="Search customer by name or phone..."
                      className={`${inputClass} flex-1`} />
                    <button onClick={() => setShowAddCustomerModal(true)}
                      className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-blue-500/10 text-blue-400 text-xs font-semibold border border-blue-500/20 hover:bg-blue-500/20 transition-all whitespace-nowrap ${!can('createCustomers') ? 'hidden' : ''}`}
                      title="Add new customer">
                      <UserPlus className="w-4 h-4" /> New
                    </button>
                  </div>
                  {showCustomerDropdown && customerSearch && filteredCustomers.length > 0 && (
                    <div className={`absolute z-20 w-full rounded-xl border max-h-48 overflow-y-auto shadow-xl ${
                      custDropPos.openUp ? 'bottom-full mb-1' : 'top-full mt-1'
                    } ${
                      theme === 'dark' ? 'border-slate-700/50 bg-slate-800' : 'border-slate-200 bg-white'
                    }`}>
                      {filteredCustomers.map((c, idx) => (
                        <button key={c.id} onClick={() => selectCustomer(c)}
                          className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-all ${
                            idx === selectedCustomerIndex
                              ? theme === 'dark' ? 'bg-blue-500/10 border-l-2 border-l-blue-500' : 'bg-blue-50 border-l-2 border-l-blue-500'
                              : theme === 'dark' ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50'
                          } border-b ${theme === 'dark' ? 'border-slate-700/30' : 'border-slate-100'}`}>
                          <div>
                            <p className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{c.name}</p>
                            <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{c.phone || c.email || 'No contact'}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {showCustomerDropdown && customerSearch && filteredCustomers.length === 0 && (
                    <div className={`absolute z-20 w-full rounded-xl border px-4 py-3 shadow-xl ${
                      custDropPos.openUp ? 'bottom-full mb-1' : 'top-full mt-1'
                    } ${
                      theme === 'dark' ? 'border-slate-700/50 bg-slate-800 text-slate-400' : 'border-slate-200 bg-white text-slate-500'
                    }`}>
                      <p className="text-sm">No customers found</p>
                      <button onClick={() => { setShowAddCustomerModal(true); setShowCustomerDropdown(false); }}
                        className="text-xs text-blue-400 hover:text-blue-300 mt-1 flex items-center gap-1">
                        <UserPlus className="w-3 h-3" /> Create "{customerSearch}"
                      </button>
                    </div>
                  )}
                </div>
                <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer/Business name *" className={inputClass} />
                <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Phone number" className={inputClass} />
                <input value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="Email" className={inputClass} />
              </div>
            )}
          </div>

          {/* Payment Summary */}
          <div className={`rounded-2xl border p-4 ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'}`}>
            <h3 className={`text-sm font-semibold mb-3 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Payment</h3>
            <div className="space-y-3">
              <div className="flex justify-between"><span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Subtotal</span><span className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{formatCurrency(subtotal)}</span></div>
              <div className="flex items-center gap-3">
                <span className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Discount</span>
                <input type="number" value={discount} onChange={e => setDiscount(Number(e.target.value) || 0)} className={`${inputClass} w-32 text-right`} />
              </div>
              <div className={`flex justify-between pt-3 border-t ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
                <span className="text-lg font-bold text-blue-400">Total</span>
                <span className="text-2xl font-bold text-blue-400">{formatCurrency(total)}</span>
              </div>
              <div>
                <label className={`block text-sm mb-1.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'CASH', label: 'Cash', icon: <Banknote className="w-4 h-4" /> },
                    { value: 'CARD', label: 'Card', icon: <CreditCard className="w-4 h-4" /> },
                    { value: 'BANK_TRANSFER', label: 'Bank Transfer', icon: <Landmark className="w-4 h-4" /> },
                    { value: 'MIXED', label: 'Mixed', icon: <Sparkles className="w-4 h-4" /> },
                  ].map(m => (
                    <button key={m.value} onClick={() => setPaymentMethod(m.value)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium border transition-all ${
                        paymentMethod === m.value
                          ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 shadow-lg shadow-blue-500/5'
                          : theme === 'dark' ? 'border-slate-700/50 text-slate-400 hover:border-slate-600 hover:text-white' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}>{m.icon}{m.label}</button>
                  ))}
                </div>
              </div>
              <input type="number" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} placeholder={`Paid amount (${formatCurrency(total)})`} className={inputClass} />
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes..." rows={2} className={inputClass} />
            </div>
          </div>

          <button onClick={handleSubmit} disabled={processing || cart.length === 0}
            className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold rounded-xl shadow-lg hover:shadow-blue-500/25 transition-all disabled:opacity-50 text-lg">
            {processing ? 'Processing...' : `Create Wholesale Invoice — ${formatCurrency(total)}`}
          </button>
        </div>
      </div>

      <ProductFormModal isOpen={showAddProductModal} onClose={() => setShowAddProductModal(false)}
        initialName={search}
        onProductCreated={(p) => {
          setProducts(prev => [p as Product, ...prev]);
          addToCart(p as Product);
          loadProducts();
        }} />

      <CustomerFormModal isOpen={showAddCustomerModal} onClose={() => setShowAddCustomerModal(false)}
        initialName={customerSearch || customerName} initialPhone={customerPhone}
        onCustomerSaved={(c) => {
          selectCustomer(c);
          loadCustomers();
        }} />
    </div>
  );
};
export default WholesaleInvoice;
