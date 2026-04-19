import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [showSizeDropdown, setShowSizeDropdown] = useState(false);
  const sizeRef = useRef<HTMLDivElement>(null);

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sizeRef.current && !sizeRef.current.contains(e.target as Node)) setShowSizeDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const getPageNumbers = () => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  if (totalPages <= 1 && !onPageSizeChange) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3">
      {/* Left: Info + page size dropdown */}
      <div className="flex items-center gap-3">
        <span className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
          Showing{' '}
          <span className={`font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{startItem}–{endItem}</span>
          {' '}of{' '}
          <span className={`font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{totalItems}</span>
        </span>

        {onPageSizeChange && (
          <div className="relative" ref={sizeRef}>
            <button
              onClick={() => setShowSizeDropdown(!showSizeDropdown)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                isDark
                  ? 'bg-slate-800/80 border-slate-700/50 text-slate-300 hover:bg-slate-700/80 hover:border-slate-600'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 shadow-sm'
              }`}
            >
              {pageSize} / page
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSizeDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showSizeDropdown && (
              <div className={`absolute bottom-full mb-1 left-0 z-50 min-w-[100px] rounded-xl border shadow-xl overflow-hidden ${
                isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
              }`}>
                {pageSizeOptions.map((size) => (
                  <button
                    key={size}
                    onClick={() => { onPageSizeChange(size); setShowSizeDropdown(false); }}
                    className={`w-full px-4 py-2 text-sm text-left transition-colors ${
                      size === pageSize
                        ? isDark ? 'bg-emerald-500/15 text-emerald-400 font-medium' : 'bg-emerald-50 text-emerald-700 font-medium'
                        : isDark ? 'text-slate-300 hover:bg-slate-700/80' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {size} / page
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: Page navigation */}
      {totalPages > 1 && (
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            className={`p-1.5 rounded-lg transition-all ${
              currentPage === 1
                ? isDark ? 'text-slate-700 cursor-not-allowed' : 'text-slate-300 cursor-not-allowed'
                : isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
            }`}
            title="First"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={`p-1.5 rounded-lg transition-all ${
              currentPage === 1
                ? isDark ? 'text-slate-700 cursor-not-allowed' : 'text-slate-300 cursor-not-allowed'
                : isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
            }`}
            title="Previous"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-0.5 mx-1">
            {getPageNumbers().map((page, idx) =>
              page === '...' ? (
                <span key={`dots-${idx}`} className={`w-8 text-center text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>•••</span>
              ) : (
                <button
                  key={page}
                  onClick={() => onPageChange(page as number)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                    currentPage === page
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                      : isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {page}
                </button>
              )
            )}
          </div>

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={`p-1.5 rounded-lg transition-all ${
              currentPage === totalPages
                ? isDark ? 'text-slate-700 cursor-not-allowed' : 'text-slate-300 cursor-not-allowed'
                : isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
            }`}
            title="Next"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            className={`p-1.5 rounded-lg transition-all ${
              currentPage === totalPages
                ? isDark ? 'text-slate-700 cursor-not-allowed' : 'text-slate-300 cursor-not-allowed'
                : isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
            }`}
            title="Last"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
