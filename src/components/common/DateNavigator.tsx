import React from 'react';
import { addDays, addWeeks, addMonths, addYears, parseISO, format, startOfWeek } from 'date-fns';
import { useSettingsStore } from '../../store/settingsStore';

function ChevronLeft() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

export const DateNavigator: React.FC = () => {
  const { viewMode, currentDate, setCurrentDate, goToToday } = useSettingsStore();
  const date = parseISO(currentDate);

  const navigate = (dir: 1 | -1) => {
    let next: Date;
    if (viewMode === 'hour') next = addDays(date, dir);
    else if (viewMode === 'day') next = addMonths(date, dir);
    else if (viewMode === 'week') next = addMonths(date, dir * 3);
    else next = addYears(date, dir);
    setCurrentDate(format(next, 'yyyy-MM-dd'));
  };

  const displayLabel = () => {
    if (viewMode === 'hour') return format(date, 'EEEE, MMMM d, yyyy');
    if (viewMode === 'day') return format(date, 'MMMM yyyy');
    if (viewMode === 'week') {
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      return `W${format(weekStart, 'w')} · ${format(date, 'yyyy')}`;
    }
    return format(date, 'yyyy');
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => navigate(-1)}
        className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
      >
        <ChevronLeft />
      </button>

      <span className="text-sm font-medium text-slate-700 dark:text-slate-200 min-w-[180px] text-center">
        {displayLabel()}
      </span>

      <button
        onClick={() => navigate(1)}
        className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
      >
        <ChevronRight />
      </button>

      <button
        onClick={goToToday}
        className="ml-1 px-3 py-1 text-xs font-medium rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 transition-colors"
      >
        Today
      </button>
    </div>
  );
};
