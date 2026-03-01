import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { parseISO, areIntervalsOverlapping } from 'date-fns';
import { supabase } from '../lib/supabase';
import type { TimeLog } from '../types';

// ── DB row → App type ──────────────────────────────────────────────────────
function rowToLog(row: Record<string, unknown>): TimeLog {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    startTime: row.start_time as string,
    endTime: row.end_time as string,
    content: (row.content as string) ?? '',
  };
}

interface TimeLogState {
  logs: TimeLog[];
  loading: boolean;
  init: () => Promise<void>;
  addLog: (log: Omit<TimeLog, 'id'>) => TimeLog;
  updateLog: (id: string, updates: Partial<Omit<TimeLog, 'id'>>) => void;
  deleteLog: (id: string) => void;
  getLogsForTask: (taskId: string) => TimeLog[];
  getLogsForDay: (taskId: string, dayISO: string) => TimeLog[];
  findConflicts: (
    taskId: string,
    startTime: string,
    endTime: string,
    excludeId?: string
  ) => TimeLog[];
}

export const useTimeLogStore = create<TimeLogState>((set, get) => ({
  logs: [],
  loading: true,

  init: async () => {
    set({ loading: true });
    const { data } = await supabase
      .from('time_logs')
      .select('*')
      .order('start_time');
    set({ logs: (data ?? []).map(rowToLog), loading: false });
  },

  addLog: (log) => {
    const newLog: TimeLog = { ...log, id: uuidv4() };

    // Optimistic update
    set((s) => ({ logs: [...s.logs, newLog] }));

    // Sync to DB
    supabase.from('time_logs').insert({
      id: newLog.id,
      task_id: newLog.taskId,
      start_time: newLog.startTime,
      end_time: newLog.endTime,
      content: newLog.content,
    }).then(({ error }) => {
      if (error) {
        set((s) => ({ logs: s.logs.filter((l) => l.id !== newLog.id) }));
        console.error('addLog error:', error.message);
      }
    });

    return newLog;
  },

  updateLog: (id, updates) => {
    const prev = get().logs.find((l) => l.id === id);
    if (!prev) return;

    const updated = { ...prev, ...updates };

    // Optimistic update
    set((s) => ({ logs: s.logs.map((l) => (l.id === id ? updated : l)) }));

    // Build DB update object
    const dbUpdates: Record<string, unknown> = {};
    if (updates.taskId !== undefined) dbUpdates.task_id = updates.taskId;
    if (updates.startTime !== undefined) dbUpdates.start_time = updates.startTime;
    if (updates.endTime !== undefined) dbUpdates.end_time = updates.endTime;
    if (updates.content !== undefined) dbUpdates.content = updates.content;

    supabase.from('time_logs').update(dbUpdates).eq('id', id).then(({ error }) => {
      if (error) {
        set((s) => ({ logs: s.logs.map((l) => (l.id === id ? prev : l)) }));
        console.error('updateLog error:', error.message);
      }
    });
  },

  deleteLog: (id) => {
    const prev = get().logs.find((l) => l.id === id);

    // Optimistic update
    set((s) => ({ logs: s.logs.filter((l) => l.id !== id) }));

    supabase.from('time_logs').delete().eq('id', id).then(({ error }) => {
      if (error) {
        if (prev) set((s) => ({ logs: [...s.logs, prev] }));
        console.error('deleteLog error:', error.message);
      }
    });
  },

  getLogsForTask: (taskId) => {
    return get().logs.filter((l) => l.taskId === taskId);
  },

  getLogsForDay: (taskId, dayISO) => {
    return get().logs.filter((l) => {
      if (l.taskId !== taskId) return false;
      return l.startTime.startsWith(dayISO) || l.endTime.startsWith(dayISO);
    });
  },

  findConflicts: (taskId, startTime, endTime, excludeId) => {
    const newStart = parseISO(startTime);
    const newEnd = parseISO(endTime);
    return get().logs.filter((l) => {
      if (l.taskId !== taskId) return false;
      if (excludeId && l.id === excludeId) return false;
      return areIntervalsOverlapping(
        { start: newStart, end: newEnd },
        { start: parseISO(l.startTime), end: parseISO(l.endTime) }
      );
    });
  },
}));
