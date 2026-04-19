import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useDropdownPosition } from '../../hooks/useDropdownPosition';

interface YearPickerProps {
  value: string; // "YYYY"
  onChange: (value: string) => void;
  startYear?: number;
  endYear?: number;
  className?: string;
}

export const YearPicker: React.FC<YearPickerProps> = ({
  value, onChange, startYear, endYear, className = '',
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { openUp, alignRight } = useDropdownPosition(containerRef, open, 230, 140);

  const currentYear = new Date().getFullYear();
  const from = startYear ?? currentYear - 9;
  const to = endYear ?? currentYear;
  const years = Array.from({ length: to - from + 1 }, (_, i) => to - i);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Scroll selected into view on open
  useEffect(() => {
    if (open && listRef.current) {
      const active = listRef.current.querySelector('[data-active="true"]');
      active?.scrollIntoView({ block: 'center' });
    }
  }, [open]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button type="button" onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all outline-none ${
          open
            ? isDark ? 'border-emerald-500/50 ring-2 ring-emerald-500/20 bg-slate-800/80' : 'border-emerald-500 ring-2 ring-emerald-500/20 bg-white'
            : isDark ? 'border-slate-700/50 bg-slate-800/50 hover:border-slate-600' : 'border-slate-200 bg-white hover:border-slate-300'
        } cursor-pointer`}>
        <Calendar className={`w-4 h-4 shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
        <span className={`flex-1 text-left ${isDark ? 'text-white' : 'text-slate-900'}`}>{value}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''} ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
      </button>

      {open && (
        <div className={`absolute z-50 w-full min-w-[140px] rounded-xl border shadow-xl overflow-hidden ${
          openUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
        } ${
          alignRight ? 'right-0' : 'left-0'
        } ${
          isDark ? 'bg-slate-800 border-slate-700/50 shadow-black/40' : 'bg-white border-slate-200 shadow-slate-200/60'
        }`}>
          <div ref={listRef} className="max-h-[220px] overflow-y-auto py-1">
            {years.map(y => {
              const isSelected = String(y) === value;
              const isCurrent = y === currentYear;
              return (
                <button key={y} data-active={isSelected} onClick={() => { onChange(String(y)); setOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                    isSelected
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold'
                      : isCurrent
                        ? isDark ? 'text-emerald-400 bg-emerald-500/10 font-medium' : 'text-emerald-600 bg-emerald-50 font-medium'
                        : isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-100'
                  }`}>
                  {y}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
