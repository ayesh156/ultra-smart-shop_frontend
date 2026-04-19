import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import {
  Package, ShoppingCart, DollarSign, AlertTriangle,
  TrendingUp, Users, Zap, BarChart3, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import api from '../lib/api';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

interface Stats {
  totalProducts: number;
  totalCategories: number;
  totalBrands: number;
  totalCustomers: number;
  todayInvoices: number;
  todayRevenue: number;
  yesterdayRevenue: number;
  monthRevenue: number;
  lowStockCount: number;
}

interface Invoice {
  id: string; invoiceNumber: string; type: string; total: string | number;
  paymentMethod: string; paymentStatus: string; createdAt: string;
  customerName: string | null; items: Array<{ productName: string; quantity: number; total: number }>;
}

const CHART_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#14b8a6'];

const Dashboard: React.FC = () => {
  const { theme } = useTheme();
  const { shop } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalProducts: 0, totalCategories: 0, totalBrands: 0, totalCustomers: 0,
    todayInvoices: 0, todayRevenue: 0, yesterdayRevenue: 0, monthRevenue: 0, lowStockCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [weeklyData, setWeeklyData] = useState<Array<{ day: string; revenue: number; invoices: number }>>([]);
  const [paymentMethodData, setPaymentMethodData] = useState<Array<{ name: string; value: number }>>([]);
  const [topProducts, setTopProducts] = useState<Array<{ name: string; sold: number; revenue: number }>>([]);
  const [invoiceTypeData, setInvoiceTypeData] = useState<Array<{ name: string; value: number }>>([]);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 6);
        const weekAgoStr = weekAgo.toISOString().split('T')[0];

        const [products, categories, brands, customers, todayInv, yesterdayInv, monthInv, weekInv, lowStock] =
          await Promise.all([
            api.get('/products'),
            api.get('/categories'),
            api.get('/brands'),
            api.get('/customers'),
            api.get(`/invoices?from=${todayStr}`),
            api.get(`/invoices?from=${yesterdayStr}&to=${yesterdayStr}T23:59:59`),
            api.get(`/invoices?from=${monthStart}`),
            api.get(`/invoices?from=${weekAgoStr}`),
            api.get('/stock/low-stock'),
          ]);

        const todayInvoices: Invoice[] = (todayInv.data.data || []).filter((i: Invoice) => i.paymentStatus !== 'VOID');
        const yesterdayInvoices: Invoice[] = (yesterdayInv.data.data || []).filter((i: Invoice) => i.paymentStatus !== 'VOID');
        const monthInvoices: Invoice[] = (monthInv.data.data || []).filter((i: Invoice) => i.paymentStatus !== 'VOID');
        const weekInvoices: Invoice[] = (weekInv.data.data || []).filter((i: Invoice) => i.paymentStatus !== 'VOID');

        const todayRevenue = todayInvoices.reduce((s, i) => s + Number(i.total), 0);
        const yesterdayRevenue = yesterdayInvoices.reduce((s, i) => s + Number(i.total), 0);
        const monthRevenue = monthInvoices.reduce((s, i) => s + Number(i.total), 0);

        setStats({
          totalProducts: (products.data.data || []).length,
          totalCategories: (categories.data.data || []).length,
          totalBrands: (brands.data.data || []).length,
          totalCustomers: (customers.data.data || []).length,
          todayInvoices: todayInvoices.length,
          todayRevenue, yesterdayRevenue, monthRevenue,
          lowStockCount: (lowStock.data.data || []).length,
        });

        // Weekly sales data (last 7 days)
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const weekly: Array<{ day: string; revenue: number; invoices: number }> = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const dateKey = d.toISOString().split('T')[0];
          const dayInvoices = weekInvoices.filter(inv => inv.createdAt.startsWith(dateKey));
          weekly.push({
            day: dayNames[d.getDay()],
            revenue: dayInvoices.reduce((s, inv) => s + Number(inv.total), 0),
            invoices: dayInvoices.length,
          });
        }
        setWeeklyData(weekly);

        // Payment method breakdown (this month)
        const pmMap: Record<string, number> = {};
        monthInvoices.forEach(inv => {
          const method = inv.paymentMethod || 'CASH';
          pmMap[method] = (pmMap[method] || 0) + Number(inv.total);
        });
        setPaymentMethodData(Object.entries(pmMap).map(([name, value]) => ({
          name: name === 'CASH' ? 'Cash' : name === 'CARD' ? 'Card' : name === 'BANK_TRANSFER' ? 'Bank Transfer' : name,
          value,
        })));

        // Top selling products (this month)
        const productMap: Record<string, { sold: number; revenue: number }> = {};
        monthInvoices.forEach(inv => {
          (inv.items || []).forEach(item => {
            if (!productMap[item.productName]) productMap[item.productName] = { sold: 0, revenue: 0 };
            productMap[item.productName].sold += item.quantity;
            productMap[item.productName].revenue += Number(item.total);
          });
        });
        const sorted = Object.entries(productMap).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 6);
        setTopProducts(sorted.map(([name, data]) => ({ name: name.length > 20 ? name.slice(0, 20) + '…' : name, ...data })));

        // Invoice type breakdown
        const typeMap: Record<string, number> = {};
        monthInvoices.forEach(inv => {
          const t = inv.type === 'WHOLESALE' ? 'Wholesale' : 'Quick';
          typeMap[t] = (typeMap[t] || 0) + 1;
        });
        setInvoiceTypeData(Object.entries(typeMap).map(([name, value]) => ({ name, value })));

      } catch { /* silent */ }
      finally { setLoading(false); }
    };
    loadDashboard();
  }, []);

  const revenueChange = stats.yesterdayRevenue > 0
    ? ((stats.todayRevenue - stats.yesterdayRevenue) / stats.yesterdayRevenue * 100)
    : stats.todayRevenue > 0 ? 100 : 0;

  const statCards = [
    { label: "Today's Revenue", value: formatCurrency(stats.todayRevenue), icon: DollarSign, color: 'from-emerald-500 to-teal-500', change: revenueChange },
    { label: "Today's Sales", value: stats.todayInvoices, icon: ShoppingCart, color: 'from-blue-500 to-cyan-500' },
    { label: 'Month Revenue', value: formatCurrency(stats.monthRevenue), icon: TrendingUp, color: 'from-purple-500 to-pink-500' },
    { label: 'Total Products', value: stats.totalProducts, icon: Package, color: 'from-amber-500 to-orange-500' },
    { label: 'Customers', value: stats.totalCustomers, icon: Users, color: 'from-cyan-500 to-blue-500' },
    { label: 'Low Stock', value: stats.lowStockCount, icon: AlertTriangle, color: 'from-red-500 to-rose-500' },
  ];

  const cardBg = theme === 'dark' ? 'bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm';
  const textPrimary = theme === 'dark' ? 'text-white' : 'text-slate-900';
  const textSecondary = theme === 'dark' ? 'text-slate-400' : 'text-slate-600';
  const gridColor = theme === 'dark' ? '#334155' : '#e2e8f0';
  const tooltipBg = theme === 'dark' ? '#1e293b' : '#ffffff';
  const tooltipBorder = theme === 'dark' ? '#475569' : '#e2e8f0';

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className={`text-2xl lg:text-3xl font-bold ${textPrimary}`}>Welcome back! 👋</h1>
          <p className={`mt-1 ${textSecondary}`}>{shop?.name} — Here's your business overview</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/quick-invoice" className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium shadow-lg hover:shadow-emerald-500/25 transition-all text-sm">
            <Zap className="w-4 h-4" /> Quick Invoice
          </a>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 lg:gap-4">
        {statCards.map((card) => (
          <div key={card.label} className={`relative overflow-hidden rounded-2xl border p-4 lg:p-5 ${cardBg}`}>
            <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${card.color} opacity-10 rounded-full blur-2xl`} />
            <div className="relative">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-lg mb-3`}>
                <card.icon className="w-5 h-5 text-white" />
              </div>
              <p className={`text-xs font-medium ${textSecondary}`}>{card.label}</p>
              <p className={`text-lg lg:text-xl font-bold mt-0.5 ${textPrimary}`}>
                {loading ? '—' : card.value}
              </p>
              {card.change !== undefined && !loading && (
                <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${card.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {card.change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {Math.abs(card.change).toFixed(0)}% vs yesterday
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row 1: Revenue Trend + Payment Methods */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Weekly Revenue Trend */}
        <div className={`rounded-2xl border p-5 lg:col-span-2 ${cardBg}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className={`font-semibold ${textPrimary}`}>Revenue Trend</h3>
              <p className={`text-xs ${textSecondary}`}>Last 7 days</p>
            </div>
            <div className={`p-2 rounded-xl ${theme === 'dark' ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
              <BarChart3 className="w-5 h-5 text-emerald-500" />
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyData}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="day" tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 12 }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 12, fontSize: 13 }}
                  formatter={(value) => [formatCurrency(Number(value)), 'Revenue']} />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods */}
        <div className={`rounded-2xl border p-5 ${cardBg}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className={`font-semibold ${textPrimary}`}>Payment Methods</h3>
              <p className={`text-xs ${textSecondary}`}>This month</p>
            </div>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={paymentMethodData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
                  {paymentMethodData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 12, fontSize: 13 }}
                  formatter={(value) => [formatCurrency(Number(value))]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-2">
            {paymentMethodData.map((item, i) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className={textSecondary}>{item.name}</span>
                </div>
                <span className={`font-medium ${textPrimary}`}>{formatCurrency(item.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row 2: Top Products + Invoice Types */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Top Products */}
        <div className={`rounded-2xl border p-5 lg:col-span-2 ${cardBg}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className={`font-semibold ${textPrimary}`}>Top Selling Products</h3>
              <p className={`text-xs ${textSecondary}`}>This month by revenue</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProducts} layout="vertical" barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                <XAxis type="number" tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 12 }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <YAxis dataKey="name" type="category" width={120}
                  tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 12, fontSize: 13 }}
                  formatter={(value, name) => [name === 'revenue' ? formatCurrency(Number(value)) : value, name === 'revenue' ? 'Revenue' : 'Sold']} />
                <Bar dataKey="revenue" fill="#10b981" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Invoice Type + Quick Actions */}
        <div className="space-y-4">
          <div className={`rounded-2xl border p-5 ${cardBg}`}>
            <h3 className={`font-semibold mb-3 ${textPrimary}`}>Invoice Types</h3>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={invoiceTypeData} cx="50%" cy="50%" outerRadius={55} dataKey="value" label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}>
                    {invoiceTypeData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quick Actions */}
          <div className={`rounded-2xl border p-5 ${cardBg}`}>
            <h3 className={`font-semibold mb-3 ${textPrimary}`}>Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Quick Invoice', icon: Zap, path: '/quick-invoice', color: 'from-emerald-500 to-teal-500' },
                { label: 'Wholesale', icon: ShoppingCart, path: '/wholesale-invoice', color: 'from-blue-500 to-cyan-500' },
                { label: 'Products', icon: Package, path: '/products', color: 'from-purple-500 to-pink-500' },
                { label: 'Reports', icon: BarChart3, path: '/reports', color: 'from-amber-500 to-orange-500' },
              ].map((action) => (
                <a key={action.label} href={action.path}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all hover:scale-105 ${
                    theme === 'dark' ? 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}>
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${action.color} flex items-center justify-center`}>
                    <action.icon className="w-4 h-4 text-white" />
                  </div>
                  <span className={`text-xs font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{action.label}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
