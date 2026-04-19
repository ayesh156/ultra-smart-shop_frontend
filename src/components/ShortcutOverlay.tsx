import React, { useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Keyboard, X, ShoppingCart, CreditCard, Zap } from 'lucide-react';

interface ShortcutGroup {
  title: string;
  icon: React.ReactNode;
  color: string;
  shortcuts: { key: string; label: string }[];
}

interface ShortcutOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: 'Navigation',
    icon: <Zap className="w-4 h-4" />,
    color: 'emerald',
    shortcuts: [
      { key: 'F2', label: 'Focus Barcode Scanner' },
      { key: 'F3', label: 'Focus Product Search' },
      { key: 'F4', label: 'Focus Customer Search' },
      { key: 'F5', label: 'Focus Payment Amount' },
      { key: 'F6', label: 'Focus Discount Input' },
      { key: 'F7', label: 'Toggle Discount Rs./% ' },
    ],
  },
  {
    title: 'Cart Actions',
    icon: <ShoppingCart className="w-4 h-4" />,
    color: 'blue',
    shortcuts: [
      { key: 'Enter', label: 'Add Selected Product' },
      { key: 'Delete', label: 'Remove Last Cart Item' },
      { key: '↑ / ↓', label: 'Navigate Product List' },
      { key: 'Esc', label: 'Clear Search / Close' },
    ],
  },
  {
    title: 'Checkout',
    icon: <CreditCard className="w-4 h-4" />,
    color: 'purple',
    shortcuts: [
      { key: 'F12', label: 'Complete Sale & Print' },
      { key: 'F9', label: 'Save Without Print' },
      { key: 'Ctrl+P', label: 'Print Last Receipt' },
    ],
  },
  {
    title: 'General',
    icon: <Keyboard className="w-4 h-4" />,
    color: 'amber',
    shortcuts: [
      { key: '?', label: 'Toggle Shortcut Map' },
      { key: 'Ctrl+Backspace', label: 'Clear Entire Cart' },
    ],
  },
];

const colorMap: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
  emerald: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', text: 'text-emerald-400', iconBg: 'bg-emerald-500/10' },
  blue: { bg: 'bg-blue-500/5', border: 'border-blue-500/20', text: 'text-blue-400', iconBg: 'bg-blue-500/10' },
  purple: { bg: 'bg-purple-500/5', border: 'border-purple-500/20', text: 'text-purple-400', iconBg: 'bg-purple-500/10' },
  amber: { bg: 'bg-amber-500/5', border: 'border-amber-500/20', text: 'text-amber-400', iconBg: 'bg-amber-500/10' },
};

export const ShortcutOverlay: React.FC<ShortcutOverlayProps> = ({ isOpen, onClose }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      {/* Content */}
      <div
        className={`relative w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden ${
          isDark ? 'bg-slate-900/95 border-slate-700/50' : 'bg-white/95 border-slate-200'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          isDark ? 'border-slate-700/50 bg-slate-800/50' : 'border-slate-200 bg-slate-50'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg">
              <Keyboard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Keyboard Shortcuts
              </h2>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Press <kbd className={`px-1.5 py-0.5 rounded text-xs font-mono ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>?</kbd> anytime to toggle
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shortcuts Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6">
          {shortcutGroups.map((group) => {
            const colors = colorMap[group.color];
            return (
              <div
                key={group.title}
                className={`rounded-xl border p-4 ${colors.bg} ${colors.border}`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-7 h-7 rounded-lg ${colors.iconBg} flex items-center justify-center ${colors.text}`}>
                    {group.icon}
                  </div>
                  <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {group.title}
                  </h3>
                </div>
                <div className="space-y-2">
                  {group.shortcuts.map((s) => (
                    <div key={s.key} className="flex items-center justify-between gap-2">
                      <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        {s.label}
                      </span>
                      <kbd
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-semibold min-w-[2rem] justify-center ${
                          isDark
                            ? 'bg-slate-800 text-slate-200 border border-slate-600 shadow-sm'
                            : 'bg-white text-slate-700 border border-slate-300 shadow-sm'
                        }`}
                      >
                        {s.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer hint bar */}
        <div className={`px-6 py-3 border-t text-center ${
          isDark ? 'border-slate-700/50 bg-slate-800/30' : 'border-slate-200 bg-slate-50'
        }`}>
          <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            🎹 Keyboard shortcuts work when no input field is focused · Press <kbd className="font-mono">Esc</kbd> to close
          </p>
        </div>
      </div>
    </div>
  );
};

// Compact shortcut hints bar for the bottom of QuickInvoice
export const ShortcutHintsBar: React.FC<{ onShowMap: () => void }> = ({ onShowMap }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const hints = [
    { key: 'F2', label: 'Search' },
    { key: 'F5', label: 'Payment' },
    { key: 'F12', label: 'Complete' },
    { key: 'F9', label: 'Save' },
    { key: '?', label: 'All Shortcuts' },
  ];

  return (
    <div className={`flex items-center justify-center gap-3 flex-wrap py-2 px-4 rounded-xl border ${
      isDark ? 'bg-slate-800/30 border-slate-700/30' : 'bg-slate-50 border-slate-200'
    }`}>
      {hints.map((h) => (
        <button
          key={h.key}
          onClick={h.key === '?' ? onShowMap : undefined}
          className={`inline-flex items-center gap-1.5 text-xs ${
            isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'
          } transition-colors`}
        >
          <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
            isDark ? 'bg-slate-700 text-emerald-400 border border-slate-600' : 'bg-white text-emerald-600 border border-slate-300'
          }`}>
            {h.key}
          </kbd>
          <span>{h.label}</span>
        </button>
      ))}
    </div>
  );
};
