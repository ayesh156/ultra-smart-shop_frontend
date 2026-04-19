import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useDropdownPosition } from '../../hooks/useDropdownPosition';

interface MonthPickerProps {
  value: string; // "YYYY-MM" format
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const MonthPicker: React.FC<MonthPickerProps> = ({
  value, onChange, placeholder = 'Select month', className = '',
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { openUp, alignRight } = useDropdownPosition(containerRef, open, 280, 260);

  const [viewYear, setViewYear] = useState(() => {
    if (value) return Number(value.split('-')[0]);
    return new Date().getFullYear();
  });

  const selectedYear = value ? Number(value.split('-')[0]) : null;
  const selectedMonth = value ? Number(value.split('-')[1]) : null;

  useEffect(() => {
    if (value) setViewYear(Number(value.split('-')[0]));
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectMonth = (monthIdx: number) => {
    const m = String(monthIdx + 1).padStart(2, '0');
    onChange(`${viewYear}-${m}`);
    setOpen(false);
  };

  const displayLabel = value
    ? `${MONTHS[(selectedMonth || 1) - 1]} ${selectedYear}`
    : placeholder;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button type="button" onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all outline-none ${
          open
            ? isDark ? 'border-emerald-500/50 ring-2 ring-emerald-500/20 bg-slate-800/80' : 'border-emerald-500 ring-2 ring-emerald-500/20 bg-white'
            : isDark ? 'border-slate-700/50 bg-slate-800/50 hover:border-slate-600' : 'border-slate-200 bg-white hover:border-slate-300'
        } cursor-pointer`}>
        <Calendar className={`w-4 h-4 shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
        <span className={`flex-1 text-left truncate ${
          value ? (isDark ? 'text-white' : 'text-slate-900') : (isDark ? 'text-slate-500' : 'text-slate-400')
        }`}>{displayLabel}</span>
        {value && (
          <span onClick={e => { e.stopPropagation(); onChange(''); }} className="shrink-0 p-0.5 rounded-md hover:bg-slate-700/50">
            <X className={`w-3.5 h-3.5 ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`} />
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute z-50 w-[260px] rounded-xl border shadow-xl overflow-hidden ${
          openUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
        } ${
          alignRight ? 'right-0' : 'left-0'
        } ${
          isDark ? 'bg-slate-800 border-slate-700/50 shadow-black/40' : 'bg-white border-slate-200 shadow-slate-200/60'
        }`}>
          {/* Year nav */}
          <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-slate-700/50' : 'border-slate-100'}`}>
            <button onClick={() => setViewYear(y => y - 1)} className={`p-1 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}>
              <ChevronLeft className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
            </button>
            <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{viewYear}</span>
            <button onClick={() => setViewYear(y => y + 1)} className={`p-1 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}>
              <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
            </button>
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-4 gap-1.5 p-3">
            {MONTHS.map((m, i) => {
              const isSelected = selectedYear === viewYear && selectedMonth === i + 1;
              const isCurrent = new Date().getFullYear() === viewYear && new Date().getMonth() === i;
              return (
                <button key={m} onClick={() => selectMonth(i)}
                  className={`py-2 rounded-lg text-sm font-medium transition-all ${
                    isSelected
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md'
                      : isCurrent
                        ? isDark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                        : isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-100'
                  }`}>
                  {m}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className={`flex items-center justify-between px-4 py-2 border-t ${isDark ? 'border-slate-700/50' : 'border-slate-100'}`}>
            <button onClick={() => { onChange(''); setOpen(false); }}
              className={`text-xs font-medium ${isDark ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'}`}>
              Clear
            </button>
            <button onClick={() => {
              const now = new Date();
              onChange(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
              setOpen(false);
            }} className="text-xs font-medium text-emerald-500 hover:text-emerald-400">
              This month
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
