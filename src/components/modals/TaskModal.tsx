import React, { useState, useEffect } from 'react';
import { ColorPicker } from '../common/ColorPicker';
import { useTaskStore } from '../../store/taskStore';
import type { Task } from '../../types';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  editTask?: Task | null;
  defaultParentId?: string | null;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  editTask,
  defaultParentId,
}) => {
  const { addTask, updateTask } = useTaskStore();
  const [title, setTitle] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [status, setStatus] = useState<Task['status']>('not_started');

  useEffect(() => {
    if (editTask) {
      setTitle(editTask.title);
      setColor(editTask.color);
      setStatus(editTask.status);
    } else {
      setTitle('');
      setColor('#3B82F6');
      setStatus('not_started');
    }
  }, [editTask, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (editTask) {
      updateTask(editTask.id, { title: title.trim(), color, status });
    } else {
      addTask(title.trim(), color, defaultParentId);
    }
    onClose();
  };

  const isSubtask = defaultParentId != null || (editTask?.parentId != null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">
            {editTask
              ? 'Edit Task'
              : isSubtask
              ? 'Add Subtask'
              : 'Add Task'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
              Task Name
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Design homepage"
              autoFocus
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Color
            </label>
            <ColorPicker value={color} onChange={setColor} />
          </div>

          {/* Status (only when editing) */}
          {editTask && (
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                Status
              </label>
              <div className="flex gap-2">
                {(['not_started', 'in_progress', 'completed'] as Task['status'][]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium border transition-all ${
                      status === s
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {s === 'not_started' ? 'Not Started' : s === 'in_progress' ? 'In Progress' : 'Completed'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {editTask ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
