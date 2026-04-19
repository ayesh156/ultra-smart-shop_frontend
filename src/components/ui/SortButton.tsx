import React, { useState, useRef, useEffect } from 'react';
import { ArrowUpDown, Check, ChevronDown } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useDropdownPosition } from '../../hooks/useDropdownPosition';

export interface SortOption {
  value: string;
  label: string;
}

interface SortButtonProps {
  options: SortOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const SortButton: React.FC<SortButtonProps> = ({ options, value, onChange, className = '' }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { openUp } = useDropdownPosition(ref, open, 250, 200);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
          isDark
            ? 'bg-slate-800/50 border-slate-700/50 text-slate-300 hover:bg-slate-700/50 hover:border-slate-600'
            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 shadow-sm'
        }`}
        title={`Sort: ${selected?.label || 'Default'}`}
      >
        <ArrowUpDown className="w-4 h-4" />
        <span className="hidden sm:inline">{selected?.label || 'Sort'}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className={`absolute right-0 z-50 min-w-[200px] rounded-xl border shadow-xl overflow-hidden ${
          openUp ? 'bottom-full mb-1' : 'top-full mt-1'
        } ${
          isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
        }`}>
          <div className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider ${
            isDark ? 'text-slate-500 border-b border-slate-700/50' : 'text-slate-400 border-b border-slate-100'
          }`}>
            Sort by
          </div>
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => { onChange(option.value); setOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors ${
                option.value === value
                  ? isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-700'
                  : isDark ? 'text-slate-300 hover:bg-slate-700/80' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {option.label}
              {option.value === value && <Check className="w-4 h-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
