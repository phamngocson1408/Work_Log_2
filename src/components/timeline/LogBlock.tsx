import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { parseISO, addMinutes, format, areIntervalsOverlapping } from 'date-fns';
import type { TimeLog, Task } from '../../types';
import { formatTime, durationLabel, getSlotWidth } from '../../utils/timeUtils';
import { useTimeLogStore } from '../../store/timeLogStore';
import { useTaskStore } from '../../store/taskStore';
import { useSettingsStore } from '../../store/settingsStore';

interface TooltipState { x: number; y: number }

interface LogBlockProps {
  log: TimeLog;
  task: Task;
  left: number;
  width: number;
  rowHeight: number;
  onClick: (log: TimeLog) => void;
}

const HANDLE_W = 7;
const ISO_FMT = "yyyy-MM-dd'T'HH:mm";

export const LogBlock: React.FC<LogBlockProps> = ({
  log, task, left, width, rowHeight, onClick,
}) => {
  const { updateLog, logs } = useTimeLogStore();
  const { tasks } = useTaskStore();
  const { slotDuration } = useSettingsStore();
  const slotW = getSlotWidth(slotDuration);

  // ── Aggregate notes from overlapping subtask logs ──────────────────────────
  const subtaskNotes = useMemo(() => {
    const subtasks = tasks.filter((t) => t.parentId === task.id);
    if (subtasks.length === 0) return [];
    const subtaskIds = new Set(subtasks.map((t) => t.id));
    const logStart = parseISO(log.startTime);
    const logEnd = parseISO(log.endTime);
    return logs
      .filter((l) => {
        if (!subtaskIds.has(l.taskId) || !l.content) return false;
        return areIntervalsOverlapping(
          { start: logStart, end: logEnd },
          { start: parseISO(l.startTime), end: parseISO(l.endTime) }
        );
      })
      .map((l) => ({ subtask: tasks.find((t) => t.id === l.taskId)!, content: l.content }));
  }, [task.id, tasks, logs, log.startTime, log.endTime]);

  const blockRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [resizing, setResizing] = useState<{ edge: 'left' | 'right'; startX: number } | null>(null);
  const [previewLeft, setPreviewLeft] = useState<number | null>(null);
  const [previewWidth, setPreviewWidth] = useState<number | null>(null);
  const didDragRef = useRef(false);

  const isCompleted = task.status === 'completed';
  const startDate = parseISO(log.startTime);
  const endDate = parseISO(log.endTime);

  const displayLeft = previewLeft ?? left;
  const displayWidth = Math.max(previewWidth ?? width, HANDLE_W * 2 + 2);

  // ── Compute live time label while dragging ─────────────────────────────────
  const liveLabel = resizing
    ? (() => {
        const pStartMin = Math.round((displayLeft / slotW) * slotDuration);
        const pEndMin = Math.round(((displayLeft + displayWidth) / slotW) * slotDuration);
        const dur = pEndMin - pStartMin;
        const fmt = (m: number) =>
          `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
        const dh = Math.floor(dur / 60), dm = dur % 60;
        const durStr = dh > 0 ? (dm > 0 ? `${dh}h${dm}m` : `${dh}h`) : `${dm}m`;
        return `${fmt(pStartMin)}–${fmt(pEndMin)} (${durStr})`;
      })()
    : null;

  // ── Mouse move during resize ────────────────────────────────────────────────
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizing) return;
    const deltaSlots = Math.round((e.clientX - resizing.startX) / slotW);

    if (resizing.edge === 'right') {
      setPreviewWidth(Math.max(slotW, width + deltaSlots * slotW));
      setPreviewLeft(null);
    } else {
      const maxShift = Math.floor(width / slotW) - 1;
      const clamped = Math.min(deltaSlots, maxShift);
      setPreviewLeft(left + clamped * slotW);
      setPreviewWidth(width - clamped * slotW);
    }

    if (deltaSlots !== 0) didDragRef.current = true;
  }, [resizing, left, width, slotW]);

  // ── Mouse up — commit change ────────────────────────────────────────────────
  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (!resizing) return;
    const deltaSlots = Math.round((e.clientX - resizing.startX) / slotW);
    const deltaMinutes = deltaSlots * slotDuration;

    if (deltaSlots !== 0) {
      if (resizing.edge === 'right') {
        const raw = addMinutes(parseISO(log.endTime), deltaMinutes);
        const min = addMinutes(parseISO(log.startTime), slotDuration);
        updateLog(log.id, { endTime: format(raw < min ? min : raw, ISO_FMT) });
      } else {
        const raw = addMinutes(parseISO(log.startTime), deltaMinutes);
        const max = addMinutes(parseISO(log.endTime), -slotDuration);
        updateLog(log.id, { startTime: format(raw > max ? max : raw, ISO_FMT) });
      }
    }

    setResizing(null);
    setPreviewLeft(null);
    setPreviewWidth(null);
  }, [resizing, log, slotDuration, slotW, updateLog]);

  useEffect(() => {
    if (!resizing) return;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing, handleMouseMove, handleMouseUp]);

  const startResize = (edge: 'left' | 'right') => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    didDragRef.current = false;
    setTooltip(null);
    setResizing({ edge, startX: e.clientX });
  };

  // Tooltip anchor: use block's viewport rect
  const handleMouseEnter = (e: React.MouseEvent) => {
    if (resizing) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ x: rect.left + rect.width / 2, y: rect.top });
  };

  return (
    <>
      <div
        ref={blockRef}
        className="log-block absolute top-1 rounded group border border-white/30"
        style={{
          left: displayLeft,
          width: displayWidth,
          height: rowHeight - 8,
          backgroundColor: task.color,
          opacity: isCompleted ? 0.4 : 0.85,
          overflow: 'hidden',
          boxSizing: 'border-box',
          zIndex: resizing ? 20 : 5,
          cursor: resizing ? 'ew-resize' : 'pointer',
          userSelect: 'none',
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (didDragRef.current) { didDragRef.current = false; return; }
          onClick(log);
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => { if (!resizing) setTooltip(null); }}
      >
        {/* Left resize handle */}
        <div
          className="absolute left-0 top-0 bottom-0 z-10 flex items-center justify-start pl-px cursor-ew-resize"
          style={{ width: HANDLE_W }}
          onMouseDown={startResize('left')}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-3/4 w-0.5 rounded-full bg-white/0 group-hover:bg-white/60 transition-colors duration-100" />
        </div>

        {/* Content label */}
        {displayWidth > 64 && (
          <div
            className="flex items-center h-full overflow-hidden"
            style={{ paddingLeft: HANDLE_W + 4, paddingRight: HANDLE_W + 2 }}
          >
            <span
              className="text-white text-xs font-medium truncate leading-tight"
              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
            >
              {log.content
                ? log.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
                : `${formatTime(startDate)}–${formatTime(endDate)}`}
            </span>
          </div>
        )}

        {/* Right resize handle */}
        <div
          className="absolute right-0 top-0 bottom-0 z-10 flex items-center justify-end pr-px cursor-ew-resize"
          style={{ width: HANDLE_W }}
          onMouseDown={startResize('right')}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-3/4 w-0.5 rounded-full bg-white/0 group-hover:bg-white/60 transition-colors duration-100" />
        </div>
      </div>

      {/* Live time label while resizing — anchored to block via blockRef */}
      {resizing && liveLabel && (
        <LiveLabel blockRef={blockRef} label={liveLabel} />
      )}

      {/* Hover tooltip */}
      {tooltip && !resizing && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y - 8, transform: 'translate(-50%, -100%)' }}
        >
          <div className="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl max-w-[220px]">
            <div className="font-semibold mb-1 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: task.color }} />
              {task.title}
            </div>
            <div className="text-slate-300 mb-1">
              {formatTime(startDate)} – {formatTime(endDate)}
              <span className="ml-2 text-slate-400">({durationLabel(startDate, endDate)})</span>
            </div>
            {log.content && (
              <div
                className="rich-content text-slate-200 border-t border-slate-700 pt-1 mt-1 break-words"
                dangerouslySetInnerHTML={{ __html: log.content }}
              />
            )}
            {subtaskNotes.length > 0 && (
              <div className="border-t border-slate-700 pt-1.5 mt-1.5 space-y-1.5">
                <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">
                  Subtasks
                </div>
                {subtaskNotes.map(({ subtask, content }, i) => (
                  <div key={i}>
                    <div className="flex items-center gap-1 text-slate-300 font-medium mb-0.5">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: subtask.color }} />
                      <span className="text-[11px]">{subtask.title}</span>
                    </div>
                    <div
                      className="rich-content text-slate-300 pl-2.5 break-words"
                      dangerouslySetInnerHTML={{ __html: content }}
                    />
                  </div>
                ))}
              </div>
            )}
            <div
              className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-full w-0 h-0"
              style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #0f172a' }}
            />
          </div>
        </div>
      )}
    </>
  );
};

// ── Floating label showing live time while dragging ───────────────────────────
const LiveLabel: React.FC<{ blockRef: React.RefObject<HTMLDivElement>; label: string }> = ({
  blockRef, label,
}) => {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const update = () => {
      if (!blockRef.current) return;
      const r = blockRef.current.getBoundingClientRect();
      setPos({ x: r.left + r.width / 2, y: r.top });
    };
    update();
    window.addEventListener('mousemove', update);
    return () => window.removeEventListener('mousemove', update);
  }, [blockRef]);

  if (!pos) return null;
  return (
    <div
      className="fixed z-[100] pointer-events-none"
      style={{ left: pos.x, top: pos.y - 6, transform: 'translate(-50%, -100%)' }}
    >
      <div className="bg-slate-900/95 text-white text-xs font-semibold rounded-md px-2.5 py-1 shadow-xl whitespace-nowrap border border-slate-700">
        {label}
      </div>
    </div>
  );
};
