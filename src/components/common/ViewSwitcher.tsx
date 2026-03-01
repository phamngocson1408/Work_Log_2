import React from 'react';
import type { ViewMode } from '../../types';
import { useSettingsStore } from '../../store/settingsStore';

const MODES: { value: ViewMode; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

export const ViewSwitcher: React.FC = () => {
  const { viewMode, setViewMode } = useSettingsStore();

  return (
    <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1 gap-1">
      {MODES.map((mode) => (
        <button
          key={mode.value}
          onClick={() => setViewMode(mode.value)}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
            viewMode === mode.value
              ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
};
