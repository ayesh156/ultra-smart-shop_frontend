import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import {
  Zap, Search, Plus, Minus, Trash2, Barcode, ShoppingCart, User,
  Keyboard, Volume2, VolumeX, CreditCard, Banknote, Printer,
  Receipt, Sparkles, X, UserPlus
} from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { ShortcutOverlay, ShortcutHintsBar } from '../components/ShortcutOverlay';
import { printThermalReceipt } from '../components/ThermalReceipt';
import { ProductFormModal } from '../components/modals/ProductFormModal';
import { CustomerFormModal } from '../components/modals/CustomerFormModal';
import { useDropdownPosition } from '../hooks/useDropdownPosition';

interface Product {
  id: string; name: string; barcode: string | null; sku?: string | null; sellingPrice: string; wholesalePrice?: string; stockQuantity: number;
  category: { name: string } | null; brand: { name: string } | null;
  isVariant?: boolean; variantId?: string;
}

interface Customer {
  id: string; name: string; phone: string | null; email: string | null;
}

interface CartItem {
  productId: string; variantId?: string; productName: string; barcode: string | null;
  quantity: number; unitPrice: number; discount: number; total: number;
}

const QuickInvoice: React.FC = () => {
  const { theme } = useTheme();
  const { user, shop, can } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'AMOUNT' | 'PERCENTAGE'>('AMOUNT');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paidAmount, setPaidAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedProductIndex, setSelectedProductIndex] = useState(-1);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showCustomProductForm, setShowCustomProductForm] = useState(false);
  const [customProduct, setCustomProduct] = useState({ name: '', price: '', cost: '', qty: 1 });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomerIndex, setSelectedCustomerIndex] = useState(-1);
  const [lastInvoice, setLastInvoice] = useState<{
    invoiceNumber: string; items: CartItem[]; subtotal: number; discount: number;
    total: number; paidAmount: number; change: number; paymentMethod: string;
    customerName: string; customerPhone: string; createdAt: string;
  } | null>(null);

  const [scanQty, setScanQty] = useState(1);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const scanQtyRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const discountRef = useRef<HTMLInputElement>(null);
  const paidRef = useRef<HTMLInputElement>(null);
  const cartRef = useRef<HTMLDivElement>(null);
  const customerSearchRef = useRef<HTMLInputElement>(null);
  const custDropdownRef = useRef<HTMLDivElement>(null);
  const barcodeScanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const custDropPos = useDropdownPosition(custDropdownRef, showCustomerDropdown, 200, 300);

  // Sound feedback
  const playBeep = useCallback((type: 'add' | 'remove' | 'error' | 'success') => {
    if (!soundEnabled) return;
    const freq: Record<string, number> = { add: 800, remove: 400, error: 200, success: 1000 };
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq[type]; osc.type = 'sine'; gain.gain.value = 0.1;
      osc.start(); osc.stop(ctx.currentTime + 0.1);
    } catch { /* audio not supported */ }
  }, [soundEnabled]);

  const loadProducts = useCallback(async () => {
    try { const r = await api.get('/products'); setProducts(r.data.data || []); }
    catch { /* silent */ }
  }, []);
  useEffect(() => { loadProducts(); }, [loadProducts]);

  const loadCustomers = useCallback(async () => {
    try { const r = await api.get('/customers'); setCustomers(r.data.data || []); }
    catch { /* silent */ }
  }, []);
  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return [];
    const q = customerSearch.toLowerCase();
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) || c.phone?.includes(q) || c.email?.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [customers, customerSearch]);

  useEffect(() => { setSelectedCustomerIndex(-1); }, [filteredCustomers.length]);

  const selectCustomer = useCallback((c: Customer) => {
    setCustomerName(c.name);
    setCustomerPhone(c.phone || '');
    setSelectedCustomerId(c.id);
    setCustomerSearch('');
    setShowCustomerDropdown(false);
  }, []);

  // Filtered products with memoization
  const filteredProducts = useMemo(() => {
    if (!search.trim()) return [];
    return products.filter(p => p.stockQuantity > 0 &&
      (p.name.toLowerCase().includes(search.toLowerCase()) ||
       p.barcode?.toLowerCase().includes(search.toLowerCase()))
    ).slice(0, 10);
  }, [products, search]);

  useEffect(() => { setSelectedProductIndex(-1); }, [filteredProducts.length]);

  // Barcode / Short Code scan handler — finds product, then focuses QTY for user to confirm
  const handleBarcodeScan = useCallback(async (code: string) => {
    if (!code.trim()) return;
    // Check local products by barcode or short code
    const local = products.find(p => p.barcode === code || p.sku === code);
    if (local) {
      playBeep('add');
      setPendingProduct(local);
      setScanQty(1);
      setBarcodeInput('');
      setTimeout(() => { scanQtyRef.current?.focus(); scanQtyRef.current?.select(); }, 50);
      return;
    }
    try {
      const r = await api.get(`/products/barcode/${code}`);
      const p = r.data.data;
      playBeep('add');
      setPendingProduct(p);
      setScanQty(1);
    } catch {
      playBeep('error'); toast.error('Product not found');
      setBarcodeInput('');
      setTimeout(() => { barcodeRef.current?.focus(); }, 50);
      return;
    }
    setBarcodeInput('');
    setTimeout(() => { scanQtyRef.current?.focus(); scanQtyRef.current?.select(); }, 50);
  }, [products, playBeep]);

  // Add pending product to cart with the entered qty
  const handleScanAdd = useCallback(() => {
    if (!pendingProduct) return;
    const qty = scanQty || 1;
    const price = Number(pendingProduct.sellingPrice);
    const cartKey = pendingProduct.variantId || pendingProduct.id;
    const existing = cart.find(i => (i.variantId || i.productId) === cartKey);
    if (existing) {
      if (existing.quantity + qty > pendingProduct.stockQuantity) {
        playBeep('error'); toast.error(`Insufficient stock: ${pendingProduct.stockQuantity} available`); return;
      }
      setCart(prev => prev.map(i => (i.variantId || i.productId) === cartKey
        ? { ...i, quantity: i.quantity + qty, total: (i.quantity + qty) * i.unitPrice - i.discount } : i));
    } else {
      if (qty > pendingProduct.stockQuantity) {
        playBeep('error'); toast.error(`Insufficient stock: ${pendingProduct.stockQuantity} available`); return;
      }
      setCart(prev => [...prev, { productId: pendingProduct.id, variantId: pendingProduct.variantId, productName: pendingProduct.name, barcode: pendingProduct.barcode, quantity: qty, unitPrice: price, discount: 0, total: qty * price }]);
    }
    playBeep('add');
    toast.success(`${pendingProduct.name} ×${qty} added`);
    setPendingProduct(null);
    setScanQty(1);
    setBarcodeInput('');
    setTimeout(() => { barcodeRef.current?.focus(); }, 50);
  }, [pendingProduct, scanQty, cart, playBeep]);

  // Auto-scan: when barcode input changes, debounce 300ms then auto-lookup
  const handleBarcodeChange = useCallback((value: string) => {
    setBarcodeInput(value);
    if (barcodeScanTimer.current) clearTimeout(barcodeScanTimer.current);
    if (value.trim().length >= 3) {
      barcodeScanTimer.current = setTimeout(() => { handleBarcodeScan(value.trim()); }, 300);
    }
  }, [handleBarcodeScan]);

  const addToCart = useCallback((p: Product) => {
    const cartKey = p.variantId || p.id;
    const existing = cart.find(i => (i.variantId || i.productId) === cartKey);
    const existingIdx = cart.findIndex(i => (i.variantId || i.productId) === cartKey);
    if (existing) {
      if (existing.quantity + 1 > p.stockQuantity) {
        playBeep('error'); toast.error(`Insufficient stock: ${p.stockQuantity} available`); return;
      }
      setCart(prev => prev.map(i => (i.variantId || i.productId) === cartKey
        ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unitPrice - i.discount } : i));
      // Focus qty input of existing item
      setTimeout(() => { const el = document.getElementById(`cart-qty-${existingIdx}`); if (el) { (el as HTMLInputElement).focus(); (el as HTMLInputElement).select(); } }, 50);
    } else {
      const price = Number(p.sellingPrice);
      setCart(prev => [...prev, { productId: p.id, variantId: p.variantId, productName: p.name, barcode: p.barcode, quantity: 1, unitPrice: price, discount: 0, total: price }]);
      // Focus qty input of newly added item (last in cart)
      setTimeout(() => {
        const el = document.getElementById(`cart-qty-${cart.length}`);
        if (el) { (el as HTMLInputElement).focus(); (el as HTMLInputElement).select(); }
        if (cartRef.current) cartRef.current.scrollTop = cartRef.current.scrollHeight;
      }, 50);
    }
    playBeep('add');
    setSearch(''); setSelectedProductIndex(-1);
  }, [cart, playBeep]);

  const updateQuantity = (idx: number, qty: number) => {
    if (qty < 1) { removeItem(idx); return; }
    setCart(prev => prev.map((item, i) => i === idx ? { ...item, quantity: qty, total: qty * item.unitPrice - item.discount } : item));
  };

  const removeItem = (idx: number) => {
    playBeep('remove');
    setCart(prev => prev.filter((_, i) => i !== idx));
  };

  const clearCart = useCallback(() => {
    setCart([]); setCustomerName(''); setCustomerPhone(''); setSelectedCustomerId(null); setCustomerSearch('');
    setDiscount(0); setDiscountType('AMOUNT'); setPaidAmount(''); setScanQty(1); setPendingProduct(null); barcodeRef.current?.focus();
  }, []);

  const subtotal = cart.reduce((s, i) => s + i.total, 0);
  const discountAmount = discountType === 'PERCENTAGE' ? (subtotal * discount / 100) : discount;
  const total = subtotal - discountAmount;
  const paid = paidAmount ? parseFloat(paidAmount) : total;
  const change = paid - total;

  // Complete sale + optional print
  const handleSubmit = useCallback(async (withPrint: boolean = true) => {
    if (cart.length === 0) { playBeep('error'); toast.error('Add items to cart'); return; }
    setProcessing(true);
    try {
      const payload = {
        type: 'QUICK', customerName: customerName || null, customerPhone: customerPhone || null,
        items: cart.map(i => ({ productId: i.productId, variantId: i.variantId || null, productName: i.productName, barcode: i.barcode, quantity: i.quantity, unitPrice: i.unitPrice, discount: i.discount })),
        discount: discountAmount, discountType, paymentMethod, paidAmount: paid,
      };
      const r = await api.post('/invoices', payload);
      const inv = r.data.data;
      playBeep('success');

      setLastInvoice({
        invoiceNumber: inv.invoiceNumber, items: [...cart], subtotal, discount: discountAmount, total,
        paidAmount: paid, change: Math.max(0, change), paymentMethod, customerName, customerPhone,
        createdAt: new Date().toISOString(),
      });

      if (withPrint) {
        try {
          await printThermalReceipt({
            invoiceNumber: inv.invoiceNumber, customerName: customerName || null, customerPhone: customerPhone || null,
            items: cart.map(i => ({ productName: i.productName, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total })),
            subtotal, discount: discountAmount, total, paidAmount: paid, change: Math.max(0, change), paymentMethod,
            cashierName: user?.name, shopName: shop?.name, shopAddress: shop?.address || undefined, shopPhone: shop?.phone || undefined,
            createdAt: new Date().toISOString(),
          });
        } catch { toast.error('Print blocked — receipt saved'); }
      }

      toast.success(`Invoice ${inv.invoiceNumber} created!`);
      setCart([]); setDiscount(0); setDiscountType('AMOUNT'); setPaidAmount(''); setCustomerName(''); setCustomerPhone(''); setSelectedCustomerId(null); setCustomerSearch(''); setScanQty(1); setPendingProduct(null);
      loadProducts(); barcodeRef.current?.focus();
    } catch (err: unknown) {
      playBeep('error');
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed');
    } finally { setProcessing(false); }
  }, [cart, customerName, customerPhone, discount, discountAmount, discountType, paymentMethod, paid, subtotal, total, change, playBeep, user, shop, loadProducts]);

  // Reprint last receipt
  const reprintLast = useCallback(async () => {
    if (!lastInvoice) { toast.error('No recent invoice to reprint'); return; }
    try {
      await printThermalReceipt({
        invoiceNumber: lastInvoice.invoiceNumber, customerName: lastInvoice.customerName || null,
        customerPhone: lastInvoice.customerPhone || null,
        items: lastInvoice.items.map(i => ({ productName: i.productName, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total })),
        subtotal: lastInvoice.subtotal, discount: lastInvoice.discount, total: lastInvoice.total,
        paidAmount: lastInvoice.paidAmount, change: lastInvoice.change, paymentMethod: lastInvoice.paymentMethod,
        cashierName: user?.name, shopName: shop?.name, createdAt: lastInvoice.createdAt,
      });
    } catch { toast.error('Print failed'); }
  }, [lastInvoice, user, shop]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      switch (e.key) {
        case 'F2': e.preventDefault(); barcodeRef.current?.focus(); barcodeRef.current?.select(); return;
        case 'F3': e.preventDefault(); searchRef.current?.focus(); searchRef.current?.select(); return;
        case 'F4': e.preventDefault(); customerSearchRef.current?.focus(); customerSearchRef.current?.select(); setShowCustomerDropdown(true); return;
        case 'F5': e.preventDefault(); paidRef.current?.focus(); paidRef.current?.select(); return;
        case 'F6': e.preventDefault(); discountRef.current?.focus(); discountRef.current?.select(); return;
        case 'F7': e.preventDefault(); setDiscountType(prev => prev === 'AMOUNT' ? 'PERCENTAGE' : 'AMOUNT'); return;
        case 'F9': e.preventDefault(); handleSubmit(false); return;
        case 'F12': e.preventDefault(); handleSubmit(true); return;
      }

      if (!isInput) {
        if (e.key === '?' || (e.key === '/' && e.shiftKey)) { e.preventDefault(); setShowShortcuts(prev => !prev); return; }
        if (e.key === 'Delete' && cart.length > 0) { e.preventDefault(); removeItem(cart.length - 1); toast.success('Last item removed'); return; }
      }

      if (e.ctrlKey) {
        if (e.key === 'Backspace') { e.preventDefault(); clearCart(); toast.success('Cart cleared'); return; }
        if (e.key === 'p' || e.key === 'P') { e.preventDefault(); reprintLast(); return; }
      }

      if (isInput && (e.target as HTMLElement) === searchRef.current && filteredProducts.length > 0) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedProductIndex(prev => Math.min(prev + 1, filteredProducts.length - 1)); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedProductIndex(prev => Math.max(prev - 1, -1)); return; }
        if (e.key === 'Enter' && selectedProductIndex >= 0) { e.preventDefault(); addToCart(filteredProducts[selectedProductIndex]); return; }
      }

      if (isInput && (e.target as HTMLElement) === customerSearchRef.current && filteredCustomers.length > 0) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedCustomerIndex(prev => Math.min(prev + 1, filteredCustomers.length - 1)); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedCustomerIndex(prev => Math.max(prev - 1, -1)); return; }
        if (e.key === 'Enter' && selectedCustomerIndex >= 0) { e.preventDefault(); selectCustomer(filteredCustomers[selectedCustomerIndex]); return; }
      }

      if (e.key === 'Escape') {
        if (showShortcuts) { setShowShortcuts(false); return; }
        if (search) { setSearch(''); return; }
        if (customerSearch) { setCustomerSearch(''); setShowCustomerDropdown(false); return; }
        if (barcodeInput) { setBarcodeInput(''); return; }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, search, barcodeInput, customerSearch, filteredProducts, filteredCustomers, selectedProductIndex, selectedCustomerIndex, showShortcuts, handleSubmit, addToCart, clearCart, reprintLast, selectCustomer, handleScanAdd]);

  const inputClass = `w-full px-4 py-2.5 rounded-xl border transition-all outline-none ${
    theme === 'dark'
      ? 'bg-slate-800/50 border-slate-700/50 text-white placeholder-slate-500 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20'
      : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
  }`;

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl lg:text-3xl font-bold flex items-center gap-3 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Zap className="w-6 h-6 text-white" />
            </div>
            Quick Invoice
          </h1>
          <p className={`mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Fast POS checkout — scan barcode or search products</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2.5 rounded-xl border transition-all ${theme === 'dark' ? 'border-slate-700/50 hover:bg-slate-800 text-slate-400 hover:text-white' : 'border-slate-200 hover:bg-slate-100 text-slate-500'}`}
            title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}>
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
          <button onClick={reprintLast} disabled={!lastInvoice}
            className={`p-2.5 rounded-xl border transition-all ${theme === 'dark' ? 'border-slate-700/50 hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30' : 'border-slate-200 hover:bg-slate-100 text-slate-500 disabled:opacity-30'}`}
            title="Reprint last receipt (Ctrl+P)">
            <Printer className="w-5 h-5" />
          </button>
          <button onClick={() => setShowShortcuts(true)}
            className={`p-2.5 rounded-xl border transition-all ${theme === 'dark' ? 'border-slate-700/50 hover:bg-slate-800 text-slate-400 hover:text-emerald-400' : 'border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-emerald-600'}`}
            title="Keyboard shortcuts (?)">
            <Keyboard className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* LEFT: Search + Cart */}
        <div className="lg:col-span-3 space-y-4">
          {/* Barcode scanner → find product → enter qty → add to cart */}
          <div className={`rounded-2xl border p-4 ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'}`}>
            <label className={`block text-sm font-medium mb-2 flex items-center gap-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
              <Barcode className="w-4 h-4" /> Scan Barcode
              <kbd className={`ml-auto text-[10px] px-1.5 py-0.5 rounded font-mono ${theme === 'dark' ? 'bg-slate-700 text-emerald-400' : 'bg-slate-100 text-emerald-600'}`}>F2</kbd>
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
                  <span className={`text-xs ${theme === 'dark' ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>Rs. {Number(pendingProduct.sellingPrice).toLocaleString()}</span>
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

          {/* Product search with keyboard nav */}
          <div className={`rounded-2xl border p-4 ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'}`}>
            <label className={`block text-sm font-medium mb-2 flex items-center gap-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
              <Search className="w-4 h-4" /> Search Products
              <kbd className={`ml-auto text-[10px] px-1.5 py-0.5 rounded font-mono ${theme === 'dark' ? 'bg-slate-700 text-emerald-400' : 'bg-slate-100 text-emerald-600'}`}>F3</kbd>
            </label>
            <div className="flex gap-2">
              <input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or barcode... (↑↓ navigate, Enter add)" className={`${inputClass} flex-1`} />
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
                  <input type="number" placeholder="Selling Price" value={customProduct.price} onChange={e => setCustomProduct({...customProduct, price: e.target.value})} className={`${inputClass} text-sm py-1.5 px-2`} />
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
                    playBeep('add');
                    setCustomProduct({ name: '', price: '', cost: '', qty: 1 });
                    setShowCustomProductForm(false);
                    if (cartRef.current) cartRef.current.scrollTop = cartRef.current.scrollHeight;
                  }}
                  className={`w-full py-2 rounded-lg text-xs font-bold transition-all bg-purple-500 hover:bg-purple-600 text-white`}>
                  Add to Cart
                </button>
              </div>
            )}
            {search && filteredProducts.length > 0 && (
              <div className={`mt-2 rounded-xl border max-h-60 overflow-y-auto ${theme === 'dark' ? 'border-slate-700/50 bg-slate-800' : 'border-slate-200 bg-white'}`}>
                {filteredProducts.map((p, idx) => (
                  <button key={p.id} onClick={() => addToCart(p)}
                    className={`w-full flex items-center justify-between px-4 py-3 transition-all ${
                      idx === selectedProductIndex
                        ? theme === 'dark' ? 'bg-emerald-500/10 border-l-2 border-l-emerald-500' : 'bg-emerald-50 border-l-2 border-l-emerald-500'
                        : theme === 'dark' ? 'hover:bg-slate-700/50 text-white' : 'hover:bg-slate-50 text-slate-900'
                    } border-b ${theme === 'dark' ? 'border-slate-700/30' : 'border-slate-100'}`}>
                    <div className="text-left">
                      <p className={`font-medium text-sm ${idx === selectedProductIndex ? 'text-emerald-400' : theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{p.name}</p>
                      <p className="text-xs text-slate-500">{p.barcode || 'No barcode'} · Stock: {p.stockQuantity}{p.category && ` · ${p.category.name}`}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-semibold text-sm">{formatCurrency(Number(p.sellingPrice))}</span>
                      {idx === selectedProductIndex && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${theme === 'dark' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>↵</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cart */}
          <div className={`rounded-2xl border overflow-hidden ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
            <div className={`px-4 py-3 flex items-center justify-between border-b ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-2">
                <ShoppingCart className={`w-5 h-5 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`} />
                <span className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Cart</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${cart.length > 0 ? 'bg-emerald-500/20 text-emerald-400' : theme === 'dark' ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>
                  {cart.length}
                </span>
              </div>
              {cart.length > 0 && (
                <button onClick={clearCart} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300" title="Ctrl+Backspace">
                  <Trash2 className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
            {cart.length === 0 ? (
              <div className={`text-center py-10 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Scan barcode or search to add items</p>
                <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-300'}`}>Press F2 to focus barcode scanner</p>
              </div>
            ) : (
              <div ref={cartRef} className="max-h-[400px] overflow-y-auto divide-y divide-slate-700/30">
                <div className={`grid grid-cols-12 gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500 bg-slate-800/30' : 'text-slate-400 bg-slate-50'}`}>
                  <div className="col-span-1">#</div><div className="col-span-4">Product</div><div className="col-span-2 text-center">Qty</div>
                  <div className="col-span-2 text-right">Price</div><div className="col-span-2 text-right">Total</div><div className="col-span-1"></div>
                </div>
                {cart.map((item, idx) => (
                  <div key={idx} className={`grid grid-cols-12 gap-2 items-center px-4 py-3 transition-all group ${theme === 'dark' ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'}`}>
                    <div className={`col-span-1 text-xs font-mono ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{String(idx + 1).padStart(2, '0')}</div>
                    <div className="col-span-4 min-w-0">
                      <p className={`font-medium text-sm truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{item.productName}</p>
                      <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{formatCurrency(item.unitPrice)} each</p>
                    </div>
                    <div className="col-span-2 flex items-center justify-center gap-1.5">
                      <button onClick={() => updateQuantity(idx, item.quantity - 1)}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-red-500/20 hover:text-red-400 text-white' : 'bg-slate-100 hover:bg-red-50 hover:text-red-600'}`}>
                        <Minus className="w-3 h-3" />
                      </button>
                      <input id={`cart-qty-${idx}`} type="number" min="1" value={item.quantity}
                        onChange={e => updateQuantity(idx, parseInt(e.target.value) || 1)}
                        onFocus={e => e.target.select()}
                        className={`w-12 text-center font-bold text-sm rounded-lg border py-1 transition-colors outline-none ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700 text-white focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-900 focus:border-emerald-500'}`} />
                      <button onClick={() => updateQuantity(idx, item.quantity + 1)}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-emerald-500/20 hover:text-emerald-400 text-white' : 'bg-slate-100 hover:bg-emerald-50 hover:text-emerald-600'}`}>
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <div className={`col-span-2 text-right text-sm font-mono ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{formatCurrency(item.unitPrice)}</div>
                    <div className={`col-span-2 text-right text-sm font-bold ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>{formatCurrency(item.total)}</div>
                    <div className="col-span-1 flex justify-end">
                      <button onClick={() => removeItem(idx)} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/10 text-red-400">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {cart.length > 0 && (
              <div className={`px-4 py-3 border-t ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{cart.reduce((s, i) => s + i.quantity, 0)} items</span>
                  <span className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{formatCurrency(subtotal)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Payment & Customer */}
        <div className="lg:col-span-2 space-y-4">
          <div className={`rounded-2xl border p-4 ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'}`}>
            <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
              <Receipt className="w-4 h-4" /> Payment
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Subtotal</span>
                <span className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{formatCurrency(subtotal)}</span>
              </div>
              <div>
                <label className={`flex items-center justify-between text-sm mb-1.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                  Discount
                  <div className="flex items-center gap-1">
                    <kbd className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${theme === 'dark' ? 'bg-slate-700 text-emerald-400' : 'bg-slate-100 text-emerald-600'}`}>F6</kbd>
                    <kbd className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${theme === 'dark' ? 'bg-slate-700 text-amber-400' : 'bg-slate-100 text-amber-600'}`}>F7 toggle</kbd>
                  </div>
                </label>
                <div className="flex gap-2">
                  <div className={`flex rounded-xl border overflow-hidden flex-shrink-0 ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
                    <button onClick={() => setDiscountType('AMOUNT')}
                      className={`px-3 py-2.5 text-xs font-bold transition-all ${
                        discountType === 'AMOUNT'
                          ? 'bg-emerald-500/20 text-emerald-400 border-r border-emerald-500/30'
                          : theme === 'dark' ? 'text-slate-500 hover:text-slate-300 border-r border-slate-700/50' : 'text-slate-400 hover:text-slate-600 border-r border-slate-200'
                      }`}>Rs.</button>
                    <button onClick={() => setDiscountType('PERCENTAGE')}
                      className={`px-3 py-2.5 text-xs font-bold transition-all ${
                        discountType === 'PERCENTAGE'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : theme === 'dark' ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
                      }`}>%</button>
                  </div>
                  <input ref={discountRef} type="number" value={discount} onChange={e => setDiscount(Number(e.target.value) || 0)}
                    placeholder={discountType === 'PERCENTAGE' ? '0%' : '0.00'}
                    className={`${inputClass} text-right`} />
                </div>
                {discountType === 'PERCENTAGE' && discount > 0 && (
                  <p className={`text-xs mt-1 text-right ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                    = {formatCurrency(discountAmount)}
                  </p>
                )}
              </div>
              <div className={`flex items-center justify-between pt-3 border-t ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
                <span className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Total</span>
                <span className="text-2xl font-bold text-emerald-500">{formatCurrency(total)}</span>
              </div>
              <div>
                <label className={`block text-sm mb-1.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'CASH', label: 'Cash', icon: <Banknote className="w-4 h-4" /> },
                    { value: 'CARD', label: 'Card', icon: <CreditCard className="w-4 h-4" /> },
                    { value: 'BANK_TRANSFER', label: 'Bank', icon: <Sparkles className="w-4 h-4" /> },
                  ].map(m => (
                    <button key={m.value} onClick={() => setPaymentMethod(m.value)}
                      className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl text-xs font-medium border transition-all ${
                        paymentMethod === m.value
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-lg shadow-emerald-500/5'
                          : theme === 'dark' ? 'border-slate-700/50 text-slate-400 hover:border-slate-600 hover:text-white' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}>{m.icon}{m.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className={`flex items-center justify-between text-sm mb-1.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                  Paid Amount
                  <kbd className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${theme === 'dark' ? 'bg-slate-700 text-emerald-400' : 'bg-slate-100 text-emerald-600'}`}>F5</kbd>
                </label>
                <input ref={paidRef} type="number" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} placeholder={formatCurrency(total)} className={inputClass} />
              </div>
              {paid > total && paid > 0 && (
                <div className={`flex items-center justify-between rounded-xl px-4 py-3 border ${theme === 'dark' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'}`}>
                  <span className="text-emerald-400 text-sm font-medium">Change</span>
                  <span className="text-emerald-400 font-bold text-lg">{formatCurrency(change)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <button onClick={() => handleSubmit(true)} disabled={processing || cart.length === 0}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50 text-lg flex items-center justify-center gap-2 group">
              <Printer className="w-5 h-5 group-hover:animate-pulse" />
              {processing ? 'Processing...' : 'Complete & Print'}
              <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-white/20 font-mono ml-1">F12</kbd>
            </button>
            <button onClick={() => handleSubmit(false)} disabled={processing || cart.length === 0}
              className={`w-full py-3 font-semibold rounded-xl border transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                theme === 'dark' ? 'border-slate-700/50 text-slate-300 hover:bg-slate-800 hover:border-slate-600' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}>
              <Receipt className="w-4 h-4" /> Save Without Print
              <kbd className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${theme === 'dark' ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>F9</kbd>
            </button>
          </div>

          {lastInvoice && (
            <div className={`rounded-2xl border p-3 ${theme === 'dark' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-700'}`}>Last: {lastInvoice.invoiceNumber}</span>
                <button onClick={reprintLast} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                  <Printer className="w-3 h-3" /> Reprint
                </button>
              </div>
              <p className={`text-sm font-bold mt-1 ${theme === 'dark' ? 'text-emerald-300' : 'text-emerald-700'}`}>{formatCurrency(lastInvoice.total)}</p>
            </div>
          )}

          <div className={`rounded-2xl border p-4 ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'}`}>
            <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
              <User className="w-4 h-4" /> Customer (Optional)
              <kbd className={`ml-auto text-[10px] px-1.5 py-0.5 rounded font-mono ${theme === 'dark' ? 'bg-slate-700 text-emerald-400' : 'bg-slate-100 text-emerald-600'}`}>F4</kbd>
            </h3>
            {selectedCustomerId ? (
              <div className={`flex items-center justify-between p-3 rounded-xl border ${theme === 'dark' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'}`}>
                <div>
                  <p className={`font-medium text-sm ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{customerName}</p>
                  {customerPhone && <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{customerPhone}</p>}
                </div>
                <button onClick={() => { setCustomerName(''); setCustomerPhone(''); setSelectedCustomerId(null); }}
                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-all"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative" ref={custDropdownRef}>
                  <div className="flex gap-2">
                    <input ref={customerSearchRef} type="text" value={customerSearch}
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
                              ? theme === 'dark' ? 'bg-emerald-500/10 border-l-2 border-l-emerald-500' : 'bg-emerald-50 border-l-2 border-l-emerald-500'
                              : theme === 'dark' ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50'
                          } border-b ${theme === 'dark' ? 'border-slate-700/30' : 'border-slate-100'}`}>
                          <div>
                            <p className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{c.name}</p>
                            <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{c.phone || c.email || 'No contact'}</p>
                          </div>
                          {idx === selectedCustomerIndex && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${theme === 'dark' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>↵</span>
                          )}
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
                <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Or type customer name manually" className={inputClass} />
                <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Phone number" className={inputClass} />
              </div>
            )}
          </div>
        </div>
      </div>

      <ShortcutHintsBar onShowMap={() => setShowShortcuts(true)} />
      <ShortcutOverlay isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />

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
export default QuickInvoice;
