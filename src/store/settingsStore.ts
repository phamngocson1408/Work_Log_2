import { create } from 'zustand';
import { format } from 'date-fns';
import type { Settings, SlotDuration, ViewMode } from '../types';

const STORAGE_KEY = 'wtl_settings';

function loadFromStorage(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw
      ? JSON.parse(raw)
      : {
          slotDuration: 30,
          viewMode: 'day',
          currentDate: format(new Date(), 'yyyy-MM-dd'),
        };
  } catch {
    return {
      slotDuration: 30,
      viewMode: 'day',
      currentDate: format(new Date(), 'yyyy-MM-dd'),
    };
  }
}

function saveToStorage(settings: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

interface SettingsState extends Settings {
  setSlotDuration: (d: SlotDuration) => void;
  setViewMode: (m: ViewMode) => void;
  setCurrentDate: (date: string) => void;
  goToToday: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  ...loadFromStorage(),

  setSlotDuration: (slotDuration) => {
    set((s) => {
      const updated = { ...s, slotDuration };
      saveToStorage({ slotDuration, viewMode: s.viewMode, currentDate: s.currentDate });
      return updated;
    });
  },

  setViewMode: (viewMode) => {
    set((s) => {
      const updated = { ...s, viewMode };
      saveToStorage({ slotDuration: s.slotDuration, viewMode, currentDate: s.currentDate });
      return updated;
    });
  },

  setCurrentDate: (currentDate) => {
    set((s) => {
      saveToStorage({ slotDuration: s.slotDuration, viewMode: s.viewMode, currentDate });
      return { ...s, currentDate };
    });
  },

  goToToday: () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    set((s) => {
      saveToStorage({ slotDuration: s.slotDuration, viewMode: s.viewMode, currentDate: today });
      return { ...s, currentDate: today };
    });
  },
}));
