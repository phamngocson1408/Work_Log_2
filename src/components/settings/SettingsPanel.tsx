import React from 'react';
import type { SlotDuration } from '../../types';
import { useSettingsStore } from '../../store/settingsStore';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const { slotDuration, setSlotDuration } = useSettingsStore();

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="absolute right-4 top-14 z-50 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-800">Settings</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
            Time Slot Duration
          </label>
          <div className="flex gap-2">
            {([10, 30] as SlotDuration[]).map((d) => (
              <button
                key={d}
                onClick={() => setSlotDuration(d)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                  slotDuration === d
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                {d} min
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {slotDuration === 30
              ? '48 slots/day – good for overview'
              : '144 slots/day – detailed tracking'}
          </p>
        </div>
      </div>
    </>
  );
};
