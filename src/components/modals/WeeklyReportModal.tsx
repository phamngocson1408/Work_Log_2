import React, { useMemo, useState, useEffect } from 'react';
import { format, parseISO, subDays, differenceInMinutes, startOfDay, endOfDay, differenceInCalendarDays } from 'date-fns';
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
  currentLogs: TimeLog[];
  prevLogs: TimeLog[];
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
    const currentLogs = filterLogsByRange(taskLogs, currentStart, currentEnd)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    const prevLogs = filterLogsByRange(taskLogs, prevStart, prevEnd)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    if (currentLogs.length === 0 && prevLogs.length === 0) continue;

    reports.push({
      task,
      currentHours: sumHours(currentLogs),
      prevHours: sumHours(prevLogs),
      currentProgress: latestProgress(currentLogs),
      prevProgress: latestProgress(prevLogs),
      currentLogs,
      prevLogs,
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

function fmtLogTime(log: TimeLog): string {
  const date = log.startTime.slice(0, 10);
  const start = log.startTime.slice(11, 16);
  const end = log.endTime.slice(11, 16);
  const mins = differenceInMinutes(parseISO(log.endTime), parseISO(log.startTime));
  const duration = fmtHours(Math.max(0, mins) / 60);
  return `[${date}] ${start}–${end} (${duration})`;
}

function appendLogs(lines: string[], logs: TimeLog[], indent: string) {
  const withContent = logs.filter((l) => !isNoteEmpty(l.content));
  if (withContent.length === 0) return;
  lines.push(`${indent}Logs:`);
  for (const log of withContent) {
    lines.push(`${indent}  ${fmtLogTime(log)}`);
    const text = stripHtml(log.content);
    text.split('\n').filter(Boolean).forEach((line) => lines.push(`${indent}    ${line}`));
  }
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
  lines.push('# Report');
  lines.push(`Period:   ${format(currentStart, 'MMM d')} – ${format(currentEnd, 'MMM d, yyyy')}`);
  lines.push(`Previous: ${format(prevStart, 'MMM d')} – ${format(prevEnd, 'MMM d, yyyy')}`);
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
      stripHtml(pr.task.note).split('\n').filter(Boolean).forEach((l) => lines.push(`    ${l}`));
    }
    lines.push(`  Hours: ${fmtHours(pr.currentHours)} this period / ${fmtHours(pr.prevHours)} prev period`);
    lines.push(`  Progress: ${progressStr}${deltaStr}`);
    appendLogs(lines, pr.currentLogs, '  ');

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
        stripHtml(sr.task.note).split('\n').filter(Boolean).forEach((l) => lines.push(`        ${l}`));
      }
      lines.push(`      Hours: ${fmtHours(sr.currentHours)} / ${fmtHours(sr.prevHours)}`);
      lines.push(`      Progress: ${sp}${sdStr}`);
      appendLogs(lines, sr.currentLogs, '      ');
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
      stripHtml(sr.task.note).split('\n').filter(Boolean).forEach((l) => lines.push(`    ${l}`));
    }
    lines.push(`  Hours: ${fmtHours(sr.currentHours)} / ${fmtHours(sr.prevHours)}`);
    if (sr.currentProgress !== null || sr.prevProgress !== null) {
      lines.push(`  Progress: ${sr.currentProgress ?? sr.prevProgress}%`);
    }
    appendLogs(lines, sr.currentLogs, '  ');
    lines.push('');
  }

  return lines.join('\n');
}

// ── HTML report generator ──────────────────────────────────────────────────

function deltaHtml(delta: number | null): string {
  if (delta === null) return '';
  const cls = delta > 0 ? 'color:#16a34a' : delta < 0 ? 'color:#dc2626' : 'color:#64748b';
  const label = delta > 0 ? `+${delta}%` : delta < 0 ? `${delta}%` : '±0%';
  return `<span style="font-size:11px;font-weight:600;${cls}">${label}</span>`;
}

function progressBar(p: number): string {
  return `<div style="display:flex;align-items:center;gap:6px;margin-top:4px">
    <div style="flex:1;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden">
      <div style="width:${p}%;height:100%;background:#3b82f6;border-radius:3px"></div>
    </div>
    <span style="font-size:11px;color:#475569;min-width:28px;text-align:right">${p}%</span>
  </div>`;
}

function logEntryHtml(log: TimeLog): string {
  const date = log.startTime.slice(0, 10);
  const start = log.startTime.slice(11, 16);
  const end = log.endTime.slice(11, 16);
  const mins = differenceInMinutes(parseISO(log.endTime), parseISO(log.startTime));
  const duration = fmtHours(Math.max(0, mins) / 60);
  const hasContent = !isNoteEmpty(log.content);
  return `<div style="margin:6px 0;padding:8px 10px;background:#f8fafc;border-radius:6px;border-left:3px solid #cbd5e1">
    <div style="font-size:11px;color:#64748b;font-weight:500;margin-bottom:${hasContent ? '6px' : '0'}">${date} &nbsp;${start}–${end} &nbsp;<span style="color:#94a3b8">(${duration})</span></div>
    ${hasContent ? `<div style="font-size:13px;color:#334155">${log.content}</div>` : ''}
  </div>`;
}

function taskSectionHtml(report: TaskReport, children: TaskReport[], tasks: Task[]): string {
  const { task, currentHours, prevHours, currentProgress, prevProgress, currentLogs } = report;
  const delta = currentProgress !== null && prevProgress !== null ? currentProgress - prevProgress : null;
  const progressDisplay = currentProgress ?? prevProgress;
  const isSubtask = !!task.parentId;
  const indent = isSubtask ? 'margin-left:20px;border-left:3px solid #e2e8f0;padding-left:14px;' : '';
  const titleSize = isSubtask ? '14px' : '16px';
  const bgColor = isSubtask ? '#f8fafc' : '#ffffff';

  const logsHtml = currentLogs.length > 0
    ? `<div style="margin-top:10px"><div style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Logs</div>${currentLogs.map(logEntryHtml).join('')}</div>`
    : '';

  const noteHtml = !isNoteEmpty(task.note)
    ? `<div style="margin-top:10px;font-size:13px;color:#475569;line-height:1.6">${task.note}</div>`
    : '';

  const statsHtml = `<div style="display:flex;gap:20px;flex-wrap:wrap;margin-top:10px">
    <div><span style="font-size:11px;color:#94a3b8;display:block">This period</span><span style="font-size:15px;font-weight:600;color:#1e293b">${fmtHours(currentHours)}</span></div>
    <div><span style="font-size:11px;color:#94a3b8;display:block">Prev period</span><span style="font-size:15px;font-weight:600;color:#94a3b8">${fmtHours(prevHours)}</span></div>
    ${progressDisplay !== null ? `<div style="flex:1;min-width:120px"><span style="font-size:11px;color:#94a3b8;display:block">Progress ${deltaHtml(delta)}</span>${progressBar(progressDisplay)}</div>` : ''}
  </div>`;

  const childrenHtml = children.map((sr) => taskSectionHtml(sr, [], tasks)).join('');

  return `<div style="margin-bottom:16px;padding:14px 16px;background:${bgColor};border-radius:10px;border:1px solid #e2e8f0;${indent}">
    <div style="display:flex;align-items:center;gap:8px">
      <span style="width:10px;height:10px;border-radius:50%;background:${task.color};flex-shrink:0;display:inline-block"></span>
      <span style="font-size:${titleSize};font-weight:600;color:#0f172a">${task.title}</span>
    </div>
    ${statsHtml}
    ${noteHtml}
    ${logsHtml}
    ${childrenHtml ? `<div style="margin-top:12px">${childrenHtml}</div>` : ''}
  </div>`;
}

function generateHtmlReport(
  reports: TaskReport[],
  currentStart: Date,
  currentEnd: Date,
  prevStart: Date,
  prevEnd: Date,
  tasks: Task[],
): string {
  const parentReports = reports.filter((r) => !r.task.parentId);
  const subtaskReports = reports.filter((r) => r.task.parentId);
  const orphanSubtasks = subtaskReports.filter(
    (s) => !parentReports.some((p) => p.task.id === s.task.parentId)
  );

  const totalCurrent = reports.filter((r) => !r.task.parentId).reduce((s, r) => s + r.currentHours, 0);
  const totalPrev = reports.filter((r) => !r.task.parentId).reduce((s, r) => s + r.prevHours, 0);

  const sectionsHtml = [
    ...parentReports.map((pr) => {
      const children = subtaskReports.filter((s) => s.task.parentId === pr.task.id);
      return taskSectionHtml(pr, children, tasks);
    }),
    ...orphanSubtasks.map((sr) => taskSectionHtml(sr, [], tasks)),
  ].join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Report ${format(currentStart, 'MMM d')}–${format(currentEnd, 'MMM d, yyyy')}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9;color:#1e293b;padding:32px 16px}
  .container{max-width:720px;margin:0 auto}
  img{max-width:100%;height:auto;border-radius:6px;display:block;margin:6px 0}
  ul,ol{padding-left:1.4em;margin:4px 0}
  li{margin:2px 0}
  p{margin:0 0 4px 0}
  p:last-child{margin-bottom:0}
  blockquote{border-left:3px solid #cbd5e1;padding-left:10px;color:#64748b;margin:4px 0}
  code{font-family:monospace;font-size:.85em;background:#f1f5f9;border-radius:3px;padding:1px 4px}
  strong{font-weight:600}
  em{font-style:italic}
  s{text-decoration:line-through}
</style>
</head>
<body>
<div class="container">
  <div style="margin-bottom:28px">
    <h1 style="font-size:22px;font-weight:700;color:#0f172a;margin-bottom:6px">Report</h1>
    <div style="font-size:13px;color:#64748b">
      <strong style="color:#334155">${format(currentStart, 'MMM d')} – ${format(currentEnd, 'MMM d, yyyy')}</strong>
      &nbsp;vs&nbsp; ${format(prevStart, 'MMM d')} – ${format(prevEnd, 'MMM d, yyyy')}
    </div>
  </div>

  <div style="display:flex;gap:16px;margin-bottom:24px">
    <div style="flex:1;background:#fff;border-radius:10px;border:1px solid #e2e8f0;padding:16px;text-align:center">
      <div style="font-size:11px;color:#94a3b8;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em">This period</div>
      <div style="font-size:24px;font-weight:700;color:#0f172a">${fmtHours(totalCurrent)}</div>
    </div>
    <div style="flex:1;background:#fff;border-radius:10px;border:1px solid #e2e8f0;padding:16px;text-align:center">
      <div style="font-size:11px;color:#94a3b8;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em">Previous period</div>
      <div style="font-size:24px;font-weight:700;color:#94a3b8">${fmtHours(totalPrev)}</div>
    </div>
  </div>

  ${sectionsHtml}
</div>
</body>
</html>`;
}

// ── Compute previous period from current range ─────────────────────────────
function computePrevPeriod(currentStart: Date, currentEnd: Date): { prevStart: Date; prevEnd: Date } {
  const days = differenceInCalendarDays(currentEnd, currentStart) + 1;
  const prevEnd = startOfDay(subDays(currentStart, 1));
  const prevStart = startOfDay(subDays(prevEnd, days - 1));
  return { prevStart, prevEnd: endOfDay(subDays(currentStart, 1)) };
}

// ── Main component ─────────────────────────────────────────────────────────

export const WeeklyReportModal: React.FC<WeeklyReportModalProps> = ({ isOpen, onClose, todayISO }) => {
  const { logs } = useTimeLogStore();
  const { tasks } = useTaskStore();

  // ── Date range state ──────────────────────────────────────────────────────
  const defaultFrom = format(subDays(parseISO(todayISO), 7), 'yyyy-MM-dd');
  const defaultTo = todayISO;

  const [fromISO, setFromISO] = useState(defaultFrom);
  const [toISO, setToISO] = useState(defaultTo);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setFromISO(format(subDays(parseISO(todayISO), 7), 'yyyy-MM-dd'));
      setToISO(todayISO);
      setShowFilter(false);
    }
  }, [isOpen, todayISO]); // eslint-disable-line react-hooks/exhaustive-deps

  const { currentStart, currentEnd, prevStart, prevEnd } = useMemo(() => {
    const cs = startOfDay(parseISO(fromISO));
    const ce = endOfDay(parseISO(toISO > fromISO ? toISO : fromISO));
    const { prevStart, prevEnd } = computePrevPeriod(cs, ce);
    return { currentStart: cs, currentEnd: ce, prevStart, prevEnd };
  }, [fromISO, toISO]);

  // ── Reports ───────────────────────────────────────────────────────────────
  const allReports = useMemo(
    () => computeReport(tasks, logs, currentStart, currentEnd, prevStart, prevEnd),
    [tasks, logs, currentStart, currentEnd, prevStart, prevEnd]
  );

  // ── Task selection state ──────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [showFilter, setShowFilter] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set(allReports.map((r) => r.task.id)));
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync selection when allReports changes (date range changed)
  useEffect(() => {
    setSelectedIds((prev) => {
      const allIds = new Set(allReports.map((r) => r.task.id));
      // Add newly appearing tasks, keep existing selection for tasks still present
      const next = new Set<string>();
      for (const id of allIds) {
        if (!prev.size || prev.has(id)) next.add(id);
        else next.add(id); // auto-select new tasks when range changes
      }
      return next;
    });
  }, [allReports]);

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
    a.download = `report-${fromISO}-to-${toISO}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadHtml = () => {
    const html = generateHtmlReport(reports, currentStart, currentEnd, prevStart, prevEnd, tasks);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${fromISO}-to-${toISO}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const parentReports = reports.filter((r) => !r.task.parentId);
  const subtaskReports = reports.filter((r) => r.task.parentId);
  const orphanSubtasks = subtaskReports.filter(
    (s) => !parentReports.some((p) => p.task.id === s.task.parentId)
  );

  const allParents = allReports.filter((r) => !r.task.parentId);
  const allSubtasks = allReports.filter((r) => r.task.parentId);
  const allSelected = selectedIds.size === allReports.length;
  const noneSelected = selectedIds.size === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">Report</h2>
            <div className="flex items-center gap-2">
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

          {/* Date range picker */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 flex-1">
              <label className="text-xs text-slate-500 dark:text-slate-400 shrink-0">From</label>
              <input
                type="date"
                value={fromISO}
                max={toISO}
                onChange={(e) => setFromISO(e.target.value)}
                className="flex-1 px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <span className="text-slate-400 dark:text-slate-500 text-xs">—</span>
            <div className="flex items-center gap-1.5 flex-1">
              <label className="text-xs text-slate-500 dark:text-slate-400 shrink-0">To</label>
              <input
                type="date"
                value={toISO}
                min={fromISO}
                onChange={(e) => setToISO(e.target.value)}
                className="flex-1 px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">
              vs {format(prevStart, 'MMM d')}–{format(prevEnd, 'MMM d')}
            </span>
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
                <button onClick={selectAll} disabled={allSelected}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-40 disabled:no-underline">All</button>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <button onClick={deselectAll} disabled={noneSelected}
                  className="text-xs text-slate-500 dark:text-slate-400 hover:underline disabled:opacity-40 disabled:no-underline">None</button>
              </div>
            </div>
            <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
              {allParents.map((pr) => {
                const children = allSubtasks.filter((s) => s.task.parentId === pr.task.id);
                return (
                  <React.Fragment key={pr.task.id}>
                    <TaskFilterRow report={pr} checked={selectedIds.has(pr.task.id)} onToggle={() => toggleTask(pr.task.id)} indent={false} />
                    {children.map((sr) => (
                      <TaskFilterRow key={sr.task.id} report={sr} checked={selectedIds.has(sr.task.id)} onToggle={() => toggleTask(sr.task.id)} indent={true} />
                    ))}
                  </React.Fragment>
                );
              })}
              {allSubtasks.filter((s) => !allParents.some((p) => p.task.id === s.task.parentId)).map((sr) => (
                <TaskFilterRow key={sr.task.id} report={sr} checked={selectedIds.has(sr.task.id)} onToggle={() => toggleTask(sr.task.id)} indent={false} />
              ))}
            </div>
          </div>
        )}

        {/* Summary row */}
        <div className="grid grid-cols-2 gap-3 px-6 py-3 bg-slate-50 dark:bg-slate-700/40 border-b border-slate-100 dark:border-slate-700 shrink-0">
          <div className="text-center">
            <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">{fmtHours(totalCurrentHours)}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">This period</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-slate-500 dark:text-slate-400">{fmtHours(totalPrevHours)}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Previous period</div>
          </div>
        </div>

        {/* Report table */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
          {allReports.length === 0 ? (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
              No logs found in the selected period.
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
              No tasks selected. Use the Filter button to select tasks.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-2 px-3 py-1 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                <div>Task</div>
                <div className="text-right">This</div>
                <div className="text-right">Prev</div>
                <div className="text-right">Progress</div>
                <div className="text-right">Change</div>
              </div>

              {parentReports.map((pr) => {
                const children = subtaskReports.filter((s) => s.task.parentId === pr.task.id);
                const delta = pr.currentProgress !== null && pr.prevProgress !== null
                  ? pr.currentProgress - pr.prevProgress : null;
                return (
                  <React.Fragment key={pr.task.id}>
                    <TaskRow report={pr} delta={delta} indent={false} />
                    {children.map((sr) => {
                      const cd = sr.currentProgress !== null && sr.prevProgress !== null
                        ? sr.currentProgress - sr.prevProgress : null;
                      return <TaskRow key={sr.task.id} report={sr} delta={cd} indent={true} />;
                    })}
                  </React.Fragment>
                );
              })}

              {orphanSubtasks.map((sr) => {
                const cd = sr.currentProgress !== null && sr.prevProgress !== null
                  ? sr.currentProgress - sr.prevProgress : null;
                return <TaskRow key={sr.task.id} report={sr} delta={cd} indent={false} />;
              })}
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex gap-2 px-6 py-4 border-t border-slate-100 dark:border-slate-700 shrink-0">
          <button onClick={handleCopy} disabled={reports.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-40">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy as text
          </button>
          <button onClick={handleDownload} disabled={reports.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-40">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            .txt
          </button>
          <button onClick={handleDownloadHtml} disabled={reports.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-700 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-40">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            .html (có ảnh)
          </button>
          <button onClick={onClose}
            className="ml-auto px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ── TaskFilterRow ──────────────────────────────────────────────────────────

interface TaskFilterRowProps {
  report: TaskReport;
  checked: boolean;
  onToggle: () => void;
  indent: boolean;
}

const TaskFilterRow: React.FC<TaskFilterRowProps> = ({ report, checked, onToggle, indent }) => (
  <label className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer hover:bg-white dark:hover:bg-slate-600/50 transition-colors select-none ${indent ? 'ml-5' : ''}`}>
    <input type="checkbox" checked={checked} onChange={onToggle} className="w-3.5 h-3.5 rounded accent-blue-600 shrink-0" />
    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: report.task.color }} />
    <span className={`text-sm truncate ${indent ? 'text-slate-600 dark:text-slate-400' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
      {report.task.title}
    </span>
    <span className="ml-auto text-xs text-slate-400 dark:text-slate-500 shrink-0">{fmtHours(report.currentHours)}</span>
  </label>
);

// ── TaskRow ────────────────────────────────────────────────────────────────

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
          {indent && <span className="text-slate-300 dark:text-slate-600 text-xs shrink-0">└</span>}
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: task.color }} />
          <span className={`text-sm truncate ${indent ? 'text-slate-600 dark:text-slate-400' : 'font-medium text-slate-800 dark:text-slate-200'}`}>
            {task.title}
          </span>
        </div>
        <div className="text-right text-sm font-medium text-slate-800 dark:text-slate-200">{fmtHours(currentHours)}</div>
        <div className="text-right text-sm text-slate-400 dark:text-slate-500">{fmtHours(prevHours)}</div>
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
              delta > 0 ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30'
              : delta < 0 ? 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
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
