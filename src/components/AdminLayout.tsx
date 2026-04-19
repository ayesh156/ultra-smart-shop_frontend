import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth, type CashierAction } from '../contexts/AuthContext';
import {
  LayoutDashboard, Package, FolderTree, Building, BarChart3,
  FileText, Zap, ShoppingCart, Settings, Menu, X, Moon, Sun,
  LogOut, Users, Truck, Tag, Archive,
  PanelLeftClose, PanelLeftOpen, ChevronDown
} from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { formatCurrency } from '../lib/utils';

interface NavItem {
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  /** If set, nav item is hidden when `can(action)` returns false */
  requiredPermission?: CashierAction;
  adminOnly?: boolean;
}

const allNavItems: NavItem[] = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard', adminOnly: true },
  { path: '/quick-invoice', icon: Zap, label: 'Quick Invoice' },
  { path: '/wholesale-invoice', icon: ShoppingCart, label: 'Wholesale Invoice', requiredPermission: 'createWholesale' },
  { path: '/invoices', icon: FileText, label: 'Invoices' },
  { path: '/products', icon: Package, label: 'Products' },
  { path: '/categories', icon: FolderTree, label: 'Categories' },
  { path: '/brands', icon: Building, label: 'Brands' },
  { path: '/barcode-print', icon: Tag, label: 'Barcode Print' },
  { path: '/customers', icon: Users, label: 'Customers' },
  { path: '/suppliers', icon: Truck, label: 'Suppliers' },
  { path: '/stock', icon: BarChart3, label: 'Stock Management', requiredPermission: 'adjustStock' },
  { path: '/reports', icon: FileText, label: 'Reports' },
  { path: '/settings', icon: Settings, label: 'Settings', adminOnly: true },
];

export const AdminLayout: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { user, shop, logout, can } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Cash Drawer
  const [drawerSession, setDrawerSession] = useState<any>(null);
  const [showDrawerModal, setShowDrawerModal] = useState(false);
  const [drawerAmount, setDrawerAmount] = useState('');
  const [drawerNotes, setDrawerNotes] = useState('');

  const loadDrawer = async () => {
    try {
      const r = await api.get('/cash-drawer/current');
      setDrawerSession(r.data.data);
    } catch { /* */ }
  };

  useEffect(() => {
    loadDrawer();
  }, [location.pathname]);

  const handleDrawerSubmit = async () => {
    try {
      if (drawerSession) {
        // close
        await api.post(`/cash-drawer/${drawerSession.id}/close`, {
          actualCash: Number(drawerAmount),
          notes: drawerNotes
        });
        toast.success('Drawer closed successfully');
      } else {
        // open
        await api.post('/cash-drawer/open', {
          startingCash: Number(drawerAmount),
          notes: drawerNotes
        });
        toast.success('Drawer opened successfully');
      }
      setShowDrawerModal(false);
      setDrawerAmount('');
      setDrawerNotes('');
      loadDrawer();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to update drawer');
    }
  };

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => { setMobileSidebarOpen(false); }, [location.pathname]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const active = document.activeElement as HTMLElement | null;
      if (active && active !== document.body) {
        const tag = active.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || active.isContentEditable) return;
      }

      const inputs = Array.from(document.querySelectorAll('input')) as HTMLInputElement[];
      const target = inputs.find((input) => {
        if (input.disabled || input.readOnly) return false;
        if (input.offsetParent === null) return false;
        const placeholder = (input.placeholder || '').toLowerCase();
        const id = (input.id || '').toLowerCase();
        const name = (input.name || '').toLowerCase();
        const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();
        return input.type === 'search' || placeholder.includes('search') || id.includes('search') || name.includes('search') || ariaLabel.includes('search');
      });

      if (target) {
        target.focus();
        target.select();
      }
    }, 120);

    return () => window.clearTimeout(timer);
  }, [location.pathname]);

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => { setUserMenuOpen(false); logout(); navigate('/login'); };

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const isDark = theme === 'dark';

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b ${
        isDark ? 'border-slate-700/50' : 'border-slate-200'
      }`}>
        <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg flex-shrink-0">
          <img src="/images/logo.png" alt="Logo" className="w-full h-full object-cover" />
        </div>
        {!sidebarCollapsed && (
          <div className="flex-1 min-w-0">
            <h1 className={`text-lg font-bold truncate ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>Ultra Smart</h1>
            <p className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {shop?.name || 'POS System'}
            </p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {allNavItems.filter(item => {
          if (item.adminOnly && user?.role === 'CASHIER') return false;
          if (item.requiredPermission && !can(item.requiredPermission)) return false;
          return true;
        }).map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                active
                  ? isDark
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : isDark
                    ? 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-emerald-500' : ''}`} />
              {!sidebarCollapsed && <span className="text-sm font-medium">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Sidebar Collapse Toggle — Bottom */}
      {!isMobile && (
        <div className={`px-3 py-3 border-t ${isDark ? 'border-slate-700/50' : 'border-slate-200'}`}>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
              isDark
                ? 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed
              ? <PanelLeftOpen className="w-5 h-5 flex-shrink-0" />
              : <PanelLeftClose className="w-5 h-5 flex-shrink-0" />
            }
            {!sidebarCollapsed && <span className="text-sm font-medium">Collapse</span>}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className={`min-h-screen ${
      isDark
        ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950'
        : 'bg-gradient-to-br from-slate-50 to-white'
    }`}>
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full z-50 transition-all duration-300 ${
        isDark ? 'bg-slate-900/95 border-r border-slate-700/50' : 'bg-white border-r border-slate-200'
      } ${isMobile
        ? `${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} w-72`
        : `${sidebarCollapsed ? 'w-[72px]' : 'w-64'}`
      }`} style={{ backdropFilter: 'blur(12px)' }}>
        <SidebarContent />
        {/* Close button mobile */}
        {isMobile && mobileSidebarOpen && (
          <button onClick={() => setMobileSidebarOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-lg bg-slate-800 text-white">
            <X className="w-5 h-5" />
          </button>
        )}
      </aside>

      {/* Main */}
      <div className={`transition-all duration-300 ${
        isMobile ? 'ml-0' : sidebarCollapsed ? 'ml-[72px]' : 'ml-64'
      }`}>
        {/* Top bar */}
        <header className={`sticky top-0 z-30 px-4 lg:px-6 py-3 flex items-center justify-between backdrop-blur-xl ${
          isDark
            ? 'bg-slate-900/80 border-b border-slate-700/50'
            : 'bg-white/80 border-b border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            {isMobile && (
              <button onClick={() => setMobileSidebarOpen(true)} className={`p-2 rounded-xl ${
                isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'
              }`}>
                <Menu className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Right side — Theme toggle + User menu */}
          <div className="flex items-center gap-2">
            <button onClick={() => setShowDrawerModal(true)} className={`hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl font-medium shadow-sm transition-all text-xs border ${drawerSession ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20'}`}>
              <Archive className="w-3.5 h-3.5" /> {drawerSession ? 'Close Drawer' : 'Open Drawer'}
            </button>
            {/* Theme toggle */}
            <button onClick={toggleTheme} className={`p-2.5 rounded-xl border transition-all ${
              isDark
                ? 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-700/50 text-slate-400'
                : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
            }`}>
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* User Account Dropdown */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className={`flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl border transition-all ${
                  userMenuOpen
                    ? isDark ? 'bg-slate-800 border-emerald-500/30 ring-2 ring-emerald-500/10' : 'bg-slate-50 border-emerald-500/30 ring-2 ring-emerald-500/10'
                    : isDark ? 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600' : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                  isDark ? 'bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                }`}>
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="hidden sm:block text-left">
                  <p className={`text-sm font-medium leading-tight truncate max-w-[120px] ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {user?.name || 'User'}
                  </p>
                  <p className={`text-[10px] font-medium uppercase tracking-wider ${
                    user?.role === 'SUPER_ADMIN' ? 'text-amber-400' : 'text-emerald-500'
                  }`}>
                    {user?.role?.replace('_', ' ') || 'USER'}
                  </p>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform hidden sm:block ${userMenuOpen ? 'rotate-180' : ''} ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              </button>

              {/* Dropdown menu */}
              {userMenuOpen && (
                <div className={`absolute right-0 top-full mt-2 w-56 rounded-xl border shadow-xl overflow-hidden z-50 ${
                  isDark ? 'bg-slate-800 border-slate-700/50 shadow-black/40' : 'bg-white border-slate-200 shadow-slate-200/60'
                }`}>
                  {/* User info header */}
                  <div className={`px-4 py-3 border-b ${isDark ? 'border-slate-700/50' : 'border-slate-100'}`}>
                    <p className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{user?.name}</p>
                    <p className={`text-xs truncate mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{user?.email}</p>
                    <span className={`inline-flex items-center mt-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                      user?.role === 'SUPER_ADMIN'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : user?.role === 'ADMIN'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    }`}>
                      {user?.role?.replace('_', ' ')}
                    </span>
                  </div>
                  {/* Menu items */}
                  <div className="py-1">
                    <button
                      onClick={() => { setUserMenuOpen(false); navigate('/settings'); }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                        isDark ? 'text-slate-300 hover:bg-slate-700/60 hover:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </button>
                    <button
                      onClick={() => { setUserMenuOpen(false); setShowDrawerModal(true); }}
                      className={`w-full sm:hidden flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                        isDark ? 'text-slate-300 hover:bg-slate-700/60 hover:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <Archive className="w-4 h-4" />
                      {drawerSession ? 'Close Drawer' : 'Open Drawer'}
                    </button>
                    <button
                      onClick={handleLogout}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                        isDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-500 hover:bg-red-50'
                      }`}
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      {/* Cash Drawer Modal */}
      {showDrawerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{drawerSession ? 'Close Cash Drawer' : 'Open Cash Drawer'}</h2>
              <button onClick={() => setShowDrawerModal(false)} className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {drawerSession && (
              <div className={`mb-4 p-4 rounded-xl border ${isDark ? 'bg-slate-700/30 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex justify-between text-sm mb-2"><span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Starting Cash</span> <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{formatCurrency(Number(drawerSession.startingCash))}</span></div>
                <div className="flex justify-between text-sm mb-2"><span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Cash Sales</span> <span className={`font-semibold text-emerald-500`}>+{formatCurrency(Number(drawerSession.cashSales || 0))}</span></div>
                <div className="flex justify-between text-sm mb-2 pt-2 border-t border-slate-200 dark:border-slate-600"><span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Expected Cash</span> <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{formatCurrency(Number(drawerSession.expectedCash || 0))}</span></div>
                
                {drawerAmount && (
                  <div className={`flex justify-between text-sm mb-2 pt-2 border-t border-slate-200 dark:border-slate-600`}>
                    <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Difference</span> 
                    <span className={`font-bold ${Number(drawerAmount) - Number(drawerSession.expectedCash || 0) === 0 ? 'text-emerald-500' : Number(drawerAmount) - Number(drawerSession.expectedCash || 0) > 0 ? 'text-blue-500' : 'text-red-500'}`}>
                      {Number(drawerAmount) - Number(drawerSession.expectedCash || 0) > 0 ? '+' : ''}{formatCurrency(Number(drawerAmount) - Number(drawerSession.expectedCash || 0))}
                    </span>
                  </div>
                )}
                <div className={`text-xs mt-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Enter the actual physical cash amount currently in the drawer to close the session.</div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{drawerSession ? 'Actual Cash in Drawer' : 'Starting Cash'}</label>
                <input type="number" value={drawerAmount} onChange={e => setDrawerAmount(e.target.value)} placeholder={drawerSession ? drawerSession.expectedCash?.toString() : "0.00"} 
                  className={`w-full px-4 py-2.5 rounded-xl border outline-none ${isDark ? 'bg-slate-900/50 border-slate-700 text-white focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-900 focus:border-emerald-500'}`} autoFocus />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Notes (Optional)</label>
                <textarea value={drawerNotes} onChange={e => setDrawerNotes(e.target.value)} placeholder="Any discrepancies or notes..." rows={2}
                  className={`w-full px-4 py-2.5 rounded-xl border outline-none ${isDark ? 'bg-slate-900/50 border-slate-700 text-white focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-900 focus:border-emerald-500'}`} />
              </div>
              <button onClick={handleDrawerSubmit} className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all ${drawerSession ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:shadow-amber-500/25' : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:shadow-emerald-500/25'}`}>
                {drawerSession ? 'Close Drawer' : 'Open Drawer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
