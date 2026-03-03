import React, { useState, useEffect, useRef } from 'react';
import { format, parseISO, isToday, isTomorrow, isPast, differenceInDays } from 'date-fns';
import { ColorPicker } from '../common/ColorPicker';
import { RichTextEditor } from '../common/RichTextEditor';
import { useTaskStore } from '../../store/taskStore';
import { useChecklistStore } from '../../store/checklistStore';
import type { Task } from '../../types';

function formatDeadline(iso: string): string {
  const d = parseISO(iso);
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  const diff = differenceInDays(d, new Date());
  if (diff > 0 && diff <= 6) return format(d, 'EEE');
  return format(d, 'MMM d');
}

function deadlineColorClass(iso: string): string {
  const d = parseISO(iso);
  if (isPast(d) && !isToday(d)) return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
  if (isToday(d)) return 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400';
  const diff = differenceInDays(d, new Date());
  if (diff <= 3) return 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-500';
  return 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400';
}

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
  const { addItem, toggleItem, updateItem, deleteItem } = useChecklistStore();
  const checklistItems = useChecklistStore((s) =>
    editTask
      ? s.items.filter((i) => i.taskId === editTask.id).sort((a, b) => a.orderIndex - b.orderIndex)
      : []
  );
  const [title, setTitle] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [status, setStatus] = useState<Task['status']>('not_started');
  const [note, setNote] = useState('');
  const [newItemText, setNewItemText] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemText, setEditingItemText] = useState('');
  const newItemInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editTask) {
      setTitle(editTask.title);
      setColor(editTask.color);
      setStatus(editTask.status);
      setNote(editTask.note ?? '');
    } else {
      setTitle('');
      setColor('#3B82F6');
      setStatus('not_started');
      setNote('');
    }
    setNewItemText('');
    setEditingItemId(null);
  }, [editTask, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (editTask) {
      updateTask(editTask.id, { title: title.trim(), color, status, note });
    } else {
      addTask(title.trim(), color, defaultParentId);
    }
    onClose();
  };

  const handleAddItem = () => {
    if (!newItemText.trim() || !editTask) return;
    addItem(editTask.id, newItemText.trim());
    setNewItemText('');
    newItemInputRef.current?.focus();
  };

  const handleNewItemKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddItem();
    }
  };

  const handleStartEdit = (id: string, text: string) => {
    setEditingItemId(id);
    setEditingItemText(text);
  };

  const handleFinishEdit = (id: string) => {
    if (editingItemText.trim()) {
      updateItem(id, { text: editingItemText.trim() });
    }
    setEditingItemId(null);
  };

  const isSubtask = defaultParentId != null || editTask?.parentId != null;
  const doneCount = checklistItems.filter((i) => i.done).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100">
            {editTask
              ? 'Edit Task'
              : isSubtask
              ? 'Add Subtask'
              : 'Add Task'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
              Task Name
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Design homepage"
              autoFocus
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
              Color
            </label>
            <ColorPicker value={color} onChange={setColor} />
          </div>

          {/* Status (only when editing) */}
          {editTask && (
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
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
                        : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                    }`}
                  >
                    {s === 'not_started' ? 'Not Started' : s === 'in_progress' ? 'In Progress' : 'Completed'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Checklist (only when editing) */}
          {editTask && (
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                Checklist
                {checklistItems.length > 0 && (
                  <span className="ml-1.5 text-slate-400 normal-case font-normal">
                    {doneCount}/{checklistItems.length}
                  </span>
                )}
              </label>

              {/* Checklist items */}
              {checklistItems.length > 0 && (
                <div className="space-y-1 mb-2">
                  {checklistItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-1.5 group/item">
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={() => toggleItem(item.id)}
                        className={`flex-shrink-0 w-4 h-4 rounded border transition-colors ${
                          item.done
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-slate-300 dark:border-slate-500 hover:border-blue-400'
                        }`}
                      >
                        {item.done && (
                          <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>

                      {/* Text */}
                      {editingItemId === item.id ? (
                        <input
                          autoFocus
                          type="text"
                          value={editingItemText}
                          onChange={(e) => setEditingItemText(e.target.value)}
                          onBlur={() => handleFinishEdit(item.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); handleFinishEdit(item.id); }
                            if (e.key === 'Escape') setEditingItemId(null);
                          }}
                          className="flex-1 text-sm px-1.5 py-0.5 rounded border border-blue-400 focus:outline-none bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                        />
                      ) : (
                        <span
                          onDoubleClick={() => handleStartEdit(item.id, item.text)}
                          className={`flex-1 text-sm cursor-default select-none min-w-0 truncate ${
                            item.done ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {item.text}
                        </span>
                      )}

                      {/* Deadline */}
                      {item.deadline ? (
                        <div className="flex-shrink-0 flex items-center gap-0.5">
                          {/* Badge + transparent date input overlay */}
                          <div className="relative" title={`Deadline: ${item.deadline} — click to change`}>
                            <span className={`block text-[10px] font-medium px-1 py-0.5 rounded leading-none ${deadlineColorClass(item.deadline)}`}>
                              {formatDeadline(item.deadline)}
                            </span>
                            <input
                              type="date"
                              value={item.deadline}
                              onChange={(e) => updateItem(item.id, { deadline: e.target.value || null })}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => updateItem(item.id, { deadline: null })}
                            className="text-slate-300 hover:text-red-500 transition-colors"
                            title="Remove deadline"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        /* Calendar icon + transparent date input overlay */
                        <div
                          className="flex-shrink-0 relative opacity-0 group-hover/item:opacity-50 hover:!opacity-100 text-slate-400 transition-opacity"
                          title="Set deadline"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <input
                            type="date"
                            value=""
                            onChange={(e) => { if (e.target.value) updateItem(item.id, { deadline: e.target.value }); }}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                        </div>
                      )}

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => deleteItem(item.id)}
                        className="flex-shrink-0 opacity-0 group-hover/item:opacity-100 text-slate-300 hover:text-red-500 transition-all"
                        title="Delete item"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new item input */}
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0 w-4 h-4 rounded border border-dashed border-slate-300 dark:border-slate-500" />
                <input
                  ref={newItemInputRef}
                  type="text"
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  onKeyDown={handleNewItemKeyDown}
                  placeholder="Add an item… (Enter to add)"
                  className="flex-1 text-sm px-1.5 py-0.5 rounded border border-transparent focus:border-blue-400 focus:outline-none bg-transparent placeholder-slate-400 dark:placeholder-slate-500 text-slate-700 dark:text-slate-300 focus:bg-white dark:focus:bg-slate-700 transition-colors"
                />
                {newItemText.trim() && (
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="flex-shrink-0 text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Add
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Note (only when editing) */}
          {editTask && (
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Note
              </label>
              <RichTextEditor
                value={note}
                onChange={setNote}
                placeholder="Add notes, links, or context…"
                minHeight={80}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
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
