import {
  format,
  startOfDay,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  addMinutes,
  parseISO,
  isSameDay,
  differenceInMinutes,
} from 'date-fns';
import type { SlotDuration, SlotInfo } from '../types';

/** Total minutes in a day */
export const MINUTES_PER_DAY = 24 * 60;

/** Pixel width per time slot */
export const SLOT_WIDTH_30 = 36; // px for 30-min slots  → 1h = 72px
export const SLOT_WIDTH_10 = 18; // px for 10-min slots  → 1h = 108px

export function getSlotWidth(slotDuration: SlotDuration): number {
  return slotDuration === 30 ? SLOT_WIDTH_30 : SLOT_WIDTH_10;
}

/** Generate all time slots for a single day */
export function generateDaySlots(slotDuration: SlotDuration): SlotInfo[] {
  const totalSlots = MINUTES_PER_DAY / slotDuration;
  const slots: SlotInfo[] = [];
  for (let i = 0; i < totalSlots; i++) {
    const startMinutes = i * slotDuration;
    const h = Math.floor(startMinutes / 60);
    const m = startMinutes % 60;
    slots.push({
      index: i,
      startMinutes,
      label: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
    });
  }
  return slots;
}

/** Convert a slot index to a Date for a given day */
export function slotIndexToDate(
  dayDate: Date,
  slotIndex: number,
  slotDuration: SlotDuration
): Date {
  return addMinutes(startOfDay(dayDate), slotIndex * slotDuration);
}

/** Given a log and a day, compute left px offset and width px */
export function getLogBlockGeometry(
  logStart: Date,
  logEnd: Date,
  dayDate: Date,
  slotDuration: SlotDuration
): { left: number; width: number } | null {
  const dayStart = startOfDay(dayDate);
  const dayEnd = addMinutes(dayStart, MINUTES_PER_DAY);

  // Clamp to day bounds
  const clampedStart = logStart < dayStart ? dayStart : logStart;
  const clampedEnd = logEnd > dayEnd ? dayEnd : logEnd;

  if (clampedStart >= clampedEnd) return null;

  const minutesFromMidnight = differenceInMinutes(clampedStart, dayStart);
  const durationMinutes = differenceInMinutes(clampedEnd, clampedStart);

  const slotWidth = getSlotWidth(slotDuration);
  const left = (minutesFromMidnight / slotDuration) * slotWidth;
  const width = (durationMinutes / slotDuration) * slotWidth;

  return { left, width };
}

/** Total pixel width for one full day */
export function getDayTotalWidth(slotDuration: SlotDuration): number {
  const totalSlots = MINUTES_PER_DAY / slotDuration;
  return totalSlots * getSlotWidth(slotDuration);
}

/** Days in week view starting from Monday */
export function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Days in month view */
export function getMonthDays(date: Date): Date[] {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  const days: Date[] = [];
  let current = start;
  while (current <= end) {
    days.push(current);
    current = addDays(current, 1);
  }
  return days;
}

export function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function formatTime(date: Date): string {
  return format(date, 'HH:mm');
}

export function formatDisplayDate(date: Date): string {
  return format(date, 'EEE, MMM d');
}

export function formatMonthYear(date: Date): string {
  return format(date, 'MMMM yyyy');
}

export function parseISOSafe(s: string): Date {
  return parseISO(s);
}

export function isSameDayUtil(a: Date, b: Date): boolean {
  return isSameDay(a, b);
}

export function minutesToLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function durationLabel(start: Date, end: Date): string {
  const mins = differenceInMinutes(end, start);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
