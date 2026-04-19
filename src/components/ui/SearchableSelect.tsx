import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useDropdownPosition } from '../../hooks/useDropdownPosition';

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
  disabled?: boolean;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onValueChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No results found.',
  className = '',
  disabled = false,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const { openUp, alignRight } = useDropdownPosition(containerRef, open, 300, 200);

  const selected = options.find(o => o.value === value);

  const filtered = useMemo(() => {
    if (!query) return options;
    return options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()));
  }, [options, query]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setHighlightIdx(0);
    }
  }, [open]);

  // Scroll highlighted into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-option]');
    items[highlightIdx]?.scrollIntoView({ block: 'nearest' });
  }, [highlightIdx, open]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIdx(i => Math.min(i + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIdx(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[highlightIdx]) {
          onValueChange(filtered[highlightIdx].value);
          setOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
    }
  };

  const select = (val: string) => {
    onValueChange(val);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`} onKeyDown={handleKey}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all outline-none ${
          open
            ? isDark
              ? 'border-emerald-500/50 ring-2 ring-emerald-500/20 bg-slate-800/80'
              : 'border-emerald-500 ring-2 ring-emerald-500/20 bg-white'
            : isDark
              ? 'border-slate-700/50 bg-slate-800/50 hover:border-slate-600'
              : 'border-slate-200 bg-white hover:border-slate-300'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className={`flex items-center gap-2 truncate ${
          selected
            ? isDark ? 'text-white' : 'text-slate-900'
            : isDark ? 'text-slate-500' : 'text-slate-400'
        }`}>
          {selected?.icon}
          {selected ? (
            <span className="flex items-center gap-2">
              {selected.label}
              {selected.count !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'
                }`}>{selected.count}</span>
              )}
            </span>
          ) : placeholder}
        </span>
        <ChevronsUpDown className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${
          isDark ? 'text-slate-500' : 'text-slate-400'
        }`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className={`absolute z-50 w-full min-w-[200px] rounded-xl border shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150 ${
          openUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
        } ${
          alignRight ? 'right-0' : 'left-0'
        } ${
          isDark
            ? 'bg-slate-800 border-slate-700/50 shadow-black/40'
            : 'bg-white border-slate-200 shadow-slate-200/60'
        }`}>
          {/* Search Input */}
          <div className={`flex items-center gap-2 px-3 py-2.5 border-b ${
            isDark ? 'border-slate-700/50' : 'border-slate-100'
          }`}>
            <Search className={`w-4 h-4 shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setHighlightIdx(0); }}
              placeholder={searchPlaceholder}
              className={`w-full bg-transparent text-sm outline-none ${
                isDark ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'
              }`}
            />
            {query && (
              <button onClick={() => setQuery('')} className="shrink-0">
                <X className={`w-3.5 h-3.5 ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`} />
              </button>
            )}
          </div>

          {/* Options List */}
          <div ref={listRef} className="max-h-[240px] overflow-y-auto py-1 scrollbar-thin">
            {filtered.length === 0 ? (
              <div className={`px-3 py-4 text-center text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {emptyMessage}
              </div>
            ) : (
              filtered.map((option, idx) => (
                <button
                  key={option.value}
                  type="button"
                  data-option
                  disabled={option.disabled}
                  onClick={() => select(option.value)}
                  onMouseEnter={() => setHighlightIdx(idx)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
                    option.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                  } ${
                    idx === highlightIdx
                      ? isDark ? 'bg-slate-700/60' : 'bg-slate-50'
                      : ''
                  } ${
                    value === option.value
                      ? isDark ? 'text-emerald-400' : 'text-emerald-600'
                      : isDark ? 'text-slate-200' : 'text-slate-700'
                  }`}
                >
                  <span className={`w-4 h-4 shrink-0 flex items-center justify-center rounded-md transition-all ${
                    value === option.value
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'opacity-0'
                  }`}>
                    <Check className="w-3 h-3" />
                  </span>
                  {option.icon && <span className="shrink-0">{option.icon}</span>}
                  <span className="flex-1 truncate">{option.label}</span>
                  {option.count !== undefined && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                      isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'
                    }`}>{option.count}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
