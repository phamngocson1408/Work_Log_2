import React, { useState } from 'react';
import type { Task } from '../../types';
import { useTaskStore } from '../../store/taskStore';

const STATUS_LABELS: Record<Task['status'], string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
};

const STATUS_COLORS: Record<Task['status'], string> = {
  not_started: 'text-slate-400',
  in_progress: 'text-blue-500',
  completed: 'text-green-500',
};

interface TaskItemProps {
  task: Task;
  depth: number;
  hasChildren: boolean;
  onEdit: (task: Task) => void;
  onAddSubtask: (parentId: string) => void;
  dragHandleProps?: Record<string, unknown>;
}

export const TaskItem: React.FC<TaskItemProps> = ({
  task,
  depth,
  hasChildren,
  onEdit,
  onAddSubtask,
  dragHandleProps,
}) => {
  const { toggleExpanded, deleteTask, updateTask } = useTaskStore();
  const [showMenu, setShowMenu] = useState(false);

  const cycleStatus = () => {
    const statuses: Task['status'][] = ['not_started', 'in_progress', 'completed'];
    const currentIdx = statuses.indexOf(task.status);
    const next = statuses[(currentIdx + 1) % statuses.length];
    updateTask(task.id, { status: next });
  };

  const handleDelete = () => {
    if (confirm(`Delete "${task.title}" and all its subtasks?`)) {
      deleteTask(task.id);
    }
    setShowMenu(false);
  };

  return (
    <div
      className="flex items-center gap-1 h-10 group relative select-none"
      style={{ paddingLeft: depth * 16 + 4 }}
    >
      {/* Drag handle */}
      <button
        className="opacity-0 group-hover:opacity-40 hover:!opacity-70 cursor-grab text-slate-400 p-0.5 flex-shrink-0"
        {...dragHandleProps}
        title="Drag to reorder"
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-6 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-6 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
        </svg>
      </button>

      {/* Expand toggle */}
      {hasChildren ? (
        <button
          onClick={() => toggleExpanded(task.id)}
          className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-transform"
          style={{ transform: task.isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      ) : (
        <div className="flex-shrink-0 w-4" />
      )}

      {/* Color dot */}
      <div
        className="flex-shrink-0 w-2.5 h-2.5 rounded-full"
        style={{ backgroundColor: task.color }}
      />

      {/* Title */}
      <span
        className={`flex-1 text-sm truncate ${
          task.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-700'
        }`}
        title={task.title}
      >
        {task.title}
      </span>

      {/* Status badge */}
      <button
        onClick={cycleStatus}
        className={`flex-shrink-0 text-xs ${STATUS_COLORS[task.status]} opacity-0 group-hover:opacity-100 transition-opacity`}
        title={`Status: ${STATUS_LABELS[task.status]} (click to cycle)`}
      >
        <span className="sr-only">{STATUS_LABELS[task.status]}</span>
        {task.status === 'not_started' && (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth={2} />
          </svg>
        )}
        {task.status === 'in_progress' && (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" opacity=".3"/>
            <path d="M12 2v10l6 3A10 10 0 1 0 12 2z" />
          </svg>
        )}
        {task.status === 'completed' && (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </button>

      {/* More actions */}
      <div className="relative flex-shrink-0">
        <button
          onClick={() => setShowMenu((s) => !s)}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-5 z-20 bg-white rounded-lg shadow-lg border border-slate-200 py-1 w-40">
              <button
                onClick={() => { onEdit(task); setShowMenu(false); }}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              >
                Edit
              </button>
              <button
                onClick={() => { onAddSubtask(task.id); setShowMenu(false); }}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              >
                Add Subtask
              </button>
              <div className="h-px bg-slate-100 my-1" />
              <button
                onClick={handleDelete}
                className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
