import React, { useMemo, useState, useEffect } from 'react';
import { format, parseISO, subDays, differenceInMinutes, startOfDay, endOfDay } from 'date-fns';
import { useTimeLogStore } from '../../store/timeLogStore';
import { useTaskStore } from '../../store/taskStore';
import type { Task, TimeLog } from '../../types';

interface WeeklyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  todayISO: string; // 'yyyy-MM-dd'
}

interface TaskReport {
  task: Task;
  currentHours: number;
  prevHours: number;
  currentProgress: number | null;
  prevProgress: number | null;
  currentLogCount: number;
  prevLogCount: number;
}

function filterLogsByRange(logs: TimeLog[], rangeStart: Date, rangeEnd: Date): TimeLog[] {
  return logs.filter((l) => {
    const s = parseISO(l.startTime);
    return s >= rangeStart && s <= rangeEnd;
  });
}

function sumHours(logs: TimeLog[]): number {
  return logs.reduce((acc, l) => {
    const mins = differenceInMinutes(parseISO(l.endTime), parseISO(l.startTime));
    return acc + Math.max(0, mins);
  }, 0) / 60;
}

function latestProgress(logs: TimeLog[]): number | null {
  const withProgress = logs
    .filter((l) => l.progress !== null)
    .sort((a, b) => b.startTime.localeCompare(a.startTime));
  return withProgress[0]?.progress ?? null;
}

function computeReport(
  tasks: Task[],
  logs: TimeLog[],
  currentStart: Date,
  currentEnd: Date,
  prevStart: Date,
  prevEnd: Date,
): TaskReport[] {
  const reports: TaskReport[] = [];

  for (const task of tasks) {
    const taskLogs = logs.filter((l) => l.taskId === task.id);
    const currentLogs = filterLogsByRange(taskLogs, currentStart, currentEnd);
    const prevLogs = filterLogsByRange(taskLogs, prevStart, prevEnd);

    if (currentLogs.length === 0 && prevLogs.length === 0) continue;

    reports.push({
      task,
      currentHours: sumHours(currentLogs),
      prevHours: sumHours(prevLogs),
      currentProgress: latestProgress(currentLogs),
      prevProgress: latestProgress(prevLogs),
      currentLogCount: currentLogs.length,
      prevLogCount: prevLogs.length,
    });
  }

  return reports.sort((a, b) => b.currentHours - a.currentHours || b.prevHours - a.prevHours);
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isNoteEmpty(note: string): boolean {
  return !note || stripHtml(note) === '';
}

function fmtHours(h: number): string {
  if (h === 0) return '—';
  const totalMins = Math.round(h * 60);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

function generateTextReport(
  reports: TaskReport[],
  currentStart: Date,
  currentEnd: Date,
  prevStart: Date,
  prevEnd: Date,
  tasks: Task[],
): string {
  const lines: string[] = [];
  lines.push('# Weekly Report');
  lines.push(`Current week:  ${format(currentStart, 'MMM d')} – ${format(currentEnd, 'MMM d, yyyy')}`);
  lines.push(`Previous week: ${format(prevStart, 'MMM d')} – ${format(prevEnd, 'MMM d, yyyy')}`);
  lines.push('');

  const parentReports = reports.filter((r) => !r.task.parentId);
  const subtaskReports = reports.filter((r) => r.task.parentId);

  for (const pr of parentReports) {
    const progressStr = pr.currentProgress !== null
      ? `${pr.currentProgress}%`
      : pr.prevProgress !== null ? `${pr.prevProgress}% (prev)` : '—';
    const delta = pr.currentProgress !== null && pr.prevProgress !== null
      ? pr.currentProgress - pr.prevProgress
      : null;
    const deltaStr = delta !== null
      ? (delta > 0 ? ` (+${delta}%)` : delta < 0 ? ` (${delta}%)` : ' (no change)')
      : '';

    lines.push(`## ${pr.task.title}`);
    if (!isNoteEmpty(pr.task.note)) {
      lines.push(`  Note:`);
      const noteText = stripHtml(pr.task.note);
      noteText.split('\n').filter(Boolean).forEach((line) => lines.push(`    ${line}`));
    }
    lines.push(`  Hours: ${fmtHours(pr.currentHours)} this week / ${fmtHours(pr.prevHours)} prev week`);
    lines.push(`  Progress: ${progressStr}${deltaStr}`);

    const children = subtaskReports.filter((s) => s.task.parentId === pr.task.id);
    for (const sr of children) {
      const sp = sr.currentProgress !== null
        ? `${sr.currentProgress}%`
        : sr.prevProgress !== null ? `${sr.prevProgress}% (prev)` : '—';
      const sd = sr.currentProgress !== null && sr.prevProgress !== null
        ? sr.currentProgress - sr.prevProgress
        : null;
      const sdStr = sd !== null
        ? (sd > 0 ? ` (+${sd}%)` : sd < 0 ? ` (${sd}%)` : ' (no change)')
        : '';
      lines.push(`  └ ${sr.task.title}`);
      if (!isNoteEmpty(sr.task.note)) {
        lines.push(`      Note:`);
        const noteText = stripHtml(sr.task.note);
        noteText.split('\n').filter(Boolean).forEach((line) => lines.push(`        ${line}`));
      }
      lines.push(`      Hours: ${fmtHours(sr.currentHours)} / ${fmtHours(sr.prevHours)}`);
      lines.push(`      Progress: ${sp}${sdStr}`);
    }
    lines.push('');
  }

  const orphanSubtasks = subtaskReports.filter(
    (s) => !parentReports.some((p) => p.task.id === s.task.parentId)
  );
  for (const sr of orphanSubtasks) {
    const parentTitle = tasks.find((t) => t.id === sr.task.parentId)?.title ?? 'Unknown';
    lines.push(`## ${parentTitle} › ${sr.task.title}`);
    if (!isNoteEmpty(sr.task.note)) {
      lines.push(`  Note:`);
      const noteText = stripHtml(sr.task.note);
      noteText.split('\n').filter(Boolean).forEach((line) => lines.push(`    ${line}`));
    }
    lines.push(`  Hours: ${fmtHours(sr.currentHours)} / ${fmtHours(sr.prevHours)}`);
    if (sr.currentProgress !== null || sr.prevProgress !== null) {
      const sp = sr.currentProgress ?? sr.prevProgress;
      lines.push(`  Progress: ${sp}%`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export const WeeklyReportModal: React.FC<WeeklyReportModalProps> = ({ isOpen, onClose, todayISO }) => {
  const { logs } = useTimeLogStore();
  const { tasks } = useTaskStore();

  const { currentStart, currentEnd, prevStart, prevEnd } = useMemo(() => {
    const today = parseISO(todayISO);
    return {
      currentStart: startOfDay(subDays(today, 6)),
      currentEnd: endOfDay(today),
      prevStart: startOfDay(subDays(today, 13)),
      prevEnd: endOfDay(subDays(today, 7)),
    };
  }, [todayISO]);

  // All reports (every task that has logs in either period)
  const allReports = useMemo(
    () => computeReport(tasks, logs, currentStart, currentEnd, prevStart, prevEnd),
    [tasks, logs, currentStart, currentEnd, prevStart, prevEnd]
  );

  // ── Task selection state ──────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [showFilter, setShowFilter] = useState(false);

  // Reset selection to all tasks whenever the modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set(allReports.map((r) => r.task.id)));
      setShowFilter(false);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTask = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(allReports.map((r) => r.task.id)));
  const deselectAll = () => setSelectedIds(new Set());

  // Only show reports for selected tasks
  const reports = useMemo(
    () => allReports.filter((r) => selectedIds.has(r.task.id)),
    [allReports, selectedIds]
  );

  const totalCurrentHours = reports.reduce((s, r) => s + r.currentHours, 0);
  const totalPrevHours = reports.reduce((s, r) => s + r.prevHours, 0);

  const handleCopy = () => {
    const text = generateTextReport(reports, currentStart, currentEnd, prevStart, prevEnd, tasks);
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const handleDownload = () => {
    const text = generateTextReport(reports, currentStart, currentEnd, prevStart, prevEnd, tasks);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weekly-report-${todayISO}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const parentReports = reports.filter((r) => !r.task.parentId);
  const subtaskReports = reports.filter((r) => r.task.parentId);
  const orphanSubtasks = subtaskReports.filter(
    (s) => !parentReports.some((p) => p.task.id === s.task.parentId)
  );

  // Group allReports by parent for the filter panel
  const allParents = allReports.filter((r) => !r.task.parentId);
  const allSubtasks = allReports.filter((r) => r.task.parentId);

  const allSelected = selectedIds.size === allReports.length;
  const noneSelected = selectedIds.size === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 shrink-0">
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">Weekly Report</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {format(currentStart, 'MMM d')} – {format(currentEnd, 'MMM d, yyyy')}
              </span>
              {' '}vs{' '}
              {format(prevStart, 'MMM d')} – {format(prevEnd, 'MMM d, yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Filter toggle */}
            <button
              onClick={() => setShowFilter((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                showFilter
                  ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
                  : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
              </svg>
              Filter
              {selectedIds.size < allReports.length && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold leading-none">
                  {selectedIds.size}
                </span>
              )}
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Task filter panel */}
        {showFilter && (
          <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/40 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Select tasks to include
              </span>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  disabled={allSelected}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-40 disabled:no-underline"
                >
                  All
                </button>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <button
                  onClick={deselectAll}
                  disabled={noneSelected}
                  className="text-xs text-slate-500 dark:text-slate-400 hover:underline disabled:opacity-40 disabled:no-underline"
                >
                  None
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
              {allParents.map((pr) => {
                const children = allSubtasks.filter((s) => s.task.parentId === pr.task.id);
                return (
                  <React.Fragment key={pr.task.id}>
                    <TaskFilterRow
                      report={pr}
                      checked={selectedIds.has(pr.task.id)}
                      onToggle={() => toggleTask(pr.task.id)}
                      indent={false}
                    />
                    {children.map((sr) => (
                      <TaskFilterRow
                        key={sr.task.id}
                        report={sr}
                        checked={selectedIds.has(sr.task.id)}
                        onToggle={() => toggleTask(sr.task.id)}
                        indent={true}
                      />
                    ))}
                  </React.Fragment>
                );
              })}
              {/* Orphan subtasks in filter */}
              {allSubtasks
                .filter((s) => !allParents.some((p) => p.task.id === s.task.parentId))
                .map((sr) => (
                  <TaskFilterRow
                    key={sr.task.id}
                    report={sr}
                    checked={selectedIds.has(sr.task.id)}
                    onToggle={() => toggleTask(sr.task.id)}
                    indent={false}
                  />
                ))}
            </div>
          </div>
        )}

        {/* Summary row */}
        <div className="grid grid-cols-2 gap-3 px-6 py-3 bg-slate-50 dark:bg-slate-700/40 border-b border-slate-100 dark:border-slate-700 shrink-0">
          <div className="text-center">
            <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">{fmtHours(totalCurrentHours)}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">This week</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-slate-500 dark:text-slate-400">{fmtHours(totalPrevHours)}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Previous week</div>
          </div>
        </div>

        {/* Report table */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
          {allReports.length === 0 ? (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
              No logs found in the past two weeks.
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
              No tasks selected. Use the Filter button to select tasks.
            </div>
          ) : (
            <>
              {/* Column headers */}
              <div className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-2 px-3 py-1 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                <div>Task</div>
                <div className="text-right">This wk</div>
                <div className="text-right">Prev wk</div>
                <div className="text-right">Progress</div>
                <div className="text-right">Change</div>
              </div>

              {/* Parent tasks + their subtasks */}
              {parentReports.map((pr) => {
                const children = subtaskReports.filter((s) => s.task.parentId === pr.task.id);
                const delta = pr.currentProgress !== null && pr.prevProgress !== null
                  ? pr.currentProgress - pr.prevProgress
                  : null;
                return (
                  <React.Fragment key={pr.task.id}>
                    <TaskRow report={pr} delta={delta} indent={false} />
                    {children.map((sr) => {
                      const cd = sr.currentProgress !== null && sr.prevProgress !== null
                        ? sr.currentProgress - sr.prevProgress
                        : null;
                      return <TaskRow key={sr.task.id} report={sr} delta={cd} indent={true} />;
                    })}
                  </React.Fragment>
                );
              })}

              {/* Orphan subtasks */}
              {orphanSubtasks.map((sr) => {
                const cd = sr.currentProgress !== null && sr.prevProgress !== null
                  ? sr.currentProgress - sr.prevProgress
                  : null;
                return <TaskRow key={sr.task.id} report={sr} delta={cd} indent={false} />;
              })}
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex gap-2 px-6 py-4 border-t border-slate-100 dark:border-slate-700 shrink-0">
          <button
            onClick={handleCopy}
            disabled={reports.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-40"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy as text
          </button>
          <button
            onClick={handleDownload}
            disabled={reports.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-40"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download .txt
          </button>
          <button
            onClick={onClose}
            className="ml-auto px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ── TaskFilterRow: checkbox item in the filter panel ───────────────────────

interface TaskFilterRowProps {
  report: TaskReport;
  checked: boolean;
  onToggle: () => void;
  indent: boolean;
}

const TaskFilterRow: React.FC<TaskFilterRowProps> = ({ report, checked, onToggle, indent }) => (
  <label
    className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer hover:bg-white dark:hover:bg-slate-600/50 transition-colors select-none ${indent ? 'ml-5' : ''}`}
  >
    <input
      type="checkbox"
      checked={checked}
      onChange={onToggle}
      className="w-3.5 h-3.5 rounded accent-blue-600 shrink-0"
    />
    <span
      className="w-2.5 h-2.5 rounded-full shrink-0"
      style={{ backgroundColor: report.task.color }}
    />
    <span className={`text-sm truncate ${indent ? 'text-slate-600 dark:text-slate-400' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
      {report.task.title}
    </span>
    <span className="ml-auto text-xs text-slate-400 dark:text-slate-500 shrink-0">
      {fmtHours(report.currentHours)}
    </span>
  </label>
);

// ── TaskRow: data row in the report table ──────────────────────────────────

interface TaskRowProps {
  report: TaskReport;
  delta: number | null;
  indent: boolean;
}

const TaskRow: React.FC<TaskRowProps> = ({ report, delta, indent }) => {
  const { task, currentHours, prevHours, currentProgress, prevProgress } = report;
  const progressDisplay = currentProgress ?? prevProgress;
  const isStale = currentProgress === null && prevProgress !== null;
  const hasNote = !isNoteEmpty(task.note);

  return (
    <div className={`rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${indent ? 'ml-4' : ''}`}>
      <div className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-2 items-center px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        {indent && (
          <span className="text-slate-300 dark:text-slate-600 text-xs shrink-0">└</span>
        )}
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: task.color }} />
        <span className={`text-sm truncate ${indent ? 'text-slate-600 dark:text-slate-400' : 'font-medium text-slate-800 dark:text-slate-200'}`}>
          {task.title}
        </span>
      </div>

      <div className="text-right text-sm font-medium text-slate-800 dark:text-slate-200">
        {fmtHours(currentHours)}
      </div>

      <div className="text-right text-sm text-slate-400 dark:text-slate-500">
        {fmtHours(prevHours)}
      </div>

      <div className="text-right">
        {progressDisplay !== null ? (
          <span className={`text-sm font-medium ${isStale ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}>
            {progressDisplay}%
          </span>
        ) : (
          <span className="text-slate-300 dark:text-slate-600 text-sm">—</span>
        )}
      </div>

      <div className="text-right">
        {delta !== null ? (
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
            delta > 0
              ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30'
              : delta < 0
              ? 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
              : 'text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-slate-700'
          }`}>
            {delta > 0 ? `+${delta}%` : delta < 0 ? `${delta}%` : '±0%'}
          </span>
        ) : (
          <span className="text-slate-300 dark:text-slate-600 text-sm">—</span>
        )}
      </div>
      </div>

      {/* Task note */}
      {hasNote && (
        <div
          className="rich-content px-3 pb-2.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed"
          style={{ paddingLeft: indent ? '2.75rem' : '2.25rem' }}
          dangerouslySetInnerHTML={{ __html: task.note }}
        />
      )}
    </div>
  );
};
