import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import {
  BarChart3, Download, FileText, Calendar, TrendingUp,
  DollarSign, ShoppingCart, Package, Users, Loader2, Filter, Zap
} from 'lucide-react';
import { formatCurrency, formatDate } from '../lib/utils';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { DatePicker } from '../components/ui/DatePicker';
import { MonthPicker } from '../components/ui/MonthPicker';
import { YearPicker } from '../components/ui/YearPicker';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface Invoice {
  id: string; invoiceNumber: string; type: string; total: string | number;
  subtotal: string | number; discount: string | number; tax: string | number;
  paidAmount: string | number; paymentMethod: string; paymentStatus: string;
  customerName: string | null; customerPhone: string | null; createdAt: string;
  items: Array<{ productName: string; quantity: number; unitPrice: number; costPrice?: number | string; total: number }>;
  user?: { name: string };
}

type FilterMode = 'today' | 'date' | 'month' | 'year';

const Reports: React.FC = () => {
  const { theme } = useTheme();
  const { shop } = useAuth();
  const [filterMode, setFilterMode] = useState<FilterMode>('today');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [drawerSessions, setDrawerSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const getDateRange = useCallback((): { from: string; to: string } => {
    const today = new Date();
    switch (filterMode) {
      case 'today':
        return { from: today.toISOString().split('T')[0], to: today.toISOString().split('T')[0] + 'T23:59:59' };
      case 'date':
        return { from: selectedDate, to: selectedDate + 'T23:59:59' };
      case 'month': {
        const [y, m] = selectedMonth.split('-');
        const start = `${y}-${m}-01`;
        const end = new Date(Number(y), Number(m), 0);
        return { from: start, to: `${y}-${m}-${String(end.getDate()).padStart(2, '0')}T23:59:59` };
      }
      case 'year':
        return { from: `${selectedYear}-01-01`, to: `${selectedYear}-12-31T23:59:59` };
      default:
        return { from: today.toISOString().split('T')[0], to: today.toISOString().split('T')[0] + 'T23:59:59' };
    }
  }, [filterMode, selectedDate, selectedMonth, selectedYear]);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = getDateRange();
      const [invRes, drawRes] = await Promise.all([
        api.get(`/invoices?from=${from}&to=${to}`),
        api.get(`/cash-drawer?from=${from}&to=${to}`)
      ]);
      setInvoices((invRes.data.data || []).filter((i: Invoice) => i.paymentStatus !== 'VOID'));
      setDrawerSessions(drawRes.data.data || []);
    } catch { toast.error('Failed to load report data'); }
    finally { setLoading(false); }
  }, [getDateRange]);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  // Computed analytics
  const analytics = useMemo(() => {
    const totalSales = invoices.reduce((s, i) => s + Number(i.total), 0); // Gross Sales
    
    // Calculate total cost and net profit
    let totalCost = 0;
    invoices.forEach(inv => {
      (inv.items || []).forEach(item => {
        totalCost += Number(item.costPrice || 0) * item.quantity;
      });
    });
    const netProfit = totalSales - totalCost;

    const totalDiscount = invoices.reduce((s, i) => s + Number(i.discount), 0);
    const totalPaid = invoices.reduce((s, i) => s + Number(i.paidAmount), 0);
    const totalOutstanding = totalSales - totalPaid;
    const quickInvoices = invoices.filter(i => i.type !== 'WHOLESALE');
    const wholesaleInvoices = invoices.filter(i => i.type === 'WHOLESALE');
    const avgOrderValue = invoices.length > 0 ? totalSales / invoices.length : 0;

    // Product breakdown
    const productMap: Record<string, { qty: number; revenue: number; profit: number }> = {};
    invoices.forEach(inv => {
      (inv.items || []).forEach(item => {
        if (!productMap[item.productName]) productMap[item.productName] = { qty: 0, revenue: 0, profit: 0 };
        productMap[item.productName].qty += item.quantity;
        const itemRev = Number(item.total);
        // Profit per item line = (SellingPrice - CostPrice) * qty - proportional discount (simplified: just itemTotal - totalCost)
        // Wait, item.total already has discount applied? No, item.total is unitPrice*qty - item.discount
        // But invoice also has global discount. For simplicity: item.total - (costPrice * qty)
        const itemCost = Number(item.costPrice || 0) * item.quantity;
        productMap[item.productName].revenue += itemRev;
        productMap[item.productName].profit += (itemRev - itemCost);
      });
    });
    const topProducts = Object.entries(productMap)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 10)
      .map(([name, data]) => ({ name, ...data }));

    // Payment method breakdown
    const pmMap: Record<string, { count: number; total: number }> = {};
    invoices.forEach(inv => {
      const m = inv.paymentMethod || 'CASH';
      if (!pmMap[m]) pmMap[m] = { count: 0, total: 0 };
      pmMap[m].count++;
      pmMap[m].total += Number(inv.total);
    });

    // Daily breakdown (for charts)
    const dailyMap: Record<string, { revenue: number; profit: number; count: number }> = {};
    invoices.forEach(inv => {
      const day = inv.createdAt.split('T')[0];
      if (!dailyMap[day]) dailyMap[day] = { revenue: 0, profit: 0, count: 0 };
      
      const invTotal = Number(inv.total);
      const invCost = inv.items.reduce((sum, item) => sum + (Number(item.costPrice || 0) * item.quantity), 0);
      
      dailyMap[day].revenue += invTotal;
      dailyMap[day].profit += (invTotal - invCost);
      dailyMap[day].count++;
    });
    const dailyData = Object.entries(dailyMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, data]) => ({
        date: new Date(date).toLocaleDateString('en-LK', { month: 'short', day: 'numeric' }),
        ...data,
      }));

    // Top customers
    const custMap: Record<string, { count: number; total: number }> = {};
    invoices.forEach(inv => {
      const name = inv.customerName || 'Walk-in';
      if (!custMap[name]) custMap[name] = { count: 0, total: 0 };
      custMap[name].count++;
      custMap[name].total += Number(inv.total);
    });
    const topCustomers = Object.entries(custMap)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .map(([name, data]) => ({ name, ...data }));

    // Cashier breakdown
    const cashierMap: Record<string, { count: number; total: number }> = {};
    invoices.forEach(inv => {
      const name = inv.user?.name || 'Unknown';
      if (!cashierMap[name]) cashierMap[name] = { count: 0, total: 0 };
      cashierMap[name].count++;
      cashierMap[name].total += Number(inv.total);
    });

    return {
      totalSales, netProfit, totalDiscount, totalPaid, totalOutstanding, avgOrderValue,
      totalInvoices: invoices.length,
      quickCount: quickInvoices.length, quickTotal: quickInvoices.reduce((s, i) => s + Number(i.total), 0),
      wholesaleCount: wholesaleInvoices.length, wholesaleTotal: wholesaleInvoices.reduce((s, i) => s + Number(i.total), 0),
      topProducts, paymentMethods: pmMap, dailyData, topCustomers, cashiers: cashierMap,
    };
  }, [invoices]);

  const filterLabel = filterMode === 'today' ? 'Today' : filterMode === 'date' ? formatDate(selectedDate) :
    filterMode === 'month' ? new Date(selectedMonth + '-01').toLocaleDateString('en-LK', { year: 'numeric', month: 'long' }) : selectedYear;

  // PDF Export (black & white, cost-effective)
  const exportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(shop?.name || 'Ultra Smart Shop', pageWidth / 2, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Sales Report', pageWidth / 2, 28, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Period: ${filterLabel}`, pageWidth / 2, 34, { align: 'center' });
    doc.text(`Generated: ${new Date().toLocaleString('en-LK')}`, pageWidth / 2, 40, { align: 'center' });

    // Line separator
    doc.setLineWidth(0.5);
    doc.line(14, 44, pageWidth - 14, 44);

    // Summary section
    let y = 52;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary', 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const summaryData = [
      ['Total Invoices', String(analytics.totalInvoices)],
      ['Gross Sales', formatCurrency(analytics.totalSales)],
      ['Net Profit', formatCurrency(analytics.netProfit)],
      ['Total Discount', formatCurrency(analytics.totalDiscount)],
      ['Total Paid', formatCurrency(analytics.totalPaid)],
      ['Outstanding', formatCurrency(analytics.totalOutstanding)],
      ['Avg Order Value', formatCurrency(analytics.avgOrderValue)],
      ['Quick Invoices', `${analytics.quickCount} (${formatCurrency(analytics.quickTotal)})`],
      ['Wholesale Invoices', `${analytics.wholesaleCount} (${formatCurrency(analytics.wholesaleTotal)})`],
    ];
    autoTable(doc, {
      startY: y,
      head: [['Metric', 'Value']],
      body: summaryData,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 3, textColor: [0, 0, 0] },
      headStyles: { fontStyle: 'bold', fillColor: [240, 240, 240], textColor: [0, 0, 0] },
      columnStyles: { 0: { fontStyle: 'bold' } },
    });

    // Top Products
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Top Selling Products', 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['#', 'Product', 'Qty Sold', 'Revenue', 'Profit']],
      body: analytics.topProducts.map((p, i) => [String(i + 1), p.name, String(p.qty), formatCurrency(p.revenue), formatCurrency(p.profit)]),
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 3, textColor: [0, 0, 0] },
      headStyles: { fontStyle: 'bold', fillColor: [240, 240, 240], textColor: [0, 0, 0] },
    });

    // Payment Methods
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 10;
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Payment Methods', 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Method', 'Count', 'Total']],
      body: Object.entries(analytics.paymentMethods).map(([m, d]) => [
        m === 'CASH' ? 'Cash' : m === 'CARD' ? 'Card' : m === 'BANK_TRANSFER' ? 'Bank Transfer' : m,
        String(d.count), formatCurrency(d.total),
      ]),
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 3, textColor: [0, 0, 0] },
      headStyles: { fontStyle: 'bold', fillColor: [240, 240, 240], textColor: [0, 0, 0] },
    });

    // Top Customers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 10;
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Top Customers', 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['#', 'Customer', 'Invoices', 'Total']],
      body: analytics.topCustomers.map((c, i) => [String(i + 1), c.name, String(c.count), formatCurrency(c.total)]),
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 3, textColor: [0, 0, 0] },
      headStyles: { fontStyle: 'bold', fillColor: [240, 240, 240], textColor: [0, 0, 0] },
    });

    // Invoice Details
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 10;
    if (y > 220) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Invoice Details', 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['#', 'Invoice', 'Type', 'Customer', 'Method', 'Total', 'Date']],
      body: invoices.map((inv, i) => [
        String(i + 1), inv.invoiceNumber, inv.type,
        inv.customerName || 'Walk-in', inv.paymentMethod,
        formatCurrency(Number(inv.total)),
        new Date(inv.createdAt).toLocaleDateString('en-LK'),
      ]),
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0] },
      headStyles: { fontStyle: 'bold', fillColor: [240, 240, 240], textColor: [0, 0, 0] },
    });

    // Cash Drawer Sessions
    if (drawerSessions.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      y = (doc as any).lastAutoTable.finalY + 10;
      if (y > 220) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Cash Drawer Sessions', 14, y);
      y += 4;
      autoTable(doc, {
        startY: y,
        head: [['Date', 'Cashier', 'Starting', 'Expected', 'Actual', 'Diff', 'Status']],
        body: drawerSessions.map((session) => [
          new Date(session.openedAt).toLocaleString('en-LK'),
          session.user?.name || 'Unknown',
          formatCurrency(Number(session.startingCash)),
          formatCurrency(Number(session.expectedCash)),
          formatCurrency(Number(session.actualCash)),
          formatCurrency(Number(session.difference)),
          session.status
        ]),
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0] },
        headStyles: { fontStyle: 'bold', fillColor: [240, 240, 240], textColor: [0, 0, 0] },
      });
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
    }

    doc.save(`Sales_Report_${filterLabel.replace(/\s+/g, '_')}.pdf`);
    toast.success('PDF downloaded!');
  };

  // Excel Export
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryRows = [
      [shop?.name || 'Ultra Smart Shop'],
      ['Sales Report'],
      [`Period: ${filterLabel}`],
      [`Generated: ${new Date().toLocaleString('en-LK')}`],
      [],
      ['Metric', 'Value'],
      ['Total Invoices', analytics.totalInvoices],
      ['Gross Sales', analytics.totalSales],
      ['Net Profit', analytics.netProfit],
      ['Total Discount', analytics.totalDiscount],
      ['Total Paid', analytics.totalPaid],
      ['Outstanding', analytics.totalOutstanding],
      ['Avg Order Value', analytics.avgOrderValue],
      ['Quick Invoices', analytics.quickCount],
      ['Quick Revenue', analytics.quickTotal],
      ['Wholesale Invoices', analytics.wholesaleCount],
      ['Wholesale Revenue', analytics.wholesaleTotal],
    ];
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
    summaryWs['!cols'] = [{ wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

    // Invoices sheet
    const invoiceRows = invoices.map(inv => ({
      'Invoice #': inv.invoiceNumber,
      'Type': inv.type,
      'Customer': inv.customerName || 'Walk-in',
      'Phone': inv.customerPhone || '',
      'Subtotal': Number(inv.subtotal),
      'Discount': Number(inv.discount),
      'Tax': Number(inv.tax),
      'Total': Number(inv.total),
      'Paid': Number(inv.paidAmount),
      'Balance': Number(inv.total) - Number(inv.paidAmount),
      'Payment': inv.paymentMethod,
      'Status': inv.paymentStatus,
      'Cashier': inv.user?.name || '',
      'Date': new Date(inv.createdAt).toLocaleDateString('en-LK'),
      'Time': new Date(inv.createdAt).toLocaleTimeString('en-LK'),
    }));
    const invoiceWs = XLSX.utils.json_to_sheet(invoiceRows);
    XLSX.utils.book_append_sheet(wb, invoiceWs, 'Invoices');

    // Products sheet
    const productRows = analytics.topProducts.map((p, i) => ({
      '#': i + 1, 'Product': p.name, 'Qty Sold': p.qty, 'Revenue': p.revenue, 'Profit': p.profit,
    }));
    const productWs = XLSX.utils.json_to_sheet(productRows);
    XLSX.utils.book_append_sheet(wb, productWs, 'Top Products');

    // Customers sheet
    const custRows = analytics.topCustomers.map((c, i) => ({
      '#': i + 1, 'Customer': c.name, 'Invoices': c.count, 'Total': c.total,
    }));
    const custWs = XLSX.utils.json_to_sheet(custRows);
    XLSX.utils.book_append_sheet(wb, custWs, 'Top Customers');

    // Payment Methods sheet
    const pmRows = Object.entries(analytics.paymentMethods).map(([method, data]) => ({
      'Method': method === 'CASH' ? 'Cash' : method === 'CARD' ? 'Card' : method === 'BANK_TRANSFER' ? 'Bank Transfer' : method,
      'Count': data.count,
      'Total': data.total,
      'Percentage': analytics.totalSales > 0 ? `${(data.total / analytics.totalSales * 100).toFixed(1)}%` : '0%',
    }));
    if (pmRows.length > 0) {
      const pmWs = XLSX.utils.json_to_sheet(pmRows);
      pmWs['!cols'] = [{ wch: 18 }, { wch: 10 }, { wch: 18 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, pmWs, 'Payment Methods');
    }

    // Cashier Breakdown sheet
    const cashierRows = Object.entries(analytics.cashiers).map(([name, data]) => ({
      'Cashier': name,
      'Invoices': data.count,
      'Total': data.total,
      'Percentage': analytics.totalSales > 0 ? `${(data.total / analytics.totalSales * 100).toFixed(1)}%` : '0%',
    }));
    if (cashierRows.length > 0) {
      const cashierWs = XLSX.utils.json_to_sheet(cashierRows);
      cashierWs['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 18 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, cashierWs, 'Cashier Breakdown');
    }

    // Daily Revenue sheet
    if (analytics.dailyData.length > 0) {
      const dailyRows = analytics.dailyData.map(d => ({
        'Date': d.date,
        'Revenue': d.revenue,
        'Profit': d.profit,
        'Invoices': d.count,
      }));
      const dailyWs = XLSX.utils.json_to_sheet(dailyRows);
      dailyWs['!cols'] = [{ wch: 15 }, { wch: 18 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, dailyWs, 'Daily Revenue');
    }

    // Cash Drawer sheet
    if (drawerSessions.length > 0) {
      const drawerRows = drawerSessions.map(session => ({
        'Opened At': new Date(session.openedAt).toLocaleString('en-LK'),
        'Closed At': session.closedAt ? new Date(session.closedAt).toLocaleString('en-LK') : '-',
        'Cashier': session.user?.name || 'Unknown',
        'Starting Cash': Number(session.startingCash),
        'Expected Cash': Number(session.expectedCash),
        'Actual Cash': Number(session.actualCash),
        'Difference': Number(session.difference),
        'Status': session.status,
        'Notes': session.notes || ''
      }));
      const drawerWs = XLSX.utils.json_to_sheet(drawerRows);
      XLSX.utils.book_append_sheet(wb, drawerWs, 'Cash Drawer');
    }

    XLSX.writeFile(wb, `Sales_Report_${filterLabel.replace(/\s+/g, '_')}.xlsx`);
    toast.success('Excel downloaded!');
  };

  const cardBg = theme === 'dark' ? 'bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm';
  const textP = theme === 'dark' ? 'text-white' : 'text-slate-900';
  const textS = theme === 'dark' ? 'text-slate-400' : 'text-slate-600';
  const gridColor = theme === 'dark' ? '#334155' : '#e2e8f0';
  const tooltipBg = theme === 'dark' ? '#1e293b' : '#ffffff';
  const tooltipBorder = theme === 'dark' ? '#475569' : '#e2e8f0';

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className={`text-2xl lg:text-3xl font-bold ${textP}`}>Reports</h1>
            <p className={`mt-0.5 ${textS}`}>Business analytics & insights — {filterLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={exportPDF} disabled={loading || invoices.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-slate-700 to-slate-800 text-white rounded-xl font-medium text-sm hover:from-slate-600 hover:to-slate-700 transition-all disabled:opacity-50">
            <FileText className="w-4 h-4" /> PDF
          </button>
          <button onClick={exportExcel} disabled={loading || invoices.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium text-sm shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50">
            <Download className="w-4 h-4" /> Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className={`rounded-2xl border p-4 ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Filter className={`w-4 h-4 ${textS}`} />
            <span className={`text-sm font-medium ${textS}`}>Period:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['today', 'date', 'month', 'year'] as FilterMode[]).map(mode => (
              <button key={mode} onClick={() => setFilterMode(mode)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  filterMode === mode
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg'
                    : theme === 'dark' ? 'bg-slate-800/50 text-slate-300 border border-slate-700/50 hover:bg-slate-700/50' : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}>
                {mode === 'today' ? 'Today' : mode === 'date' ? 'Date' : mode === 'month' ? 'Month' : 'Year'}
              </button>
            ))}
          </div>
          {filterMode === 'date' && (
            <div className="w-44">
              <DatePicker value={selectedDate} onChange={setSelectedDate} placeholder="Select date" />
            </div>
          )}
          {filterMode === 'month' && (
            <div className="w-48">
              <MonthPicker value={selectedMonth} onChange={setSelectedMonth} placeholder="Select month" />
            </div>
          )}
          {filterMode === 'year' && (
            <div className="w-36">
              <YearPicker value={selectedYear} onChange={setSelectedYear} />
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Gross Sales', value: formatCurrency(analytics.totalSales), icon: DollarSign, color: 'from-blue-500 to-cyan-500' },
              { label: 'Net Profit', value: formatCurrency(analytics.netProfit), icon: TrendingUp, color: 'from-emerald-500 to-teal-500' },
              { label: 'Invoices', value: analytics.totalInvoices, icon: FileText, color: 'from-purple-500 to-pink-500' },
              { label: 'Discount', value: formatCurrency(analytics.totalDiscount), icon: ShoppingCart, color: 'from-amber-500 to-orange-500' },
              { label: 'Paid', value: formatCurrency(analytics.totalPaid), icon: DollarSign, color: 'from-cyan-500 to-blue-500' },
              { label: 'Outstanding', value: formatCurrency(analytics.totalOutstanding), icon: Calendar, color: analytics.totalOutstanding > 0 ? 'from-red-500 to-rose-500' : 'from-emerald-500 to-teal-500' },
            ].map(card => (
              <div key={card.label} className={`rounded-2xl border p-4 ${cardBg}`}>
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center mb-2`}>
                  <card.icon className="w-4 h-4 text-white" />
                </div>
                <p className={`text-xs ${textS}`}>{card.label}</p>
                <p className={`text-lg font-bold mt-0.5 ${textP}`}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* Charts */}
          {analytics.dailyData.length > 1 && (
            <div className={`rounded-2xl border p-5 ${cardBg}`}>
              <h3 className={`font-semibold mb-4 ${textP}`}>Revenue Trend</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.dailyData}>
                    <defs>
                      <linearGradient id="rptGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="date" tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 11 }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                    <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 12, fontSize: 12 }}
                      formatter={(value) => [formatCurrency(Number(value)), 'Revenue']} />
                    <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2.5} fill="url(#rptGrad)" name="Gross Sales" />
                    <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2.5} fill="none" name="Net Profit" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Tables Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            {/* Top Products */}
            <div className={`rounded-2xl border p-5 ${cardBg}`}>
              <div className="flex items-center gap-2 mb-4">
                <Package className="w-5 h-5 text-emerald-500" />
                <h3 className={`font-semibold ${textP}`}>Top Products</h3>
              </div>
              {analytics.topProducts.length === 0 ? (
                <p className={`text-sm py-8 text-center ${textS}`}>No sales data</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={theme === 'dark' ? 'border-b border-slate-700/50' : 'border-b border-slate-200'}>
                        <th className={`text-left py-2 font-medium ${textS}`}>#</th>
                        <th className={`text-left py-2 font-medium ${textS}`}>Product</th>
                        <th className={`text-right py-2 font-medium ${textS}`}>Qty</th>
                        <th className={`text-right py-2 font-medium ${textS}`}>Sales</th>
                        <th className={`text-right py-2 font-medium ${textS}`}>Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.topProducts.map((p, i) => (
                        <tr key={p.name} className={theme === 'dark' ? 'border-b border-slate-700/30' : 'border-b border-slate-100'}>
                          <td className={`py-2.5 ${textS}`}>{i + 1}</td>
                          <td className={`py-2.5 font-medium ${textP}`}>{p.name}</td>
                          <td className={`py-2.5 text-right ${textS}`}>{p.qty}</td>
                          <td className={`py-2.5 text-right font-medium ${textP}`}>{formatCurrency(p.revenue)}</td>
                          <td className={`py-2.5 text-right font-medium text-emerald-500`}>{formatCurrency(p.profit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Top Customers */}
            <div className={`rounded-2xl border p-5 ${cardBg}`}>
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-blue-500" />
                <h3 className={`font-semibold ${textP}`}>Top Customers</h3>
              </div>
              {analytics.topCustomers.length === 0 ? (
                <p className={`text-sm py-8 text-center ${textS}`}>No customer data</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={theme === 'dark' ? 'border-b border-slate-700/50' : 'border-b border-slate-200'}>
                        <th className={`text-left py-2 font-medium ${textS}`}>#</th>
                        <th className={`text-left py-2 font-medium ${textS}`}>Customer</th>
                        <th className={`text-right py-2 font-medium ${textS}`}>Bills</th>
                        <th className={`text-right py-2 font-medium ${textS}`}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.topCustomers.map((c, i) => (
                        <tr key={c.name} className={theme === 'dark' ? 'border-b border-slate-700/30' : 'border-b border-slate-100'}>
                          <td className={`py-2.5 ${textS}`}>{i + 1}</td>
                          <td className={`py-2.5 font-medium ${textP}`}>{c.name}</td>
                          <td className={`py-2.5 text-right ${textS}`}>{c.count}</td>
                          <td className={`py-2.5 text-right font-medium ${textP}`}>{formatCurrency(c.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Payment Methods + Invoice Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            {/* Payment Methods */}
            <div className={`rounded-2xl border p-5 ${cardBg}`}>
              <h3 className={`font-semibold mb-4 ${textP}`}>Payment Methods</h3>
              <div className="space-y-3">
                {Object.entries(analytics.paymentMethods).map(([method, data]) => {
                  const pct = analytics.totalSales > 0 ? (data.total / analytics.totalSales * 100) : 0;
                  const label = method === 'CASH' ? 'Cash' : method === 'CARD' ? 'Card' : method === 'BANK_TRANSFER' ? 'Bank Transfer' : method;
                  return (
                    <div key={method}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm ${textP}`}>{label} ({data.count})</span>
                        <span className={`text-sm font-medium ${textP}`}>{formatCurrency(data.total)}</span>
                      </div>
                      <div className={`h-2 rounded-full ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-slate-100'}`}>
                        <div className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                {Object.keys(analytics.paymentMethods).length === 0 && (
                  <p className={`text-sm py-4 text-center ${textS}`}>No data</p>
                )}
              </div>
            </div>

            {/* Invoice Type Breakdown */}
            <div className={`rounded-2xl border p-5 ${cardBg}`}>
              <h3 className={`font-semibold mb-4 ${textP}`}>Invoice Breakdown</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className={`rounded-xl border p-4 ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700/50' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mb-2">
                    <Zap className="w-4 h-4 text-white" />
                  </div>
                  <p className={`text-xs ${textS}`}>Quick</p>
                  <p className={`text-xl font-bold ${textP}`}>{analytics.quickCount}</p>
                  <p className={`text-xs mt-1 ${textS}`}>{formatCurrency(analytics.quickTotal)}</p>
                </div>
                <div className={`rounded-xl border p-4 ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700/50' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-2">
                    <ShoppingCart className="w-4 h-4 text-white" />
                  </div>
                  <p className={`text-xs ${textS}`}>Wholesale</p>
                  <p className={`text-xl font-bold ${textP}`}>{analytics.wholesaleCount}</p>
                  <p className={`text-xs mt-1 ${textS}`}>{formatCurrency(analytics.wholesaleTotal)}</p>
                </div>
              </div>
              {/* Cashier breakdown */}
              {Object.keys(analytics.cashiers).length > 0 && (
                <div className="mt-4 pt-4 border-t" style={{ borderColor: theme === 'dark' ? '#334155' : '#e2e8f0' }}>
                  <h4 className={`text-sm font-medium mb-2 ${textP}`}>By Cashier</h4>
                  {Object.entries(analytics.cashiers).map(([name, data]) => (
                    <div key={name} className="flex items-center justify-between py-1.5 text-sm">
                      <span className={textS}>{name} ({data.count})</span>
                      <span className={`font-medium ${textP}`}>{formatCurrency(data.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Cash Drawer Sessions */}
          {drawerSessions.length > 0 && (
            <div className={`rounded-2xl border overflow-hidden ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
              <div className={`px-5 py-4 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                <h3 className={`font-semibold ${textP}`}>Cash Drawer Sessions ({drawerSessions.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className={theme === 'dark' ? 'bg-slate-800/30' : 'bg-slate-50'}>
                    <tr>
                      {['Opened At', 'Cashier', 'Starting', 'Expected', 'Actual', 'Difference', 'Status'].map(h => (
                        <th key={h} className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${textS}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${theme === 'dark' ? 'divide-slate-700/50' : 'divide-slate-200'}`}>
                    {drawerSessions.map((session: any) => (
                      <tr key={session.id} className={`transition-colors ${theme === 'dark' ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'}`}>
                        <td className={`px-4 py-3 ${textS}`}>{new Date(session.openedAt).toLocaleString('en-LK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                        <td className={`px-4 py-3 font-medium ${textP}`}>{session.user?.name || 'Unknown'}</td>
                        <td className={`px-4 py-3 ${textS}`}>{formatCurrency(Number(session.startingCash))}</td>
                        <td className={`px-4 py-3 ${textS}`}>{formatCurrency(Number(session.expectedCash))}</td>
                        <td className={`px-4 py-3 ${textS}`}>{formatCurrency(Number(session.actualCash))}</td>
                        <td className={`px-4 py-3 font-semibold ${Number(session.difference) === 0 ? 'text-emerald-500' : Number(session.difference) > 0 ? 'text-blue-500' : 'text-red-500'}`}>
                          {Number(session.difference) > 0 ? '+' : ''}{formatCurrency(Number(session.difference))}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            session.status === 'CLOSED' ? 'bg-slate-500/10 text-slate-400' : 'bg-emerald-500/10 text-emerald-400'
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {session.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Invoice List */}
          {invoices.length > 0 && (
            <div className={`rounded-2xl border overflow-hidden ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
              <div className={`px-5 py-4 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                <h3 className={`font-semibold ${textP}`}>All Invoices ({invoices.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className={theme === 'dark' ? 'bg-slate-800/30' : 'bg-slate-50'}>
                    <tr>
                      {['Invoice', 'Type', 'Customer', 'Method', 'Status', 'Total', 'Date'].map(h => (
                        <th key={h} className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${textS}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${theme === 'dark' ? 'divide-slate-700/50' : 'divide-slate-200'}`}>
                    {invoices.map(inv => (
                      <tr key={inv.id} className={`transition-colors ${theme === 'dark' ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'}`}>
                        <td className={`px-4 py-3 font-medium ${textP}`}>{inv.invoiceNumber}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            inv.type === 'WHOLESALE'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>{inv.type === 'WHOLESALE' ? 'Wholesale' : 'Quick'}</span>
                        </td>
                        <td className={`px-4 py-3 ${textS}`}>{inv.customerName || 'Walk-in'}</td>
                        <td className={`px-4 py-3 ${textS}`}>{inv.paymentMethod}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            inv.paymentStatus === 'PAID' ? 'bg-emerald-500/10 text-emerald-400' :
                            inv.paymentStatus === 'PARTIAL' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {inv.paymentStatus}
                          </span>
                        </td>
                        <td className={`px-4 py-3 font-medium ${textP}`}>{formatCurrency(Number(inv.total))}</td>
                        <td className={`px-4 py-3 ${textS}`}>{new Date(inv.createdAt).toLocaleString('en-LK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {invoices.length === 0 && !loading && (
            <div className={`rounded-2xl border p-12 text-center ${cardBg}`}>
              <BarChart3 className={`w-12 h-12 mx-auto mb-3 ${textS}`} />
              <h3 className={`font-semibold ${textP}`}>No data for this period</h3>
              <p className={`text-sm mt-1 ${textS}`}>Try selecting a different date range</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
export default Reports;
