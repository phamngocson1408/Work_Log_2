import React, { useState, useEffect } from 'react';
import { format, parseISO, addMinutes } from 'date-fns';
import { useTimeLogStore } from '../../store/timeLogStore';
import { useTaskStore } from '../../store/taskStore';
import { useSettingsStore } from '../../store/settingsStore';
import { slotIndexToDate } from '../../utils/timeUtils';
import type { TimeLog } from '../../types';

export interface LogModalConfig {
  /** Editing an existing log */
  log?: TimeLog;
  /** Creating a new log from selection */
  taskId?: string;
  dayISO?: string;
  startSlot?: number;
  endSlot?: number;
}

interface LogModalProps {
  config: LogModalConfig | null;
  onClose: () => void;
}

export const LogModal: React.FC<LogModalProps> = ({ config, onClose }) => {
  const { addLog, updateLog, deleteLog, findConflicts } = useTimeLogStore();
  const { tasks } = useTaskStore();
  const { slotDuration } = useSettingsStore();

  const [content, setContent] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [taskId, setTaskId] = useState('');
  const [conflictAction, setConflictAction] = useState<'ask' | 'merge' | 'overwrite' | null>(null);
  const [conflicts, setConflicts] = useState<TimeLog[]>([]);

  const isEditing = !!config?.log;

  useEffect(() => {
    if (!config) return;

    if (config.log) {
      // Edit mode
      setContent(config.log.content);
      setStartTime(config.log.startTime.slice(0, 16));
      setEndTime(config.log.endTime.slice(0, 16));
      setTaskId(config.log.taskId);
    } else if (
      config.taskId &&
      config.dayISO &&
      config.startSlot !== undefined &&
      config.endSlot !== undefined
    ) {
      // Create mode from selection
      const day = parseISO(config.dayISO);
      const start = slotIndexToDate(day, config.startSlot, slotDuration);
      const end = addMinutes(
        slotIndexToDate(day, config.endSlot, slotDuration),
        slotDuration
      );
      setContent('');
      setStartTime(format(start, "yyyy-MM-dd'T'HH:mm"));
      setEndTime(format(end, "yyyy-MM-dd'T'HH:mm"));
      setTaskId(config.taskId);
    }

    setConflictAction(null);
    setConflicts([]);
  }, [config, slotDuration]);

  if (!config) return null;

  const selectedTask = tasks.find((t) => t.id === taskId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskId || !startTime || !endTime) return;

    // datetime-local value format: "yyyy-MM-ddTHH:mm"
    const startFull = `${startTime}:00`;
    const endFull = `${endTime}:00`;

    if (startFull >= endFull) {
      alert('End time must be after start time');
      return;
    }

    // Check conflicts (only for new logs, or when editing with changed times)
    const excludeId = config.log?.id;
    const found = findConflicts(taskId, startFull, endFull, excludeId);

    if (found.length > 0 && conflictAction === null) {
      setConflicts(found);
      setConflictAction('ask');
      return;
    }

    // Handle conflict resolution
    if (found.length > 0 && conflictAction === 'overwrite') {
      found.forEach((c) => deleteLog(c.id));
    }
    // merge: just save on top (logs can overlap — user chose to keep both)

    if (isEditing && config.log) {
      updateLog(config.log.id, {
        taskId,
        startTime: startFull,
        endTime: endFull,
        content,
      });
    } else {
      addLog({ taskId, startTime: startFull, endTime: endFull, content });
    }

    onClose();
  };

  const handleDelete = () => {
    if (!config.log) return;
    if (confirm('Delete this log entry?')) {
      deleteLog(config.log.id);
      onClose();
    }
  };

  const isConflictDialogue = conflictAction === 'ask';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            {selectedTask && (
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: selectedTask.color }}
              />
            )}
            <h2 className="font-semibold text-slate-800">
              {isEditing ? 'Edit Log Entry' : 'New Log Entry'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Conflict dialogue */}
        {isConflictDialogue ? (
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.732 0L3.068 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-800">Time overlap detected</p>
                <p className="text-xs text-amber-700 mt-1">
                  {conflicts.length} existing log(s) overlap with this time range.
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-600">How would you like to handle the conflict?</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { setConflictAction('merge'); }}
                className="w-full py-2.5 px-4 text-left rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-sm transition-colors"
              >
                <span className="font-medium text-slate-800">Keep both</span>
                <span className="block text-xs text-slate-500 mt-0.5">Save the new log alongside existing ones</span>
              </button>
              <button
                onClick={() => { setConflictAction('overwrite'); }}
                className="w-full py-2.5 px-4 text-left rounded-lg border border-red-200 hover:border-red-300 hover:bg-red-50 text-sm transition-colors"
              >
                <span className="font-medium text-red-700">Overwrite</span>
                <span className="block text-xs text-red-500 mt-0.5">Delete the overlapping log(s) and save the new one</span>
              </button>
              <button
                onClick={() => setConflictAction(null)}
                className="w-full py-2.5 px-4 text-left rounded-lg border border-slate-200 hover:bg-slate-50 text-sm text-slate-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* Normal form */
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Task selector (create mode only) */}
            {!isEditing && (
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
                  Task
                </label>
                <select
                  value={taskId}
                  onChange={(e) => setTaskId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  required
                >
                  <option value="">Select a task…</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.parentId ? '  └ ' : ''}{t.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Time range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
                  Start Time
                </label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
                  End Time
                </label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* Content */}
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
                Notes
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What did you work on?"
                rows={3}
                autoFocus={!isEditing}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              {isEditing && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-4 py-2.5 rounded-lg border border-red-200 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  Delete
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                {isEditing ? 'Save Changes' : 'Save Log'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
