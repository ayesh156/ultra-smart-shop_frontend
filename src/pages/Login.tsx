import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Lock, Eye, EyeOff, Shield, Zap, BarChart3, Package } from 'lucide-react';
import toast from 'react-hot-toast';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Login failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Left Panel — Decorative */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950">
        {/* Animated gradient orbs */}
        <div className="absolute top-20 left-20 w-72 h-72 bg-emerald-500/20 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-20 right-16 w-96 h-96 bg-teal-500/15 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-emerald-400/10 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '2s' }} />

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          <div className="mb-8">
            <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-2xl shadow-emerald-500/30 mb-6 ring-2 ring-emerald-500/20">
              <img src="/images/logo.png" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <h2 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight">
              Ultra Smart<br />
              <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">Shop Manager</span>
            </h2>
            <p className="text-slate-400 mt-4 text-lg max-w-md leading-relaxed">
              All-in-one computer & mobile shop management — inventory, invoicing, and reports in one place.
            </p>
          </div>

          {/* Feature pills */}
          <div className="space-y-3 mt-4">
            {[
              { icon: Zap, text: 'Lightning fast invoicing', color: 'from-emerald-500/20 to-teal-500/10 text-emerald-400 border-emerald-500/20' },
              { icon: Package, text: 'Real-time inventory tracking', color: 'from-blue-500/20 to-cyan-500/10 text-blue-400 border-blue-500/20' },
              { icon: BarChart3, text: 'Comprehensive reports', color: 'from-purple-500/20 to-pink-500/10 text-purple-400 border-purple-500/20' },
              { icon: Shield, text: 'Secure & reliable', color: 'from-amber-500/20 to-orange-500/10 text-amber-400 border-amber-500/20' },
            ].map((f, i) => (
              <div key={i} className={`inline-flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gradient-to-r ${f.color} border backdrop-blur-sm`}>
                <f.icon className="w-4 h-4" />
                <span className="text-sm font-medium">{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 relative">
        {/* Mobile background decorations */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/10 rounded-full blur-[100px] lg:hidden" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-teal-500/5 rounded-full blur-[100px] lg:hidden" />

        <div className="relative w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex flex-col items-center mb-10 lg:hidden">
            <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-2xl shadow-emerald-500/30 mb-4 ring-2 ring-emerald-500/20">
              <img src="/images/logo.png" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-2xl font-bold text-white">Ultra Smart</h1>
            <p className="text-slate-400 mt-1 text-sm">Shop Management System</p>
          </div>

          {/* Desktop heading */}
          <div className="hidden lg:block mb-8">
            <h1 className="text-3xl font-bold text-white">Welcome back</h1>
            <p className="text-slate-400 mt-2">Sign in to your account to continue</p>
          </div>

          {/* Form card */}
          <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                    placeholder="Enter your email" autoComplete="email"
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-900/50 border border-slate-700/50 text-white placeholder-slate-500 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required
                    placeholder="Enter your password" autoComplete="current-password"
                    className="w-full pl-11 pr-12 py-3 rounded-xl bg-slate-900/50 border border-slate-700/50 text-white placeholder-slate-500 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:hover:scale-100">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </span>
                ) : 'Sign In'}
              </button>
            </form>
          </div>

          {/* Footer */}
          <p className="text-center text-slate-500 text-xs mt-8">
            Contact your administrator if you need access
          </p>
        </div>
      </div>
    </div>
  );
};
