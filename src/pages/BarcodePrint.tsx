import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Printer, Search, Plus, RefreshCw, Barcode, Minus, X, Tag, Type, DollarSign, Eye, EyeOff } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import JsBarcode from 'jsbarcode';

interface Product {
  id: string;
  name: string;
  barcode: string | null;
  sku: string | null;
  sellingPrice: string;
  variants?: ProductVariant[];
}

interface ProductVariant {
  id: string;
  name: string;
  barcode: string | null;
  sku: string | null;
  sellingPrice: string;
}

interface PrintItem {
  id: string;
  label: string;
  barcode: string;
  price: string;
  copies: number;
}

const BarcodePrint: React.FC = () => {
  const { theme } = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [printItems, setPrintItems] = useState<PrintItem[]>([]);
  const [customBarcode, setCustomBarcode] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customCopies, setCustomCopies] = useState('1');
  const [generating, setGenerating] = useState(false);
  const [showLabelName, setShowLabelName] = useState(false);
  const [showLabelPrice, setShowLabelPrice] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Roll label dimensions from Xprinter Page Setup
  // Page: 1.28in x 0.59in (32.5mm x 15mm), Template width approx 1.18in (30mm)
  const LABEL_WIDTH = 32.5;
  const LABEL_HEIGHT = 15;

  const loadProducts = useCallback(async () => {
    try {
      const [pRes, vRes] = await Promise.all([
        api.get('/products'),
        api.get('/variants'),
      ]);
      const variantsByProduct: Record<string, ProductVariant[]> = {};
      (vRes.data.data || []).forEach((v: ProductVariant & { productId: string }) => {
        if (!variantsByProduct[v.productId]) variantsByProduct[v.productId] = [];
        variantsByProduct[v.productId].push(v);
      });
      const prods: Product[] = (pRes.data.data || []).map((p: Product) => ({
        ...p,
        variants: variantsByProduct[p.id] || [],
      }));
      setProducts(prods);
    } catch { toast.error('Failed to load products'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  // Filter products for search dropdown
  const filteredProducts = useMemo(() => {
    if (!search.trim()) return [];
    const s = search.toLowerCase();
    const results: { id: string; label: string; barcode: string; price: string; type: string }[] = [];

    products.forEach(p => {
      if (p.barcode && (
        p.name.toLowerCase().includes(s) ||
        (p.barcode || '').toLowerCase().includes(s) ||
        (p.sku || '').toLowerCase().includes(s)
      )) {
        results.push({
          id: p.id,
          label: p.name,
          barcode: p.barcode,
          price: p.sellingPrice,
          type: 'product',
        });
      }
      // Also search variants
      (p.variants || []).forEach(v => {
        if (v.barcode && (
          v.name.toLowerCase().includes(s) ||
          (v.barcode || '').toLowerCase().includes(s) ||
          (v.sku || '').toLowerCase().includes(s) ||
          p.name.toLowerCase().includes(s)
        )) {
          results.push({
            id: v.id,
            label: `${p.name} — ${v.name}`,
            barcode: v.barcode,
            price: v.sellingPrice,
            type: 'variant',
          });
        }
      });
    });
    return results.slice(0, 20);
  }, [search, products]);

  const addFromProduct = (item: { id: string; label: string; barcode: string; price: string }) => {
    const existing = printItems.find(pi => pi.barcode === item.barcode);
    if (existing) {
      setPrintItems(prev => prev.map(pi =>
        pi.barcode === item.barcode ? { ...pi, copies: pi.copies + 1 } : pi
      ));
    } else {
      setPrintItems(prev => [...prev, {
        id: item.id,
        label: item.label,
        barcode: item.barcode,
        price: item.price,
        copies: 1,
      }]);
    }
    setSearch('');
    searchRef.current?.focus();
  };

  const generateAndAdd = async () => {
    setGenerating(true);
    try {
      const r = await api.post('/shop/generate-barcode');
      const barcode = r.data.data.barcode;
      setCustomBarcode(barcode);
      toast.success(`Generated: ${barcode}`);
    } catch {
      toast.error('Failed to generate barcode');
    } finally {
      setGenerating(false);
    }
  };

  const addCustomBarcode = () => {
    if (!customBarcode.trim()) { toast.error('Enter or generate a barcode'); return; }
    const copies = parseInt(customCopies) || 1;
    const existing = printItems.find(pi => pi.barcode === customBarcode.trim());
    if (existing) {
      setPrintItems(prev => prev.map(pi =>
        pi.barcode === customBarcode.trim() ? { ...pi, copies: pi.copies + copies } : pi
      ));
    } else {
      setPrintItems(prev => [...prev, {
        id: `custom-${Date.now()}`,
        label: customLabel.trim() || customBarcode.trim(),
        barcode: customBarcode.trim(),
        price: customPrice.trim(),
        copies,
      }]);
    }
    setCustomBarcode('');
    setCustomLabel('');
    setCustomPrice('');
    setCustomCopies('1');
  };

  const updateCopies = (barcode: string, delta: number) => {
    setPrintItems(prev => prev.map(pi =>
      pi.barcode === barcode ? { ...pi, copies: Math.max(1, pi.copies + delta) } : pi
    ));
  };

  const setCopies = (barcode: string, value: string) => {
    const num = parseInt(value) || 1;
    setPrintItems(prev => prev.map(pi =>
      pi.barcode === barcode ? { ...pi, copies: Math.max(1, num) } : pi
    ));
  };

  const removeItem = (barcode: string) => {
    setPrintItems(prev => prev.filter(pi => pi.barcode !== barcode));
  };

  const totalLabels = printItems.reduce((sum, pi) => sum + pi.copies, 0);

  const previewItem = useMemo(() => {
    if (printItems.length > 0) return printItems[0];
    if (!customBarcode.trim()) return null;
    return {
      id: 'preview',
      label: customLabel.trim() || customBarcode.trim(),
      barcode: customBarcode.trim(),
      price: customPrice.trim(),
      copies: 1,
    };
  }, [printItems, customBarcode, customLabel, customPrice]);

  // Determine best barcode format — EAN13 if valid, else CODE128
  const getBarcodeFormat = (value: string): string => {
    if (/^\d{12,13}$/.test(value)) return 'EAN13';
    return 'CODE128';
  };

  // Generate barcode SVGs for print & preview
  const renderBarcodeSVG = (barcodeValue: string, canvas: SVGSVGElement) => {
    const fmt = getBarcodeFormat(barcodeValue);
    try {
      JsBarcode(canvas, barcodeValue, {
        format: fmt,
        width: fmt === 'EAN13' ? 1.5 : 1.2,
        height: 35,
        displayValue: true,
        fontSize: fmt === 'EAN13' ? 12 : 10,
        margin: 2,
        textMargin: 2,
        flat: false,
      });
    } catch {
      try {
        JsBarcode(canvas, barcodeValue, {
          format: 'CODE128',
          width: 1.2,
          height: 35,
          displayValue: true,
          fontSize: 10,
          margin: 2,
          textMargin: 2,
        });
      } catch { /* skip */ }
    }
  };

  const handlePrint = () => {
    if (printItems.length === 0) { toast.error('Add items to print'); return; }

    // Create print window with labels
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) { toast.error('Please allow popups to print'); return; }

    // Build labels HTML
    let labelsHtml = '';
    printItems.forEach(item => {
      for (let i = 0; i < item.copies; i++) {
        labelsHtml += `
          <div class="label">
            ${showLabelName ? `<div class="label-name">${item.label.length > 20 ? item.label.substring(0, 20) + '…' : item.label}</div>` : ''}
            <svg class="barcode" id="bc-${item.barcode}-${i}"></svg>
            ${showLabelPrice && item.price ? `<div class="label-price">Rs. ${parseFloat(item.price).toLocaleString()}</div>` : ''}
          </div>
        `;
      }
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Barcode Labels</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page {
            size: ${LABEL_WIDTH}mm ${LABEL_HEIGHT}mm;
            margin: 0;
          }
          body { margin: 0; padding: 0; }
          .label {
            width: ${LABEL_WIDTH}mm;
            height: ${LABEL_HEIGHT}mm;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            page-break-after: always;
            overflow: hidden;
            padding: 0.8mm 1mm;
          }
          .label:last-child { page-break-after: auto; }
          .label-name {
            font-family: Arial, sans-serif;
            font-size: 5.5pt;
            font-weight: bold;
            text-align: center;
            line-height: 1;
            max-width: 100%;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
            width: 100%;
          }
          .barcode {
            width: 100%;
            height: auto;
            max-height: ${showLabelName && showLabelPrice ? '7.8mm' : showLabelName || showLabelPrice ? '9.2mm' : '11mm'};
          }
          .label-price {
            font-family: Arial, sans-serif;
            font-size: 5.2pt;
            font-weight: bold;
            text-align: center;
            line-height: 1;
            width: 100%;
          }
        </style>
      </head>
      <body>
        ${labelsHtml}
        <script>
          // Render all barcodes
          document.querySelectorAll('.barcode').forEach(function(svg) {
            var code = svg.id.replace(/^bc-/, '').replace(/-\\d+$/, '');
            var fmt = /^\\d{12,13}$/.test(code) ? 'EAN13' : 'CODE128';
            try {
              JsBarcode(svg, code, {
                format: fmt,
                width: fmt === 'EAN13' ? 1.15 : 0.95,
                height: 24,
                displayValue: true,
                fontSize: fmt === 'EAN13' ? 7 : 6,
                margin: 0,
                textMargin: 0,
                flat: false,
              });
            } catch(e) {
              try {
                JsBarcode(svg, code, {
                  format: 'CODE128',
                  width: 0.95,
                  height: 24,
                  displayValue: true,
                  fontSize: 6,
                  margin: 0,
                  textMargin: 0,
                });
              } catch(e2) { console.error(e2); }
            }
          });
          // Auto-print after render
          setTimeout(function() { window.print(); }, 300);
        <\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const inputClass = `w-full px-4 py-2.5 rounded-xl border transition-all outline-none ${
    theme === 'dark'
      ? 'bg-slate-800/50 border-slate-700/50 text-white placeholder-slate-500 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20'
      : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
  }`;

  const cardClass = `rounded-2xl border ${
    theme === 'dark' ? 'bg-slate-800/30 border-slate-700/50' : 'bg-white border-slate-200'
  }`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
            <Tag className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Barcode Print</h1>
            <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Print barcode labels for your Xprinter</p>
          </div>
        </div>
        {printItems.length > 0 && (
          <button onClick={handlePrint}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-emerald-500/25 transition-all">
            <Printer className="w-4 h-4" />
            Print {totalLabels} Label{totalLabels !== 1 ? 's' : ''}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Add from Products */}
        <div className={`${cardClass} p-5`}>
          <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            <Search className="w-5 h-5 text-emerald-500" /> Add from Products
          </h2>

          <div className="relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
            <input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, barcode, or short code..."
              className={`${inputClass} pl-10`} />

            {/* Search results dropdown */}
            {filteredProducts.length > 0 && (
              <div className={`absolute z-20 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-xl border shadow-xl ${
                theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
              }`}>
                {filteredProducts.map(item => (
                  <button key={`${item.type}-${item.id}`} onClick={() => addFromProduct(item)}
                    className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-2 transition-colors ${
                      theme === 'dark' ? 'hover:bg-slate-700/50 text-slate-300' : 'hover:bg-slate-50 text-slate-700'
                    }`}>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{item.label}</div>
                      <div className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{item.barcode}</div>
                    </div>
                    <div className="text-xs font-mono text-emerald-500">Rs. {parseFloat(item.price).toLocaleString()}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-5 h-5 animate-spin text-emerald-500" />
            </div>
          )}

          {!loading && products.length === 0 && (
            <div className={`text-center py-8 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
              <Barcode className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No products with barcodes found</p>
            </div>
          )}
        </div>

        {/* Right: Generate Custom Barcode */}
        <div className={`${cardClass} p-5`}>
          <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            <Plus className="w-5 h-5 text-emerald-500" /> Custom / New Barcode
          </h2>

          <div className={`mb-5 p-4 rounded-xl border ${
            theme === 'dark' ? 'bg-slate-900/40 border-slate-700/40' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Barcode Details
              </h3>
              <span className={`text-[11px] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                Top-right preview
              </span>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              <button onClick={() => setShowLabelName(!showLabelName)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  showLabelName
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                    : theme === 'dark' ? 'border-slate-700/50 text-slate-400 hover:border-slate-600' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}>
                <Type className="w-3.5 h-3.5" />
                Product Name
                {showLabelName ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              </button>

              <button onClick={() => setShowLabelPrice(!showLabelPrice)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  showLabelPrice
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                    : theme === 'dark' ? 'border-slate-700/50 text-slate-400 hover:border-slate-600' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}>
                <DollarSign className="w-3.5 h-3.5" />
                Price
                {showLabelPrice ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              </button>
            </div>

            <div className={`rounded-lg border p-2 ${theme === 'dark' ? 'bg-black/60 border-slate-700/40' : 'bg-white border-slate-200'}`}>
              {previewItem ? (
                <div
                  className="mx-auto w-full max-w-[245px] bg-white border border-slate-200 rounded-[6px] p-2 flex flex-col justify-between"
                  style={{ aspectRatio: `${LABEL_WIDTH} / ${LABEL_HEIGHT}` }}
                >
                  {showLabelName ? (
                    <div className="text-[10px] font-semibold text-slate-900 text-center leading-none truncate">
                      {previewItem.label}
                    </div>
                  ) : <div className="h-2" />}

                  <div className="flex justify-center items-center min-h-[45px]">
                    <svg ref={node => { if (node) renderBarcodeSVG(previewItem.barcode, node); }} style={{ width: '100%', maxHeight: '46px' }} />
                  </div>

                  {showLabelPrice && previewItem.price ? (
                    <div className="text-[10px] font-semibold text-slate-900 text-center leading-none">
                      Rs. {parseFloat(previewItem.price).toLocaleString()}
                    </div>
                  ) : <div className="h-2" />}
                </div>
              ) : (
                <div className={`text-center text-xs py-6 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                  Add a product or type a custom barcode to see preview
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex gap-2">
              <input type="text" value={customBarcode} onChange={e => setCustomBarcode(e.target.value)}
                placeholder="Barcode number" className={`${inputClass} flex-1`} />
              <button onClick={generateAndAdd} disabled={generating}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium text-sm whitespace-nowrap disabled:opacity-50">
                <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                Generate
              </button>
            </div>

            <input type="text" value={customLabel} onChange={e => setCustomLabel(e.target.value)}
              placeholder="Label name (optional)" className={inputClass} />

            <div className="grid grid-cols-2 gap-3">
              <input type="text" value={customPrice} onChange={e => setCustomPrice(e.target.value)}
                placeholder="Price (optional)" className={inputClass} />
              <input type="number" value={customCopies} onChange={e => setCustomCopies(e.target.value)}
                onWheel={e => (e.target as HTMLElement).blur()}
                min="1" placeholder="Copies" className={inputClass} />
            </div>

            <button onClick={addCustomBarcode}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
                customBarcode.trim()
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:shadow-lg hover:shadow-emerald-500/25'
                  : theme === 'dark' ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
              disabled={!customBarcode.trim()}>
              <Plus className="w-4 h-4" /> Add to Print Queue
            </button>
          </div>
        </div>
      </div>

      {/* Print Queue */}
      <div className={`${cardClass} p-5`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-lg font-semibold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            <Printer className="w-5 h-5 text-emerald-500" /> Print Queue
            {printItems.length > 0 && (
              <span className="ml-2 px-2.5 py-0.5 text-xs font-medium rounded-full bg-emerald-500/10 text-emerald-500">
                {totalLabels} label{totalLabels !== 1 ? 's' : ''}
              </span>
            )}
          </h2>
          {printItems.length > 0 && (
            <div className="flex gap-2">
              <button onClick={() => setPrintItems([])}
                className={`text-xs px-3 py-1.5 rounded-lg ${
                  theme === 'dark' ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-500 hover:bg-slate-100'
                }`}>
                Clear All
              </button>
              <button onClick={handlePrint}
                className="flex items-center gap-1.5 text-xs px-4 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg font-medium">
                <Printer className="w-3 h-3" /> Print All
              </button>
            </div>
          )}
        </div>

        {printItems.length === 0 ? (
          <div className={`text-center py-12 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
            <Tag className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No items in print queue</p>
            <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
              Search for a product or generate a custom barcode above
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {printItems.map(item => (
              <div key={item.barcode}
                className={`flex items-center gap-3 p-3 rounded-xl border ${
                  theme === 'dark' ? 'bg-slate-800/50 border-slate-700/30' : 'bg-slate-50 border-slate-200'
                }`}>
                {/* Barcode preview */}
                <div className="flex-shrink-0 bg-white rounded-lg p-1.5">
                  <svg ref={node => { if (node) renderBarcodeSVG(item.barcode, node); }}
                    style={{ width: '80px', height: '35px' }} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    {item.label}
                  </div>
                  <div className={`text-xs font-mono ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                    {item.barcode}
                    {item.price && <span className="ml-2 text-emerald-500">Rs. {parseFloat(item.price).toLocaleString()}</span>}
                  </div>
                </div>

                {/* Copies control */}
                <div className="flex items-center gap-1">
                  <button onClick={() => updateCopies(item.barcode, -1)}
                    className={`w-7 h-7 flex items-center justify-center rounded-lg ${
                      theme === 'dark' ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}>
                    <Minus className="w-3 h-3" />
                  </button>
                  <input type="number" value={item.copies}
                    onChange={e => setCopies(item.barcode, e.target.value)}
                    onWheel={e => (e.target as HTMLElement).blur()}
                    className={`w-12 text-center text-sm font-medium py-1 rounded-lg border ${
                      theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                    }`} min="1" />
                  <button onClick={() => updateCopies(item.barcode, 1)}
                    className={`w-7 h-7 flex items-center justify-center rounded-lg ${
                      theme === 'dark' ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}>
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {/* Remove */}
                <button onClick={() => removeItem(item.barcode)}
                  className={`w-7 h-7 flex items-center justify-center rounded-lg ${
                    theme === 'dark' ? 'text-red-400 hover:bg-red-500/10' : 'text-red-500 hover:bg-red-50'
                  }`}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Printer Info */}
      <div className={`${cardClass} p-4`}>
        <div className={`text-xs space-y-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
          <p className="font-medium">Printer Setup (Xprinter XP-T361U):</p>
          <p>• Label size: {LABEL_WIDTH}mm × {LABEL_HEIGHT}mm ({(LABEL_WIDTH / 25.4).toFixed(2)}in × {(LABEL_HEIGHT / 25.4).toFixed(2)}in)</p>
          <p>• In printer properties: Stock → Labels with gaps, Direct Thermal | Page Size → User Defined 1.28in × 0.59in (Portrait)</p>
          <p>• Template area inside label: approx 1.18in × 0.59in (matches printer driver preview)</p>
          <p>• Make sure the Xprinter is set as the default printer or select it in the print dialog</p>
        </div>
      </div>
    </div>
  );
};

export default BarcodePrint;
