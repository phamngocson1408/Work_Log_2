import React from 'react';
import type { SlotInfo, SlotDuration } from '../../types';
import { getSlotWidth } from '../../utils/timeUtils';

const SIDEBAR_WIDTH = 280;
const HEADER_HEIGHT = 40;

interface TimelineHeaderProps {
  slots: SlotInfo[];
  slotDuration: SlotDuration;
  /** For week/month: show date labels instead */
  dayLabels?: { label: string; subLabel?: string; width: number; iso: string }[];
}

export const TimelineHeader: React.FC<TimelineHeaderProps> = ({
  slots,
  slotDuration,
  dayLabels,
}) => {
  const slotWidth = getSlotWidth(slotDuration);

  // Show every hour mark for 30-min slots, every 30-min for 10-min slots
  const labelInterval = slotDuration === 30 ? 2 : 3; // every N slots

  return (
    <div
      className="time-header-row flex border-b border-slate-200 bg-slate-50 shrink-0"
      style={{ height: HEADER_HEIGHT }}
    >
      {/* Corner cell */}
      <div
        className="time-header-corner flex items-center px-3 border-r border-slate-200 shrink-0"
        style={{ width: SIDEBAR_WIDTH, minWidth: SIDEBAR_WIDTH, height: HEADER_HEIGHT }}
      >
        <span className="text-xs font-medium text-slate-400">Tasks</span>
      </div>

      {/* Day labels (week/month view) */}
      {dayLabels ? (
        <div className="flex">
          {dayLabels.map((day) => (
            <div
              key={day.iso}
              className="flex flex-col items-center justify-center border-r border-slate-200 shrink-0"
              style={{ width: day.width, height: HEADER_HEIGHT }}
            >
              <span className="text-xs font-semibold text-slate-700">{day.label}</span>
              {day.subLabel && (
                <span className="text-xs text-slate-400">{day.subLabel}</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Time slot labels (day view) */
        <div className="flex relative" style={{ height: HEADER_HEIGHT }}>
          {slots.map((slot, i) => {
            const showLabel = i % labelInterval === 0;
            return (
              <div
                key={slot.index}
                className="relative shrink-0 border-r border-slate-100"
                style={{ width: slotWidth, height: HEADER_HEIGHT }}
              >
                {showLabel && (
                  <span
                    className="absolute left-1 top-1/2 -translate-y-1/2 text-xs text-slate-400 whitespace-nowrap font-medium"
                    style={{ fontSize: slotDuration === 10 ? '10px' : '11px' }}
                  >
                    {slot.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
