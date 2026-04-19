import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import {
  Settings as SettingsIcon, Palette, Moon, Sun, Barcode, Save,
  Users, Plus, Edit, Trash2, Shield, ShieldCheck, Eye, EyeOff,
  Loader2, KeyRound, ToggleLeft, ToggleRight, Info, UserCog,
  Package, UserCheck, Truck, BarChart3, Warehouse, Receipt
} from 'lucide-react';
import { DeleteConfirmationModal } from '../components/modals/DeleteConfirmationModal';
import api from '../lib/api';
import toast from 'react-hot-toast';

const accents = [
  { key: 'emerald' as const, label: 'Emerald', hex: '#10b981' },
  { key: 'blue' as const, label: 'Blue', hex: '#3b82f6' },
  { key: 'purple' as const, label: 'Purple', hex: '#a855f7' },
  { key: 'rose' as const, label: 'Rose', hex: '#f43f5e' },
  { key: 'amber' as const, label: 'Amber', hex: '#f59e0b' },
  { key: 'indigo' as const, label: 'Indigo', hex: '#6366f1' },
];

type Tab = 'appearance' | 'barcode' | 'users' | 'staffAccess' | 'about';
interface UserItem { id: string; name: string; email: string; role: string; isActive: boolean; createdAt: string; }

const Settings: React.FC = () => {
  const { theme, toggleTheme, accentColor, setAccentColor } = useTheme();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const [activeTab, setActiveTab] = useState<Tab>('appearance');

  // Barcode
  const [barcodePrefix, setBarcodePrefix] = useState('');
  const [barcodeSaving, setBarcodeSaving] = useState(false);
  const [barcodePreview, setBarcodePreview] = useState('');
  const [lastBarcode, setLastBarcode] = useState('');

  // Users
  const [users, setUsers] = useState<UserItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [editUserItem, setEditUserItem] = useState<UserItem | null>(null);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'CASHIER' });
  const [savingUser, setSavingUser] = useState(false);
  const [deleteUserTarget, setDeleteUserTarget] = useState<UserItem | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);
  const [passwordUserId, setPasswordUserId] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPasswords, setShowPasswords] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Staff Access Permissions
  const [staffPerms, setStaffPerms] = useState({
    cashierCanCreateProducts: true,
    cashierCanEditProducts: false,
    cashierCanCreateCustomers: true,
    cashierCanEditCustomers: false,
    cashierCanCreateSuppliers: true,
    cashierCanEditSuppliers: false,
    cashierCanViewReports: false,
    cashierCanAdjustStock: false,
    cashierCanCreateWholesale: true,
  });
  const [staffPermsSaving, setStaffPermsSaving] = useState(false);

  const loadShopSettings = useCallback(async () => {
    try {
      const r = await api.get('/shop');
      const shop = r.data.data;
      setBarcodePrefix(shop.barcodePrefix || '');

      setLastBarcode(shop.lastBarcode || '');
      // Load staff permissions
      setStaffPerms({
        cashierCanCreateProducts: shop.cashierCanCreateProducts ?? true,
        cashierCanEditProducts: shop.cashierCanEditProducts ?? false,
        cashierCanCreateCustomers: shop.cashierCanCreateCustomers ?? true,
        cashierCanEditCustomers: shop.cashierCanEditCustomers ?? false,
        cashierCanCreateSuppliers: shop.cashierCanCreateSuppliers ?? true,
        cashierCanEditSuppliers: shop.cashierCanEditSuppliers ?? false,
        cashierCanViewReports: shop.cashierCanViewReports ?? false,
        cashierCanAdjustStock: shop.cashierCanAdjustStock ?? false,
        cashierCanCreateWholesale: shop.cashierCanCreateWholesale ?? true,
      });
    } catch { /* silent */ }
  }, []);

  const loadUsers = useCallback(async () => {
    if (!isAdmin) return;
    setUsersLoading(true);
    try { const r = await api.get('/users'); setUsers(r.data.data || []); }
    catch { toast.error('Failed to load users'); }
    finally { setUsersLoading(false); }
  }, [isAdmin]);

  useEffect(() => { loadShopSettings(); }, [loadShopSettings]);
  useEffect(() => { if (activeTab === 'users') loadUsers(); }, [activeTab, loadUsers]);

  useEffect(() => {
    const prefix = barcodePrefix.replace(/\D/g, '');
    const dataLen = 12;
    const suffixLen = Math.max(1, dataLen - prefix.length);
    // EAN-13 check digit calc
    const calcCheck = (d: string) => { let s = 0; for (let i = 0; i < 12; i++) s += parseInt(d[i]) * (i % 2 === 0 ? 1 : 3); return ((10 - (s % 10)) % 10).toString(); };
    let data12: string;
    if (lastBarcode && lastBarcode.length === 13 && /^\d{13}$/.test(lastBarcode)) {
      const lastSuffix = lastBarcode.slice(0, 12).slice(prefix.length);
      const nextNum = BigInt(lastSuffix) + 1n;
      let nextSuffix = nextNum.toString().padStart(suffixLen, '0');
      if (nextSuffix.length > suffixLen) nextSuffix = '1'.padStart(suffixLen, '0');
      data12 = (prefix + nextSuffix).padStart(12, '0').slice(0, 12);
    } else {
      data12 = (prefix + '1'.padStart(suffixLen, '0')).padStart(12, '0').slice(0, 12);
    }
    setBarcodePreview(data12 + calcCheck(data12));
  }, [barcodePrefix, lastBarcode]);

  const saveBarcodeSettings = async () => {
    setBarcodeSaving(true);
    try { await api.put('/shop', { barcodePrefix: barcodePrefix.replace(/\D/g, ''), barcodeLength: 13, barcodeNumbersOnly: true, lastBarcode: null }); toast.success('Barcode settings saved'); setLastBarcode(''); }
    catch (err: unknown) { toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save barcode settings'); }
    finally { setBarcodeSaving(false); }
  };

  const handleSaveUser = async () => {
    if (!userForm.name.trim() || !userForm.email.trim()) { toast.error('Name and email required'); return; }
    if (!editUserItem && !userForm.password) { toast.error('Password required for new users'); return; }
    setSavingUser(true);
    try {
      if (editUserItem) {
        await api.put(`/users/${editUserItem.id}`, { name: userForm.name, email: userForm.email, role: userForm.role });
        toast.success('User updated');
      } else {
        await api.post('/users', userForm);
        toast.success('User created');
      }
      setShowUserForm(false); setEditUserItem(null);
      setUserForm({ name: '', email: '', password: '', role: 'CASHIER' });
      loadUsers();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed');
    } finally { setSavingUser(false); }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserTarget) return;
    setDeletingUser(true);
    try { await api.delete(`/users/${deleteUserTarget.id}`); toast.success('User deactivated'); setDeleteUserTarget(null); loadUsers(); }
    catch (err: unknown) { toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed'); }
    finally { setDeletingUser(false); }
  };

  const handleToggleActive = async (u: UserItem) => {
    try { await api.put(`/users/${u.id}`, { isActive: !u.isActive }); toast.success(u.isActive ? 'Deactivated' : 'Activated'); loadUsers(); }
    catch (err: unknown) { toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed'); }
  };

  const handleChangePassword = async () => {
    if (!passwordUserId) return;
    if (!passwordForm.newPassword) { toast.error('New password required'); return; }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) { toast.error('Passwords do not match'); return; }
    if (passwordUserId === user?.id && !passwordForm.currentPassword) { toast.error('Current password required'); return; }
    setChangingPassword(true);
    try {
      await api.put(`/users/${passwordUserId}/password`, {
        currentPassword: passwordForm.currentPassword || undefined,
        newPassword: passwordForm.newPassword,
      });
      toast.success('Password changed');
      setPasswordUserId(null);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed');
    } finally { setChangingPassword(false); }
  };

  const saveStaffAccess = async () => {
    setStaffPermsSaving(true);
    try {
      await api.put('/shop', staffPerms);
      toast.success('Staff access saved');
      // Reload auth context shop data so `can()` uses new perms immediately
      try {
        const r = await api.get('/auth/me');
        if (r.data.success && r.data.data.shop) {
          // AuthContext will be updated via the background /me poll
        }
      } catch { /* silent */ }
    } catch (err: unknown) { toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save staff access'); }
    finally { setStaffPermsSaving(false); }
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'appearance', label: 'Appearance', icon: <Palette className="w-4 h-4" /> },
    ...(isAdmin ? [{ key: 'barcode' as Tab, label: 'Barcode', icon: <Barcode className="w-4 h-4" /> }] : []),
    ...(isAdmin ? [{ key: 'users' as Tab, label: 'Users', icon: <Users className="w-4 h-4" /> }] : []),
    ...(isAdmin ? [{ key: 'staffAccess' as Tab, label: 'Staff Access', icon: <UserCog className="w-4 h-4" /> }] : []),
    { key: 'about', label: 'About', icon: <Info className="w-4 h-4" /> },
  ];

  const inputClass = `w-full px-4 py-2.5 rounded-xl border transition-all outline-none ${
    theme === 'dark' ? 'bg-slate-800/50 border-slate-700/50 text-white placeholder-slate-500 focus:border-emerald-500/50' : 'bg-white border-slate-200 text-slate-900 focus:border-emerald-500'
  }`;

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className={`text-2xl lg:text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
          <SettingsIcon className="w-7 h-7 inline-block mr-2 -mt-1" />Settings
        </h1>
        <p className={`mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Customize your experience</p>
      </div>

      {/* Top Tabs */}
      <div className={`flex gap-1 p-1 rounded-2xl ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-100'}`}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex-1 sm:flex-none justify-center sm:justify-start ${
              activeTab === t.key
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg'
                : theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-slate-700/50' : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}>
            {t.icon} <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* APPEARANCE */}
      {activeTab === 'appearance' && (
        <div className={`rounded-2xl border p-6 ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'}`}>
          <h2 className={`text-lg font-semibold mb-6 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            <Palette className="w-5 h-5" /> Appearance
          </h2>
          <div className="mb-6">
            <h3 className={`text-sm font-medium mb-3 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Theme</h3>
            <div className="flex gap-3">
              <button onClick={() => { if (theme !== 'dark') toggleTheme(); }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${
                  theme === 'dark' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-100 border-slate-200 text-slate-600 hover:border-slate-300'
                }`}><Moon className="w-4 h-4" /> Dark</button>
              <button onClick={() => { if (theme !== 'light') toggleTheme(); }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${
                  theme === 'light' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
                    : theme === 'dark' ? 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:border-slate-600' : 'bg-white border-slate-200 text-slate-600'
                }`}><Sun className="w-4 h-4" /> Light</button>
            </div>
          </div>
          <div>
            <h3 className={`text-sm font-medium mb-3 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Accent Color</h3>
            <div className="flex flex-wrap gap-3">
              {accents.map(a => (
                <button key={a.key} onClick={() => setAccentColor(a.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${
                    accentColor === a.key ? 'border-2 shadow-lg'
                      : theme === 'dark' ? 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600' : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                  style={accentColor === a.key ? { borderColor: a.hex, boxShadow: `0 4px 12px ${a.hex}40` } : {}}>
                  <div className="w-5 h-5 rounded-full" style={{ background: a.hex }} />
                  <span className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* BARCODE */}
      {activeTab === 'barcode' && (
        <div className={`rounded-2xl border p-6 ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'}`}>
          <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            <Barcode className="w-5 h-5" /> Barcode Settings
          </h2>
          <div className="space-y-5">
            <div className={`px-4 py-3 rounded-xl border text-center ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50 border-slate-200'}`}>
              <p className={`text-xs mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Preview (Next Generated) — EAN-13</p>
              <p className={`text-2xl font-mono font-bold tracking-widest ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>{barcodePreview}</p>
              {lastBarcode && (
                <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                  Last generated: <span className={`font-mono font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{lastBarcode}</span>
                </p>
              )}
              <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`}>13 digits · auto-incremented · valid EAN-13 check digit</p>
            </div>
            <div>
              <h3 className={`text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Prefix <span className={`font-normal ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>(optional — digits the barcode must begin with)</span></h3>
              <input type="text" value={barcodePrefix} onChange={e => setBarcodePrefix(e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="e.g. 899"
                className={`max-w-xs font-mono ${inputClass}`} />
              <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                {barcodePrefix ? `Prefix "${barcodePrefix}" + ${Math.max(1, 12 - barcodePrefix.replace(/\D/g, '').length)} auto-incremented digits + 1 check digit = 13` : 'All 12 data digits will be auto-incremented + 1 check digit = 13'}
              </p>
            </div>
            <button onClick={saveBarcodeSettings} disabled={barcodeSaving}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium shadow-lg disabled:opacity-50">
              <Save className="w-4 h-4" /> {barcodeSaving ? 'Saving...' : 'Save Barcode Settings'}
            </button>
          </div>
        </div>
      )}

      {/* USERS */}
      {activeTab === 'users' && isAdmin && (
        <div className="space-y-4">
          <div className={`rounded-2xl border p-6 ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-lg font-semibold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                <Users className="w-5 h-5" /> User Management
              </h2>
              <button onClick={() => { setShowUserForm(true); setEditUserItem(null); setUserForm({ name: '', email: '', password: '', role: 'CASHIER' }); }}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm font-medium shadow-lg">
                <Plus className="w-4 h-4" /> Add User
              </button>
            </div>

            {usersLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-emerald-500" /></div>
            ) : (
              <div className="space-y-3">
                {users.map(u => {
                  const isSA = u.role === 'SUPER_ADMIN';
                  const canModify = !isSA || u.id === user?.id;
                  return (
                  <div key={u.id} className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 rounded-xl border transition-all ${
                    !u.isActive ? 'opacity-50' : ''
                  } ${theme === 'dark' ? 'bg-slate-900/50 border-slate-700/50' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
                        isSA ? 'bg-gradient-to-br from-red-500 to-rose-600 ring-2 ring-red-500/30' : u.role === 'ADMIN' ? 'bg-gradient-to-br from-amber-500 to-orange-500' : 'bg-gradient-to-br from-blue-500 to-cyan-500'
                      }`}>{u.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{u.name}</p>
                          {u.id === user?.id && <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>You</span>}
                        </div>
                        <p className={`text-sm truncate ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 ml-13 sm:ml-0">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                        isSA ? 'bg-red-500/10 text-red-400 border border-red-500/20' : u.role === 'ADMIN' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}>{isSA ? <ShieldCheck className="w-3 h-3" /> : u.role === 'ADMIN' ? <ShieldCheck className="w-3 h-3" /> : <Shield className="w-3 h-3" />} {isSA ? 'DEVELOPER' : u.role}</span>
                      {canModify && (
                        <button onClick={() => handleToggleActive(u)} disabled={u.id === user?.id || isSA}
                          className={`p-1 rounded-lg transition-colors ${u.id === user?.id || isSA ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-700/30'}`}>
                          {u.isActive ? <ToggleRight className="w-6 h-6 text-emerald-500" /> : <ToggleLeft className={`w-6 h-6 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`} />}
                        </button>
                      )}
                      <div className="flex items-center gap-1">
                        {canModify && (
                          <button onClick={() => { setPasswordUserId(u.id); setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); }}
                            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-200 text-slate-500'}`} title="Change Password">
                            <KeyRound className="w-4 h-4" />
                          </button>
                        )}
                        {canModify && !isSA && (
                          <button onClick={() => { setEditUserItem(u); setUserForm({ name: u.name, email: u.email, password: '', role: u.role }); setShowUserForm(true); }}
                            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-200 text-slate-500'}`}>
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {u.id !== user?.id && !isSA && (
                          <button onClick={() => setDeleteUserTarget(u)} className="p-2 rounded-lg hover:bg-red-500/10 text-red-400">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add/Edit User Modal */}
          {showUserForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
              <div className={`relative w-full max-w-md rounded-2xl border p-6 ${theme === 'dark' ? 'bg-slate-900 border-slate-700/50' : 'bg-white border-slate-200'}`}>
                <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  {editUserItem ? 'Edit User' : 'Add New User'}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Full Name *</label>
                    <input value={userForm.name} onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Kasun Perera" className={inputClass} autoFocus />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Email *</label>
                    <input type="email" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} placeholder="kasun@shop.lk" className={inputClass} />
                  </div>
                  {!editUserItem && (
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Password *</label>
                      <input type="password" value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 8 characters" className={inputClass} />
                    </div>
                  )}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Role</label>
                    <div className="flex gap-3">
                      {['ADMIN', 'CASHIER'].map(role => (
                        <button key={role} onClick={() => setUserForm(f => ({ ...f, role }))}
                          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                            userForm.role === role
                              ? role === 'ADMIN' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                              : theme === 'dark' ? 'border-slate-700/50 text-slate-400' : 'border-slate-200 text-slate-600'
                          }`}>
                          {role === 'ADMIN' ? <ShieldCheck className="w-4 h-4" /> : <Shield className="w-4 h-4" />} {role}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={() => setShowUserForm(false)} className={`px-4 py-2 rounded-xl text-sm ${theme === 'dark' ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'}`}>Cancel</button>
                  <button onClick={handleSaveUser} disabled={savingUser}
                    className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                    {savingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {editUserItem ? 'Update' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Password Modal */}
          {passwordUserId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
              <div className={`relative w-full max-w-md rounded-2xl border p-6 ${theme === 'dark' ? 'bg-slate-900 border-slate-700/50' : 'bg-white border-slate-200'}`}>
                <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  <KeyRound className="w-5 h-5" /> Change Password
                </h3>
                <div className="space-y-4">
                  {passwordUserId === user?.id && (
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Current Password</label>
                      <div className="relative">
                        <input type={showPasswords ? 'text' : 'password'} value={passwordForm.currentPassword}
                          onChange={e => setPasswordForm(f => ({ ...f, currentPassword: e.target.value }))} className={inputClass} />
                        <button onClick={() => setShowPasswords(!showPasswords)} className={`absolute right-3 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                          {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>New Password</label>
                    <input type={showPasswords ? 'text' : 'password'} value={passwordForm.newPassword}
                      onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))} placeholder="Min 8 characters" className={inputClass} />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Confirm Password</label>
                    <input type={showPasswords ? 'text' : 'password'} value={passwordForm.confirmPassword}
                      onChange={e => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))} className={inputClass} />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={() => setPasswordUserId(null)} className={`px-4 py-2 rounded-xl text-sm ${theme === 'dark' ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'}`}>Cancel</button>
                  <button onClick={handleChangePassword} disabled={changingPassword}
                    className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                    {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Change Password
                  </button>
                </div>
              </div>
            </div>
          )}

          <DeleteConfirmationModal isOpen={!!deleteUserTarget} title="Deactivate User"
            message="This user will be deactivated and cannot log in."
            itemName={deleteUserTarget?.name} onConfirm={handleDeleteUser} onCancel={() => setDeleteUserTarget(null)} isLoading={deletingUser} />
        </div>
      )}

      {/* STAFF ACCESS */}
      {activeTab === 'staffAccess' && isAdmin && (
        <div className={`rounded-2xl border p-6 ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className={`text-lg font-semibold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                <UserCog className="w-5 h-5" /> Staff Access Permissions
              </h2>
              <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                Configure what cashiers can do. Admins always have full access.
              </p>
            </div>
          </div>

          {/* Info banner */}
          <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border mb-6 ${
            theme === 'dark' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200'
          }`}>
            <Shield className={`w-5 h-5 flex-shrink-0 mt-0.5 ${theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}`} />
            <div className={`text-sm ${theme === 'dark' ? 'text-amber-300/80' : 'text-amber-700'}`}>
              <p className="font-medium">Cashiers can never:</p>
              <p className="mt-0.5">Delete products, categories, brands, customers, suppliers • Void invoices • Manage users or shop settings</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Products */}
            <PermissionGroup theme={theme} icon={<Package className="w-4 h-4" />} title="Products & Inventory" description="Product, category, and brand management">
              <PermToggle theme={theme} label="Create products" checked={staffPerms.cashierCanCreateProducts}
                onChange={v => setStaffPerms(p => ({ ...p, cashierCanCreateProducts: v }))} />
              <PermToggle theme={theme} label="Edit products, categories & brands" checked={staffPerms.cashierCanEditProducts}
                onChange={v => setStaffPerms(p => ({ ...p, cashierCanEditProducts: v }))} />
            </PermissionGroup>

            {/* Customers */}
            <PermissionGroup theme={theme} icon={<UserCheck className="w-4 h-4" />} title="Customers" description="Customer record management">
              <PermToggle theme={theme} label="Create customers" checked={staffPerms.cashierCanCreateCustomers}
                onChange={v => setStaffPerms(p => ({ ...p, cashierCanCreateCustomers: v }))} />
              <PermToggle theme={theme} label="Edit customers" checked={staffPerms.cashierCanEditCustomers}
                onChange={v => setStaffPerms(p => ({ ...p, cashierCanEditCustomers: v }))} />
            </PermissionGroup>

            {/* Suppliers */}
            <PermissionGroup theme={theme} icon={<Truck className="w-4 h-4" />} title="Suppliers" description="Supplier record management">
              <PermToggle theme={theme} label="Create suppliers" checked={staffPerms.cashierCanCreateSuppliers}
                onChange={v => setStaffPerms(p => ({ ...p, cashierCanCreateSuppliers: v }))} />
              <PermToggle theme={theme} label="Edit suppliers" checked={staffPerms.cashierCanEditSuppliers}
                onChange={v => setStaffPerms(p => ({ ...p, cashierCanEditSuppliers: v }))} />
            </PermissionGroup>

            {/* Reports */}
            <PermissionGroup theme={theme} icon={<BarChart3 className="w-4 h-4" />} title="Reports" description="Access to analytics and reports">
              <PermToggle theme={theme} label="View reports & dashboard analytics" checked={staffPerms.cashierCanViewReports}
                onChange={v => setStaffPerms(p => ({ ...p, cashierCanViewReports: v }))} />
            </PermissionGroup>

            {/* Stock */}
            <PermissionGroup theme={theme} icon={<Warehouse className="w-4 h-4" />} title="Stock Management" description="Manual stock adjustments">
              <PermToggle theme={theme} label="Make stock adjustments (IN / OUT / Adjust)" checked={staffPerms.cashierCanAdjustStock}
                onChange={v => setStaffPerms(p => ({ ...p, cashierCanAdjustStock: v }))} />
            </PermissionGroup>

            {/* Wholesale */}
            <PermissionGroup theme={theme} icon={<Receipt className="w-4 h-4" />} title="Wholesale Invoice" description="Wholesale billing access">
              <PermToggle theme={theme} label="Create wholesale invoices" checked={staffPerms.cashierCanCreateWholesale}
                onChange={v => setStaffPerms(p => ({ ...p, cashierCanCreateWholesale: v }))} />
            </PermissionGroup>
          </div>

          <div className={`flex justify-end mt-8 pt-4 border-t ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
            <button onClick={saveStaffAccess} disabled={staffPermsSaving}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium shadow-lg disabled:opacity-50 transition-all">
              <Save className="w-4 h-4" /> {staffPermsSaving ? 'Saving...' : 'Save Permissions'}
            </button>
          </div>
        </div>
      )}

      {/* ABOUT */}
      {activeTab === 'about' && (
        <div className={`rounded-2xl border p-6 ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'}`}>
          <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            <Info className="w-5 h-5" /> About
          </h2>
          <div className={`space-y-2 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
            <p><span className="font-medium">Application:</span> Ultra Smart - Shop Management System</p>
            <p><span className="font-medium">Version:</span> 1.0.0</p>
            <p><span className="font-medium">Stack:</span> React + Express + Prisma + MySQL</p>
          </div>
        </div>
      )}
    </div>
  );
};
export default Settings;

/* ─── Helper sub-components for Staff Access tab ─── */

const PermissionGroup: React.FC<{
  theme: string; icon: React.ReactNode; title: string; description: string; children: React.ReactNode;
}> = ({ theme, icon, title, description, children }) => (
  <div className={`rounded-xl border p-4 ${theme === 'dark' ? 'bg-slate-900/40 border-slate-700/40' : 'bg-slate-50 border-slate-200'}`}>
    <div className="flex items-center gap-2 mb-1">
      <span className={theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}>{icon}</span>
      <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
    </div>
    <p className={`text-xs mb-3 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{description}</p>
    <div className="space-y-2">{children}</div>
  </div>
);

const PermToggle: React.FC<{
  theme: string; label: string; checked: boolean; onChange: (v: boolean) => void;
}> = ({ theme, label, checked, onChange }) => (
  <button onClick={() => onChange(!checked)}
    className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg transition-all ${
      theme === 'dark' ? 'hover:bg-slate-800/60' : 'hover:bg-white'
    }`}>
    <span className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{label}</span>
    {checked
      ? <ToggleRight className="w-7 h-7 text-emerald-500 flex-shrink-0" />
      : <ToggleLeft className={`w-7 h-7 flex-shrink-0 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`} />
    }
  </button>
);
