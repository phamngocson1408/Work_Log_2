import React, { useState, useRef } from 'react';
import { parseISO } from 'date-fns';
import type { TimeLog, Task } from '../../types';
import { formatTime, durationLabel } from '../../utils/timeUtils';

interface TooltipState {
  x: number;
  y: number;
}

interface LogBlockProps {
  log: TimeLog;
  task: Task;
  left: number;
  width: number;
  rowHeight: number;
  onClick: (log: TimeLog) => void;
}

export const LogBlock: React.FC<LogBlockProps> = ({
  log,
  task,
  left,
  width,
  rowHeight,
  onClick,
}) => {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const blockRef = useRef<HTMLDivElement>(null);

  const isCompleted = task.status === 'completed';
  const startDate = parseISO(log.startTime);
  const endDate = parseISO(log.endTime);

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ x: rect.left + rect.width / 2, y: rect.top });
  };

  const handleMouseLeave = () => setTooltip(null);

  const minWidth = 4; // minimum visible width in px
  const visibleWidth = Math.max(width, minWidth);

  return (
    <>
      <div
        ref={blockRef}
        className="log-block absolute top-1 rounded cursor-pointer border border-white/30"
        style={{
          left,
          width: visibleWidth,
          height: rowHeight - 8,
          backgroundColor: task.color,
          opacity: isCompleted ? 0.4 : 0.85,
          overflow: 'hidden',
          boxSizing: 'border-box',
          zIndex: 5,
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick(log);
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Content label (only if wide enough) */}
        {width > 60 && (
          <div className="px-1.5 py-0.5 flex items-center h-full overflow-hidden">
            <span
              className="text-white text-xs font-medium truncate leading-tight"
              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
            >
              {log.content || `${formatTime(startDate)}–${formatTime(endDate)}`}
            </span>
          </div>
        )}
      </div>

      {/* Tooltip (portal-like absolute positioning using fixed) */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y - 8, transform: 'translate(-50%, -100%)' }}
        >
          <div className="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl max-w-[220px]">
            <div className="font-semibold mb-1 flex items-center gap-1.5">
              <span
                className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: task.color }}
              />
              {task.title}
            </div>
            <div className="text-slate-300 mb-1">
              {formatTime(startDate)} – {formatTime(endDate)}
              <span className="ml-2 text-slate-400">
                ({durationLabel(startDate, endDate)})
              </span>
            </div>
            {log.content && (
              <div className="text-slate-200 border-t border-slate-700 pt-1 mt-1 break-words">
                {log.content}
              </div>
            )}
            {/* Arrow */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-full w-0 h-0"
              style={{
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: '5px solid #0f172a',
              }}
            />
          </div>
        </div>
      )}
    </>
  );
};
