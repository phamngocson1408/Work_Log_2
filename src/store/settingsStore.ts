import { create } from 'zustand';
import { format } from 'date-fns';
import type { Settings, SlotDuration, ViewMode } from '../types';

const STORAGE_KEY = 'wtl_settings';

const DEFAULTS: Settings = {
  slotDuration: 30,
  viewMode: 'day',
  currentDate: format(new Date(), 'yyyy-MM-dd'),
  darkMode: false,
};

function loadFromStorage(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) }; // migrate old data
  } catch {
    return { ...DEFAULTS };
  }
}

function saveToStorage(s: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

interface SettingsState extends Settings {
  setSlotDuration: (d: SlotDuration) => void;
  setViewMode: (m: ViewMode) => void;
  setCurrentDate: (date: string) => void;
  goToToday: () => void;
  toggleDarkMode: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  ...loadFromStorage(),

  setSlotDuration: (slotDuration) =>
    set((s) => { const n = { ...s, slotDuration }; saveToStorage(n); return n; }),

  setViewMode: (viewMode) =>
    set((s) => { const n = { ...s, viewMode }; saveToStorage(n); return n; }),

  setCurrentDate: (currentDate) =>
    set((s) => { const n = { ...s, currentDate }; saveToStorage(n); return n; }),

  goToToday: () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    set((s) => { const n = { ...s, currentDate: today }; saveToStorage(n); return n; });
  },

  toggleDarkMode: () =>
    set((s) => { const n = { ...s, darkMode: !s.darkMode }; saveToStorage(n); return n; }),
}));
