import React, { useCallback, useRef, useState } from 'react';
import { parseISO, format } from 'date-fns';
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
  getWeekDays,
  getMonthDays,
  getDayTotalWidth,
} from '../../utils/timeUtils';
import type { Task, TimeLog, SlotDuration } from '../../types';

const SIDEBAR_WIDTH = 280;
const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 40;

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

  const cycleStatus = (e: React.MouseEvent) => {
    e.stopPropagation();
    const statuses: Task['status'][] = ['not_started', 'in_progress', 'completed'];
    const idx = statuses.indexOf(task.status);
    updateTask(task.id, { status: statuses[(idx + 1) % 3] });
  };

  return (
    <div
      className="sticky left-0 z-10 bg-white border-r border-b border-slate-200 flex items-center gap-1 group shrink-0 select-none"
      style={{ width: SIDEBAR_WIDTH, minWidth: SIDEBAR_WIDTH, height: ROW_HEIGHT, paddingLeft: depth * 16 + 4 }}
    >
      {/* Drag handle */}
      <button
        className="opacity-0 group-hover:opacity-40 hover:!opacity-70 cursor-grab text-slate-400 p-0.5 shrink-0"
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
          className="shrink-0 w-4 h-4 flex items-center justify-center text-slate-400 hover:text-slate-600"
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

      {/* Title */}
      <span
        className={`flex-1 text-sm truncate ${task.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-700'}`}
        title={task.title}
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

      {/* Context menu */}
      <div className="relative shrink-0">
        <button
          onClick={() => setShowMenu((s) => !s)}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>
        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-5 z-50 bg-white rounded-lg shadow-lg border border-slate-200 py-1 w-40">
              <button onClick={() => { onEdit(task); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50">Edit</button>
              <button onClick={() => { onAddSubtask(task.id); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50">Add Subtask</button>
              <div className="h-px bg-slate-100 my-1" />
              <button onClick={() => { if (confirm(`Delete "${task.title}"?`)) deleteTask(task.id); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">Delete</button>
            </div>
          </>
        )}
      </div>
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
  children: React.ReactNode; // the timeline content cell
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

// ── Day view time content (the scrollable part) ───────────────────────────────

interface DayContentProps {
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

const DayContent: React.FC<DayContentProps> = ({
  task, dayDate, dayISO, logs, slots, slotWidth, slotDuration,
  getSelectionForCell, onSlotMouseDown, onSlotMouseEnter, onLogClick,
}) => {
  const totalWidth = slots.length * slotWidth;
  return (
    <div className="relative border-b border-slate-100 flex shrink-0" style={{ width: totalWidth, height: ROW_HEIGHT }}>
      {slots.map((slot) => {
        const isHour = slot.startMinutes % 60 === 0;
        const isSelected = getSelectionForCell(task.id, dayISO, slot.index);
        return (
          <div
            key={slot.index}
            className={`shrink-0 border-r h-full cursor-crosshair ${
              isHour ? 'border-slate-200' : 'border-slate-100'
            } ${isSelected ? 'bg-blue-100' : 'hover:bg-slate-50'}`}
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

// ── Week/Month summary content ────────────────────────────────────────────────

interface SummaryContentProps {
  task: Task;
  days: Date[];
  dayWidth: number;
  onDayClick: (taskId: string, dayISO: string) => void;
}

const SummaryContent: React.FC<SummaryContentProps> = ({ task, days, dayWidth, onDayClick }) => {
  const logs = useTimeLogStore((s) => s.logs);
  return (
    <>
      {days.map((day) => {
        const dayISO = format(day, 'yyyy-MM-dd');
        const dayLogs = logs.filter(
          (l) => l.taskId === task.id && (l.startTime.startsWith(dayISO) || l.endTime.startsWith(dayISO))
        );
        const totalMinutes = dayLogs.reduce((acc, l) => {
          const diff = (new Date(l.endTime).getTime() - new Date(l.startTime).getTime()) / 60000;
          return acc + diff;
        }, 0);
        const barFill = Math.min(totalMinutes / (8 * 60), 1);
        return (
          <div
            key={dayISO}
            className="relative shrink-0 border-r border-b border-slate-200 cursor-pointer hover:bg-slate-50"
            style={{ width: dayWidth, height: ROW_HEIGHT }}
            onClick={() => onDayClick(task.id, dayISO)}
            title={`${task.title} · ${dayISO}: ${Math.round(totalMinutes)}min`}
          >
            {totalMinutes > 0 && (
              <div
                className="absolute bottom-1 left-1 right-1 rounded"
                style={{
                  height: Math.max(4, (ROW_HEIGHT - 8) * barFill),
                  backgroundColor: task.color,
                  opacity: task.status === 'completed' ? 0.4 : 0.75,
                }}
              />
            )}
            {totalMinutes > 30 && (
              <span className="absolute inset-0 flex items-center justify-center text-white font-medium pointer-events-none"
                style={{ fontSize: 10, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                {Math.round(totalMinutes / 60)}h
              </span>
            )}
          </div>
        );
      })}
    </>
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
  const { slotDuration, viewMode, currentDate, setCurrentDate, setViewMode } = useSettingsStore();
  const logs = useTimeLogStore((s) => s.logs);

  const scrollRef = useRef<HTMLDivElement>(null);
  const visibleTasks = getFlatList();

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

  // ── Selection ─────────────────────────────────────────────────────────────
  const handleSelectionComplete = useCallback(
    (range: SelectionRange) => onOpenLogModal(range.taskId, range.dayISO, range.startSlot, range.endSlot),
    [onOpenLogModal]
  );
  const { isSelecting, onSlotMouseDown, onSlotMouseEnter, getSelectionForCell } =
    useTimelineSelection(handleSelectionComplete);

  // ── Day view data ─────────────────────────────────────────────────────────
  const slots = generateDaySlots(slotDuration);
  const slotWidth = getSlotWidth(slotDuration);
  const dayDate = parseISO(currentDate);
  const dayTotalWidth = getDayTotalWidth(slotDuration);
  const labelInterval = slotDuration === 30 ? 2 : 3;

  // ── Auto-scroll: current time if viewing today, else 08:00 ──────────────
  React.useEffect(() => {
    if (viewMode !== 'day' || !scrollRef.current) return;
    const now = new Date();
    const todayISO = format(now, 'yyyy-MM-dd');
    const anchorMinutes =
      currentDate === todayISO
        ? Math.max(0, now.getHours() * 60 + now.getMinutes() - 60) // 1h trước giờ hiện tại
        : 8 * 60; // ngày khác thì về 08:00
    scrollRef.current.scrollLeft = (anchorMinutes / slotDuration) * slotWidth;
  }, [viewMode, currentDate, slotDuration, slotWidth]);

  // ── Week/Month data ───────────────────────────────────────────────────────
  const weekDays = getWeekDays(dayDate);
  const monthDays = getMonthDays(dayDate);
  const summaryDays = viewMode === 'week' ? weekDays : monthDays;
  const DAY_COL_WIDTH = viewMode === 'week' ? Math.max(80, Math.floor(800 / 7)) : Math.max(36, Math.floor(800 / monthDays.length));

  const handleDayClick = (taskId: string, dayISO: string) => {
    setCurrentDate(dayISO);
    setViewMode('day');
  };

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
  const contentWidth = viewMode === 'day'
    ? SIDEBAR_WIDTH + dayTotalWidth
    : SIDEBAR_WIDTH + summaryDays.length * DAY_COL_WIDTH;

  // ── Empty state ───────────────────────────────────────────────────────────
  if (visibleTasks.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
        <svg className="w-12 h-12 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      className={`flex-1 overflow-auto no-select`}
      style={{ cursor: isSelecting ? 'crosshair' : undefined }}
    >
      {/* ── Inner container: full content width ── */}
      <div style={{ width: contentWidth, minWidth: contentWidth, position: 'relative' }}>

        {/* ── STICKY HEADER ROW ── */}
        <div
          className="sticky top-0 z-20 flex bg-slate-50 border-b border-slate-200"
          style={{ height: HEADER_HEIGHT }}
        >
          {/* Corner — sticky left + top */}
          <div
            className="sticky left-0 z-30 bg-slate-50 border-r border-slate-200 flex items-center px-3 shrink-0"
            style={{ width: SIDEBAR_WIDTH, minWidth: SIDEBAR_WIDTH, height: HEADER_HEIGHT }}
          >
            <span className="text-xs font-medium text-slate-400">Tasks</span>
          </div>

          {/* Time labels (day view) */}
          {viewMode === 'day' ? (
            slots.map((slot, i) => (
              <div
                key={slot.index}
                className="relative shrink-0 border-r border-slate-100"
                style={{ width: slotWidth, height: HEADER_HEIGHT }}
              >
                {i % labelInterval === 0 && (
                  <span
                    className="absolute left-1 top-1/2 -translate-y-1/2 text-slate-400 whitespace-nowrap font-medium"
                    style={{ fontSize: slotDuration === 10 ? '10px' : '11px' }}
                  >
                    {slot.label}
                  </span>
                )}
              </div>
            ))
          ) : (
            /* Day labels (week/month view) */
            summaryDays.map((d) => (
              <div
                key={format(d, 'yyyy-MM-dd')}
                className="shrink-0 border-r border-slate-200 flex flex-col items-center justify-center"
                style={{ width: DAY_COL_WIDTH, height: HEADER_HEIGHT }}
              >
                <span className="text-xs font-semibold text-slate-700">
                  {viewMode === 'week' ? format(d, 'EEE d') : format(d, 'd')}
                </span>
                {viewMode === 'week' && (
                  <span className="text-xs text-slate-400">{format(d, 'MMM')}</span>
                )}
              </div>
            ))
          )}
        </div>

        {/* ── TASK ROWS ── */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visibleTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            {visibleTasks.map((task) => {
              const taskLogs = logs.filter(
                (l) =>
                  l.taskId === task.id &&
                  (l.startTime.startsWith(currentDate) || l.endTime.startsWith(currentDate))
              );
              return (
                <SortableRow
                  key={task.id}
                  task={task}
                  depth={getDepth(task)}
                  hasChildren={hasChildren(task.id)}
                  onEdit={onEditTask}
                  onAddSubtask={onAddSubtask}
                >
                  {viewMode === 'day' ? (
                    <DayContent
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
                  ) : (
                    <SummaryContent
                      task={task}
                      days={summaryDays}
                      dayWidth={DAY_COL_WIDTH}
                      onDayClick={handleDayClick}
                    />
                  )}
                </SortableRow>
              );
            })}
          </SortableContext>
        </DndContext>

        {/* Now line (day view only) */}
        {viewMode === 'day' && (
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
