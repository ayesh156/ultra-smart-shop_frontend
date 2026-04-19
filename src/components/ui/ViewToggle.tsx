import React from 'react';
import { LayoutGrid, List } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

export type ViewMode = 'grid' | 'table';

interface ViewToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export const ViewToggle: React.FC<ViewToggleProps> = ({ mode, onChange }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className={`flex items-center rounded-xl border p-1 ${
      isDark ? 'border-slate-700/50 bg-slate-900/50' : 'border-slate-200 bg-slate-50'
    }`}>
      <button
        onClick={() => onChange('grid')}
        className={`p-2 rounded-lg transition-all duration-200 ${
          mode === 'grid'
            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
            : isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-white'
        }`}
        title="Card View"
      >
        <LayoutGrid className="w-4 h-4" />
      </button>
      <button
        onClick={() => onChange('table')}
        className={`p-2 rounded-lg transition-all duration-200 ${
          mode === 'table'
            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
            : isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-white'
        }`}
        title="Table View"
      >
        <List className="w-4 h-4" />
      </button>
    </div>
  );
};
