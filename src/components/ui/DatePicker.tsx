import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useDropdownPosition } from '../../hooks/useDropdownPosition';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, isToday, isBefore, isAfter } from 'date-fns';

interface DatePickerProps {
  value: string; // ISO date string yyyy-MM-dd or ''
  onChange: (date: string) => void;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
  disabled?: boolean;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  placeholder = 'Select date',
  minDate,
  maxDate,
  className = '',
  disabled = false,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { openUp, alignRight } = useDropdownPosition(containerRef, open, 380, 300);

  const selectedDate = value ? new Date(value + 'T00:00:00') : null;
  const [viewMonth, setViewMonth] = useState(() => selectedDate || new Date());

  useEffect(() => {
    if (selectedDate) setViewMonth(selectedDate);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(monthStart);
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);
    const days: Date[] = [];
    let day = calStart;
    while (day <= calEnd) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [viewMonth]);

  const isDisabled = (day: Date) => {
    if (minDate && isBefore(day, startOfMonth(minDate)) && !isSameDay(day, minDate) && isBefore(day, minDate)) return true;
    if (maxDate && isAfter(day, maxDate)) return true;
    return false;
  };

  const selectDay = (day: Date) => {
    if (isDisabled(day)) return;
    onChange(format(day, 'yyyy-MM-dd'));
    setOpen(false);
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all outline-none ${
          open
            ? isDark
              ? 'border-emerald-500/50 ring-2 ring-emerald-500/20 bg-slate-800/80'
              : 'border-emerald-500 ring-2 ring-emerald-500/20 bg-white'
            : isDark
              ? 'border-slate-700/50 bg-slate-800/50 hover:border-slate-600'
              : 'border-slate-200 bg-white hover:border-slate-300'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <Calendar className={`w-4 h-4 shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
        <span className={`flex-1 text-left truncate ${
          selectedDate
            ? isDark ? 'text-white' : 'text-slate-900'
            : isDark ? 'text-slate-500' : 'text-slate-400'
        }`}>
          {selectedDate ? format(selectedDate, 'MMM dd, yyyy') : placeholder}
        </span>
        {value && !disabled && (
          <span onClick={clear} className="shrink-0 p-0.5 rounded-md hover:bg-slate-700/50">
            <X className={`w-3.5 h-3.5 ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`} />
          </span>
        )}
      </button>

      {/* Calendar Dropdown */}
      {open && (
        <div className={`absolute z-50 w-[300px] rounded-xl border shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150 ${
          openUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
        } ${
          alignRight ? 'right-0' : 'left-0'
        } ${
          isDark
            ? 'bg-slate-800 border-slate-700/50 shadow-black/40'
            : 'bg-white border-slate-200 shadow-slate-200/60'
        }`}>
          {/* Month Navigation */}
          <div className={`flex items-center justify-between px-4 py-3 border-b ${
            isDark ? 'border-slate-700/50' : 'border-slate-100'
          }`}>
            <button
              type="button"
              onClick={() => setViewMonth(m => subMonths(m, 1))}
              className={`p-1.5 rounded-lg transition-colors ${
                isDark ? 'hover:bg-slate-700 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-600'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {format(viewMonth, 'MMMM yyyy')}
            </span>
            <button
              type="button"
              onClick={() => setViewMonth(m => addMonths(m, 1))}
              className={`p-1.5 rounded-lg transition-colors ${
                isDark ? 'hover:bg-slate-700 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-600'
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 px-3 pt-3 pb-1">
            {weekDays.map(d => (
              <div key={d} className={`text-center text-[11px] font-semibold py-1 ${
                isDark ? 'text-slate-500' : 'text-slate-400'
              }`}>{d}</div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 px-3 pb-3">
            {calendarDays.map((day, i) => {
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const isCurrentMonth = isSameMonth(day, viewMonth);
              const isDayToday = isToday(day);
              const dayDisabled = isDisabled(day);

              return (
                <button
                  key={i}
                  type="button"
                  disabled={dayDisabled}
                  onClick={() => selectDay(day)}
                  className={`relative w-full aspect-square flex items-center justify-center text-sm rounded-lg transition-all m-0.5 ${
                    dayDisabled
                      ? 'opacity-30 cursor-not-allowed'
                      : 'cursor-pointer'
                  } ${
                    isSelected
                      ? 'bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-500/30'
                      : isDayToday
                        ? isDark
                          ? 'bg-slate-700/60 text-emerald-400 font-semibold'
                          : 'bg-emerald-50 text-emerald-600 font-semibold'
                        : isCurrentMonth
                          ? isDark
                            ? 'text-slate-200 hover:bg-slate-700/50'
                            : 'text-slate-700 hover:bg-slate-50'
                          : isDark
                            ? 'text-slate-600 hover:bg-slate-700/30'
                            : 'text-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {format(day, 'd')}
                  {isDayToday && !isSelected && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-500" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className={`flex items-center justify-between px-4 py-2.5 border-t ${
            isDark ? 'border-slate-700/50' : 'border-slate-100'
          }`}>
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              className={`text-xs font-medium px-2 py-1 rounded-lg transition-colors ${
                isDark ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => { onChange(format(new Date(), 'yyyy-MM-dd')); setOpen(false); }}
              className={`text-xs font-medium px-2 py-1 rounded-lg transition-colors ${
                isDark ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-emerald-600 hover:bg-emerald-50'
              }`}
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ========== Date Range Picker ========== */

interface DateRangePickerProps {
  fromDate: string;
  toDate: string;
  onFromChange: (date: string) => void;
  onToChange: (date: string) => void;
  className?: string;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  fromDate,
  toDate,
  onFromChange,
  onToChange,
  className = '',
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <DatePicker
        value={fromDate}
        onChange={onFromChange}
        placeholder="From"
        maxDate={toDate ? new Date(toDate + 'T00:00:00') : undefined}
        className="flex-1 min-w-[150px]"
      />
      <span className={`text-xs font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>to</span>
      <DatePicker
        value={toDate}
        onChange={onToChange}
        placeholder="To"
        minDate={fromDate ? new Date(fromDate + 'T00:00:00') : undefined}
        className="flex-1 min-w-[150px]"
      />
    </div>
  );
};
