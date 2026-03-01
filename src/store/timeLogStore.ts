import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { parseISO, areIntervalsOverlapping } from 'date-fns';
import type { TimeLog } from '../types';

const STORAGE_KEY = 'wtl_logs';

function loadFromStorage(): TimeLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage(logs: TimeLog[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
}

interface TimeLogState {
  logs: TimeLog[];
  addLog: (log: Omit<TimeLog, 'id'>) => TimeLog;
  updateLog: (id: string, updates: Partial<Omit<TimeLog, 'id'>>) => void;
  deleteLog: (id: string) => void;
  deleteLogsForTask: (taskId: string) => void;
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
  logs: loadFromStorage(),

  addLog: (log) => {
    const newLog: TimeLog = { ...log, id: uuidv4() };
    set((s) => {
      const updated = [...s.logs, newLog];
      saveToStorage(updated);
      return { logs: updated };
    });
    return newLog;
  },

  updateLog: (id, updates) => {
    set((s) => {
      const updated = s.logs.map((l) =>
        l.id === id ? { ...l, ...updates } : l
      );
      saveToStorage(updated);
      return { logs: updated };
    });
  },

  deleteLog: (id) => {
    set((s) => {
      const updated = s.logs.filter((l) => l.id !== id);
      saveToStorage(updated);
      return { logs: updated };
    });
  },

  deleteLogsForTask: (taskId) => {
    set((s) => {
      const updated = s.logs.filter((l) => l.taskId !== taskId);
      saveToStorage(updated);
      return { logs: updated };
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
      const lStart = parseISO(l.startTime);
      const lEnd = parseISO(l.endTime);
      return areIntervalsOverlapping(
        { start: newStart, end: newEnd },
        { start: lStart, end: lEnd }
      );
    });
  },
}));
