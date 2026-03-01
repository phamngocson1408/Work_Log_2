import React, { useCallback, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { parseISO, format, differenceInMinutes, startOfWeek } from 'date-fns';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTaskStore } from '../../store/taskStore';
import { useTimeLogStore } from '../../store/timeLogStore';
import { useSettingsStore } from '../../store/settingsStore';
import { LogBlock } from './LogBlock';
import { useTimelineSelection, type SelectionRange } from '../../hooks/useTimelineSelection';
import {
  generateDaySlots,
  getSlotWidth,
  getLogBlockGeometry,
  getDayTotalWidth,
  getAllDays,
  getAllWeeks,
  getAllMonths,
  isWeekend,
} from '../../utils/timeUtils';
import type { Task, TimeLog, SlotDuration } from '../../types';

const SIDEBAR_WIDTH = 280;
const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 40;
const DAY_VIEW_COL_W = 44;   // px per column in Day view
const WEEK_VIEW_COL_W = 72;  // px per column in Week view
const MONTH_VIEW_COL_W = 90; // px per column in Month view

// ── Inline task name cell (sticky-left inside the single scroll container) ────

interface TaskNameCellProps {
  task: Task;
  depth: number;
  hasChildren: boolean;
  onEdit: (t: Task) => void;
  onAddSubtask: (pid: string) => void;
  dragHandleProps?: Record<string, unknown>;
}

const TaskNameCell: React.FC<TaskNameCellProps> = ({
  task,
  depth,
  hasChildren,
  onEdit,
  onAddSubtask,
  dragHandleProps,
}) => {
  const { toggleExpanded, deleteTask, updateTask } = useTaskStore();
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  const handleMenuToggle = () => {
    if (!showMenu && menuBtnRef.current) {
      const rect = menuBtnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setShowMenu((s) => !s);
  };

  const cycleStatus = (e: React.MouseEvent) => {
    e.stopPropagation();
    const statuses: Task['status'][] = ['not_started', 'in_progress', 'completed'];
    const idx = statuses.indexOf(task.status);
    updateTask(task.id, { status: statuses[(idx + 1) % 3] });
  };

  return (
    <div
      className="sticky left-0 z-10 bg-white dark:bg-slate-900 border-r border-b border-slate-200 dark:border-slate-700 flex items-center gap-1 group shrink-0 select-none"
      style={{ width: SIDEBAR_WIDTH, minWidth: SIDEBAR_WIDTH, height: ROW_HEIGHT, paddingLeft: depth * 16 + 4 }}
    >
      {/* Drag handle */}
      <button
        className="opacity-0 group-hover:opacity-40 hover:!opacity-70 cursor-grab text-slate-400 dark:text-slate-500 p-0.5 shrink-0"
        {...dragHandleProps}
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-6 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-6 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
        </svg>
      </button>

      {/* Expand toggle */}
      {hasChildren ? (
        <button
          onClick={() => toggleExpanded(task.id)}
          className="shrink-0 w-4 h-4 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
          style={{ transform: task.isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      ) : (
        <div className="shrink-0 w-4" />
      )}

      {/* Color dot */}
      <div className="shrink-0 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: task.color }} />

      {/* Title — click to edit */}
      <span
        className={`flex-1 text-sm truncate cursor-pointer hover:underline underline-offset-2 ${task.status === 'completed' ? 'line-through text-slate-400 dark:text-slate-600' : 'text-slate-700 dark:text-slate-300'}`}
        title={`${task.title}${task.note ? '\n' + task.note : ''}`}
        onClick={(e) => { e.stopPropagation(); onEdit(task); }}
      >
        {task.title}
      </span>

      {/* Status icon */}
      <button
        onClick={cycleStatus}
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        title={`Status: ${task.status}`}
      >
        {task.status === 'not_started' && (
          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth={2} />
          </svg>
        )}
        {task.status === 'in_progress' && (
          <svg className="w-3.5 h-3.5 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" opacity=".3"/>
            <path d="M12 2v10l6 3A10 10 0 1 0 12 2z" />
          </svg>
        )}
        {task.status === 'completed' && (
          <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </button>

      {/* Context menu trigger */}
      <div className="shrink-0">
        <button
          ref={menuBtnRef}
          onClick={handleMenuToggle}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>
      </div>

      {/* Context menu — rendered as portal to escape sticky stacking context */}
      {showMenu && ReactDOM.createPortal(
        <>
          <div className="fixed inset-0 z-[200]" onClick={() => setShowMenu(false)} />
          <div
            className="fixed z-[201] bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 w-40"
            style={{ top: menuPos.top, right: menuPos.right }}
          >
            <button onClick={() => { onEdit(task); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">Edit</button>
            <button onClick={() => { onAddSubtask(task.id); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">Add Subtask</button>
            <div className="h-px bg-slate-100 dark:bg-slate-700 my-1" />
            <button onClick={() => { if (confirm(`Delete "${task.title}"?`)) deleteTask(task.id); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">Delete</button>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

// ── Sortable row wrapper ───────────────────────────────────────────────────────

interface SortableRowProps {
  task: Task;
  depth: number;
  hasChildren: boolean;
  onEdit: (t: Task) => void;
  onAddSubtask: (pid: string) => void;
  children: React.ReactNode;
}

const SortableRow: React.FC<SortableRowProps> = ({ task, depth, hasChildren, onEdit, onAddSubtask, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      className="flex"
      style={{
        height: ROW_HEIGHT,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <TaskNameCell
        task={task}
        depth={depth}
        hasChildren={hasChildren}
        onEdit={onEdit}
        onAddSubtask={onAddSubtask}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
      {children}
    </div>
  );
};

// ── Hour view: time-slot content ──────────────────────────────────────────────

interface HourContentProps {
  task: Task;
  dayDate: Date;
  dayISO: string;
  logs: TimeLog[];
  slots: ReturnType<typeof generateDaySlots>;
  slotWidth: number;
  slotDuration: SlotDuration;
  getSelectionForCell: (taskId: string, dayISO: string, slotIndex: number) => boolean;
  onSlotMouseDown: (taskId: string, dayISO: string, slotIndex: number) => void;
  onSlotMouseEnter: (taskId: string, dayISO: string, slotIndex: number) => void;
  onLogClick: (log: TimeLog) => void;
}

const HourContent: React.FC<HourContentProps> = ({
  task, dayDate, dayISO, logs, slots, slotWidth, slotDuration,
  getSelectionForCell, onSlotMouseDown, onSlotMouseEnter, onLogClick,
}) => {
  const totalWidth = slots.length * slotWidth;
  return (
    <div className="relative border-b border-slate-200 dark:border-slate-700 flex shrink-0" style={{ width: totalWidth, height: ROW_HEIGHT }}>
      {slots.map((slot) => {
        // Dark border at the RIGHT edge of the slot that ends on an exact hour
        // e.g. for 30min: slot at 07:30 → right edge = 08:00 ✓
        const isHourBoundary = (slot.startMinutes + slotDuration) % 60 === 0;
        const isSelected = getSelectionForCell(task.id, dayISO, slot.index);
        return (
          <div
            key={slot.index}
            className={`shrink-0 border-r h-full cursor-crosshair ${
              isHourBoundary ? 'border-slate-300 dark:border-slate-600' : 'border-slate-100 dark:border-slate-800'
            } ${isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
            style={{ width: slotWidth }}
            onMouseDown={(e) => { e.preventDefault(); onSlotMouseDown(task.id, dayISO, slot.index); }}
            onMouseEnter={() => onSlotMouseEnter(task.id, dayISO, slot.index)}
          />
        );
      })}
      {logs.map((log) => {
        const geo = getLogBlockGeometry(parseISO(log.startTime), parseISO(log.endTime), dayDate, slotDuration);
        if (!geo) return null;
        return (
          <LogBlock key={log.id} log={log} task={task} left={geo.left} width={geo.width} rowHeight={ROW_HEIGHT} onClick={onLogClick} />
        );
      })}
    </div>
  );
};

// ── Main Timeline Grid ────────────────────────────────────────────────────────

interface TimelineGridProps {
  onOpenLogModal: (taskId: string, dayISO: string, startSlot: number, endSlot: number) => void;
  onEditLog: (log: TimeLog) => void;
  onEditTask: (task: Task) => void;
  onAddSubtask: (parentId: string) => void;
}

export const TimelineGrid: React.FC<TimelineGridProps> = ({
  onOpenLogModal, onEditLog, onEditTask, onAddSubtask,
}) => {
  const { tasks, getFlatList, reorderTasks } = useTaskStore();
  const { slotDuration, viewMode, currentDate, setCurrentDate, setViewMode, todayScrollTrigger } = useSettingsStore();
  const logs = useTimeLogStore((s) => s.logs);

  const scrollRef = useRef<HTMLDivElement>(null);
  const visibleTasks = getFlatList();

  const todayISO = format(new Date(), 'yyyy-MM-dd');
  const currentYear = parseISO(currentDate).getFullYear();

  // ── Precompute date ranges ─────────────────────────────────────────────────
  const allDays = useMemo(() => {
    const s = new Date(currentYear - 1, 0, 1);
    const e = new Date(currentYear + 1, 11, 31);
    return getAllDays(s, e);
  }, [currentYear]);

  const allWeeks = useMemo(() => {
    const s = new Date(currentYear - 1, 0, 1);
    const e = new Date(currentYear + 1, 11, 31);
    return getAllWeeks(s, e);
  }, [currentYear]);

  const allMonths = useMemo(() => {
    const s = new Date(currentYear - 2, 0, 1);
    const e = new Date(currentYear + 2, 11, 31);
    return getAllMonths(s, e);
  }, [currentYear]);

  // ── Precompute log totals ──────────────────────────────────────────────────
  const logTotals = useMemo(() => {
    const byDay: Record<string, Record<string, number>> = {};
    const byWeek: Record<string, Record<string, number>> = {};
    const byMonth: Record<string, Record<string, number>> = {};
    for (const log of logs) {
      const startDate = parseISO(log.startTime);
      const mins = differenceInMinutes(parseISO(log.endTime), startDate);
      const { taskId } = log;
      const dayKey = format(startDate, 'yyyy-MM-dd');
      const weekKey = format(startOfWeek(startDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const monthKey = format(startDate, 'yyyy-MM');
      if (!byDay[taskId]) byDay[taskId] = {};
      byDay[taskId][dayKey] = (byDay[taskId][dayKey] || 0) + mins;
      if (!byWeek[taskId]) byWeek[taskId] = {};
      byWeek[taskId][weekKey] = (byWeek[taskId][weekKey] || 0) + mins;
      if (!byMonth[taskId]) byMonth[taskId] = {};
      byMonth[taskId][monthKey] = (byMonth[taskId][monthKey] || 0) + mins;
    }
    return { byDay, byWeek, byMonth };
  }, [logs]);

  // ── DnD ───────────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = visibleTasks.findIndex((t) => t.id === active.id);
    const newIdx = visibleTasks.findIndex((t) => t.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = [...visibleTasks];
    const [moved] = reordered.splice(oldIdx, 1);
    reordered.splice(newIdx, 0, moved);
    reorderTasks(reordered.map((t) => t.id));
  };

  // ── Selection (hour view only) ─────────────────────────────────────────────
  const handleSelectionComplete = useCallback(
    (range: SelectionRange) => onOpenLogModal(range.taskId, range.dayISO, range.startSlot, range.endSlot),
    [onOpenLogModal]
  );
  const { isSelecting, onSlotMouseDown, onSlotMouseEnter, getSelectionForCell } =
    useTimelineSelection(handleSelectionComplete);

  // ── Hour view data ─────────────────────────────────────────────────────────
  const slots = generateDaySlots(slotDuration);
  const slotWidth = getSlotWidth(slotDuration);
  const dayDate = parseISO(currentDate);
  const dayTotalWidth = getDayTotalWidth(slotDuration);
  const labelInterval = slotDuration === 30 ? 2 : 3;

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    if (viewMode === 'hour') {
      const now = new Date();
      const anchorMinutes =
        currentDate === todayISO
          ? Math.max(0, now.getHours() * 60 + now.getMinutes() - 60)
          : 8 * 60;
      el.scrollLeft = (anchorMinutes / slotDuration) * slotWidth;
    } else if (viewMode === 'day') {
      const idx = allDays.findIndex((d) => format(d, 'yyyy-MM-dd') === currentDate);
      if (idx >= 0) {
        el.scrollLeft = Math.max(0, idx * DAY_VIEW_COL_W - el.clientWidth / 2 + DAY_VIEW_COL_W / 2);
      }
    } else if (viewMode === 'week') {
      const curWeekKey = format(startOfWeek(parseISO(currentDate), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const idx = allWeeks.findIndex((w) => format(w, 'yyyy-MM-dd') === curWeekKey);
      if (idx >= 0) {
        el.scrollLeft = Math.max(0, idx * WEEK_VIEW_COL_W - el.clientWidth / 2 + WEEK_VIEW_COL_W / 2);
      }
    } else {
      const curMonthKey = format(parseISO(currentDate), 'yyyy-MM');
      const idx = allMonths.findIndex((m) => format(m, 'yyyy-MM') === curMonthKey);
      if (idx >= 0) {
        el.scrollLeft = Math.max(0, idx * MONTH_VIEW_COL_W - el.clientWidth / 2 + MONTH_VIEW_COL_W / 2);
      }
    }
  }, [viewMode, currentDate, todayScrollTrigger, allDays, allWeeks, allMonths, slotDuration, slotWidth, todayISO]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getDepth = useCallback((task: Task): number => {
    let depth = 0;
    let current = task;
    while (current.parentId) {
      const parent = tasks.find((t) => t.id === current.parentId);
      if (!parent) break;
      depth++;
      current = parent;
    }
    return depth;
  }, [tasks]);

  const hasChildren = useCallback((id: string) => tasks.some((t) => t.parentId === id), [tasks]);

  // ── Content dimensions ────────────────────────────────────────────────────
  const contentWidth =
    viewMode === 'hour' ? SIDEBAR_WIDTH + dayTotalWidth :
    viewMode === 'day' ? SIDEBAR_WIDTH + allDays.length * DAY_VIEW_COL_W :
    viewMode === 'week' ? SIDEBAR_WIDTH + allWeeks.length * WEEK_VIEW_COL_W :
    SIDEBAR_WIDTH + allMonths.length * MONTH_VIEW_COL_W;

  // ── Empty state ───────────────────────────────────────────────────────────
  if (visibleTasks.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 gap-3">
        <svg className="w-12 h-12 text-slate-200 dark:text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p className="text-sm">No tasks yet. Add a task to get started.</p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-auto no-select"
      style={{ cursor: isSelecting && viewMode === 'hour' ? 'crosshair' : undefined }}
    >
      {/* ── Inner container: full content width ── */}
      <div style={{ width: contentWidth, minWidth: contentWidth, position: 'relative' }}>

        {/* ── STICKY HEADER ROW ── */}
        <div
          className="sticky top-0 z-20 flex bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700"
          style={{ height: HEADER_HEIGHT }}
        >
          {/* Corner — sticky left + top */}
          <div
            className="sticky left-0 z-30 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex items-center px-3 shrink-0"
            style={{ width: SIDEBAR_WIDTH, minWidth: SIDEBAR_WIDTH, height: HEADER_HEIGHT }}
          >
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500">Tasks</span>
          </div>

          {/* ── Hour view: time labels ── */}
          {viewMode === 'hour' && slots.map((slot, i) => {
            const isHourBoundary = (slot.startMinutes + slotDuration) % 60 === 0;
            return (
            <div
              key={slot.index}
              className={`relative shrink-0 border-r ${isHourBoundary ? 'border-slate-300 dark:border-slate-600' : 'border-slate-100 dark:border-slate-800'}`}
              style={{ width: slotWidth, height: HEADER_HEIGHT }}
            >
              {i % labelInterval === 0 && (
                <span
                  className="absolute left-1 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 whitespace-nowrap font-medium"
                  style={{ fontSize: slotDuration === 10 ? '10px' : '11px' }}
                >
                  {slot.label}
                </span>
              )}
            </div>
            );
          })}

          {/* ── Day view: day columns ── */}
          {viewMode === 'day' && allDays.map((day) => {
            const dayISO = format(day, 'yyyy-MM-dd');
            const wknd = isWeekend(day);
            const isToday = dayISO === todayISO;
            const isCurrent = dayISO === currentDate;
            const isFirst = day.getDate() === 1;
            const isJan1 = isFirst && day.getMonth() === 0;
            return (
              <div
                key={dayISO}
                className={`relative shrink-0 border-r flex flex-col items-center justify-center cursor-pointer select-none
                  ${wknd ? 'bg-slate-100 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700' : 'border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/40'}
                  ${isToday ? '!bg-blue-50 dark:!bg-blue-900/30' : ''}
                  ${isCurrent && !isToday ? 'ring-1 ring-inset ring-blue-300 dark:ring-blue-700' : ''}
                `}
                style={{ width: DAY_VIEW_COL_W, height: HEADER_HEIGHT }}
                onClick={() => { setCurrentDate(dayISO); setViewMode('hour'); }}
                title={format(day, 'EEEE, MMMM d, yyyy')}
              >
                {isJan1 && (
                  <span className="leading-none font-bold text-indigo-500 dark:text-indigo-400" style={{ fontSize: 8 }}>
                    {day.getFullYear()}
                  </span>
                )}
                {isFirst && !isJan1 && (
                  <span className="leading-none font-bold text-blue-400 dark:text-blue-500 uppercase" style={{ fontSize: 8 }}>
                    {format(day, 'MMM')}
                  </span>
                )}
                <span
                  className={`leading-none font-semibold ${isToday ? 'text-blue-600 dark:text-blue-400' : wknd ? 'text-slate-500 dark:text-slate-400' : 'text-slate-600 dark:text-slate-300'}`}
                  style={{ fontSize: 11 }}
                >
                  {format(day, 'd')}
                </span>
                <span className="leading-none text-slate-400 dark:text-slate-500" style={{ fontSize: 8 }}>
                  {format(day, 'EEEEE')}
                </span>
              </div>
            );
          })}

          {/* ── Week view: week columns ── */}
          {viewMode === 'week' && allWeeks.map((week) => {
            const weekISO = format(week, 'yyyy-MM-dd');
            const curWeekKey = format(startOfWeek(parseISO(currentDate), { weekStartsOn: 1 }), 'yyyy-MM-dd');
            const isCurWeek = weekISO === curWeekKey;
            const isNewYear = week.getMonth() === 0 && week.getDate() <= 7;
            return (
              <div
                key={weekISO}
                className={`relative shrink-0 border-r border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/40
                  ${isCurWeek ? '!bg-blue-50 dark:!bg-blue-900/30' : ''}
                `}
                style={{ width: WEEK_VIEW_COL_W, height: HEADER_HEIGHT }}
                onClick={() => { setCurrentDate(weekISO); setViewMode('day'); }}
                title={`Week of ${format(week, 'MMM d, yyyy')}`}
              >
                {isNewYear && (
                  <span className="leading-none font-bold text-indigo-500 dark:text-indigo-400" style={{ fontSize: 8 }}>
                    {week.getFullYear()}
                  </span>
                )}
                <span
                  className={`leading-none font-semibold ${isCurWeek ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300'}`}
                  style={{ fontSize: 10 }}
                >
                  {format(week, 'MMM d')}
                </span>
                <span className="leading-none text-slate-400 dark:text-slate-500" style={{ fontSize: 9 }}>
                  W{format(week, 'w')}
                </span>
              </div>
            );
          })}

          {/* ── Month view: month columns ── */}
          {viewMode === 'month' && allMonths.map((month) => {
            const monthKey = format(month, 'yyyy-MM');
            const curMonthKey = format(parseISO(currentDate), 'yyyy-MM');
            const isCurMonth = monthKey === curMonthKey;
            const isJan = month.getMonth() === 0;
            return (
              <div
                key={monthKey}
                className={`relative shrink-0 border-r border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/40
                  ${isCurMonth ? '!bg-blue-50 dark:!bg-blue-900/30' : ''}
                `}
                style={{ width: MONTH_VIEW_COL_W, height: HEADER_HEIGHT }}
                onClick={() => { setCurrentDate(format(month, 'yyyy-MM-dd')); setViewMode('week'); }}
                title={format(month, 'MMMM yyyy')}
              >
                {isJan && (
                  <span className="leading-none font-bold text-indigo-500 dark:text-indigo-400" style={{ fontSize: 9 }}>
                    {month.getFullYear()}
                  </span>
                )}
                <span
                  className={`leading-none font-semibold ${isCurMonth ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300'}`}
                  style={{ fontSize: 11 }}
                >
                  {format(month, 'MMM')}
                </span>
              </div>
            );
          })}
        </div>

        {/* ── TASK ROWS ── */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visibleTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            {visibleTasks.map((task) => {
              const taskLogs = viewMode === 'hour'
                ? logs.filter((l) => l.taskId === task.id && (l.startTime.startsWith(currentDate) || l.endTime.startsWith(currentDate)))
                : [];

              return (
                <SortableRow
                  key={task.id}
                  task={task}
                  depth={getDepth(task)}
                  hasChildren={hasChildren(task.id)}
                  onEdit={onEditTask}
                  onAddSubtask={onAddSubtask}
                >
                  {/* ── Hour view ── */}
                  {viewMode === 'hour' && (
                    <HourContent
                      task={task}
                      dayDate={dayDate}
                      dayISO={currentDate}
                      logs={taskLogs}
                      slots={slots}
                      slotWidth={slotWidth}
                      slotDuration={slotDuration}
                      getSelectionForCell={getSelectionForCell}
                      onSlotMouseDown={onSlotMouseDown}
                      onSlotMouseEnter={onSlotMouseEnter}
                      onLogClick={onEditLog}
                    />
                  )}

                  {/* ── Day view: one column per day ── */}
                  {viewMode === 'day' && (
                    <div className="flex shrink-0">
                      {allDays.map((day) => {
                        const dayISO = format(day, 'yyyy-MM-dd');
                        const wknd = isWeekend(day);
                        const isToday = dayISO === todayISO;
                        const mins = logTotals.byDay[task.id]?.[dayISO] || 0;
                        const fill = Math.min(mins / (8 * 60), 1);
                        return (
                          <div
                            key={dayISO}
                            className={`relative shrink-0 border-r border-b cursor-pointer
                              ${wknd
                                ? 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                                : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30'}
                              ${isToday ? '!bg-blue-50/60 dark:!bg-blue-900/20' : ''}
                            `}
                            style={{ width: DAY_VIEW_COL_W, height: ROW_HEIGHT }}
                            onClick={() => { setCurrentDate(dayISO); setViewMode('hour'); }}
                            title={`${task.title} · ${format(day, 'EEE, MMM d')}: ${Math.round(mins)}min`}
                          >
                            {mins > 0 && (
                              <div
                                className="absolute bottom-0.5 left-0.5 right-0.5 rounded-sm"
                                style={{
                                  height: Math.max(3, (ROW_HEIGHT - 6) * fill),
                                  backgroundColor: task.color,
                                  opacity: task.status === 'completed' ? 0.4 : 0.85,
                                }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* ── Week view: one column per week ── */}
                  {viewMode === 'week' && (
                    <div className="flex shrink-0">
                      {allWeeks.map((week) => {
                        const weekISO = format(week, 'yyyy-MM-dd');
                        const mins = logTotals.byWeek[task.id]?.[weekISO] || 0;
                        const fill = Math.min(mins / (5 * 8 * 60), 1);
                        return (
                          <div
                            key={weekISO}
                            className="relative shrink-0 border-r border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer"
                            style={{ width: WEEK_VIEW_COL_W, height: ROW_HEIGHT }}
                            onClick={() => { setCurrentDate(weekISO); setViewMode('day'); }}
                            title={`${task.title} · W${format(week, 'w')}: ${Math.round(mins / 60 * 10) / 10}h`}
                          >
                            {mins > 0 && (
                              <div
                                className="absolute bottom-0.5 left-0.5 right-0.5 rounded-sm"
                                style={{
                                  height: Math.max(3, (ROW_HEIGHT - 6) * fill),
                                  backgroundColor: task.color,
                                  opacity: task.status === 'completed' ? 0.4 : 0.85,
                                }}
                              />
                            )}
                            {mins > 60 && (
                              <span
                                className="absolute inset-0 flex items-end justify-center pb-1 pointer-events-none text-white font-medium"
                                style={{ fontSize: 9, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}
                              >
                                {Math.round(mins / 60)}h
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* ── Month view: one column per month ── */}
                  {viewMode === 'month' && (
                    <div className="flex shrink-0">
                      {allMonths.map((month) => {
                        const monthKey = format(month, 'yyyy-MM');
                        const mins = logTotals.byMonth[task.id]?.[monthKey] || 0;
                        const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
                        const fill = Math.min(mins / (daysInMonth * 8 * 60 * 0.7), 1);
                        return (
                          <div
                            key={monthKey}
                            className="relative shrink-0 border-r border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer"
                            style={{ width: MONTH_VIEW_COL_W, height: ROW_HEIGHT }}
                            onClick={() => { setCurrentDate(format(month, 'yyyy-MM-dd')); setViewMode('week'); }}
                            title={`${task.title} · ${format(month, 'MMM yyyy')}: ${Math.round(mins / 60 * 10) / 10}h`}
                          >
                            {mins > 0 && (
                              <div
                                className="absolute bottom-0.5 left-0.5 right-0.5 rounded-sm"
                                style={{
                                  height: Math.max(3, (ROW_HEIGHT - 6) * fill),
                                  backgroundColor: task.color,
                                  opacity: task.status === 'completed' ? 0.4 : 0.85,
                                }}
                              />
                            )}
                            {mins > 60 && (
                              <span
                                className="absolute inset-0 flex items-end justify-center pb-1 pointer-events-none text-white font-medium"
                                style={{ fontSize: 9, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}
                              >
                                {Math.round(mins / 60)}h
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </SortableRow>
              );
            })}
          </SortableContext>
        </DndContext>

        {/* Now line (hour view only) */}
        {viewMode === 'hour' && (
          <NowLine slotDuration={slotDuration} currentDate={currentDate} offsetLeft={SIDEBAR_WIDTH} />
        )}
      </div>
    </div>
  );
};

// ── Current time indicator ────────────────────────────────────────────────────

const NowLine: React.FC<{ slotDuration: SlotDuration; currentDate: string; offsetLeft: number }> = ({
  slotDuration, currentDate, offsetLeft,
}) => {
  const [, forceUpdate] = useState(0);
  React.useEffect(() => {
    const id = setInterval(() => forceUpdate((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const now = new Date();
  if (format(now, 'yyyy-MM-dd') !== currentDate) return null;

  const minutesFromMidnight = now.getHours() * 60 + now.getMinutes();
  const left = offsetLeft + (minutesFromMidnight / slotDuration) * getSlotWidth(slotDuration);

  return (
    <div className="absolute top-0 bottom-0 pointer-events-none z-20" style={{ left, width: 2 }}>
      <div className="w-0.5 h-full bg-red-400 opacity-60" />
      <div className="absolute top-0 -left-1 w-2.5 h-2.5 rounded-full bg-red-500 opacity-80" />
    </div>
  );
};
