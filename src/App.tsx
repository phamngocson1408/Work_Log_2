import React, { useState, useCallback, useEffect } from 'react';
import { parseISO, addMinutes, format } from 'date-fns';
import { AppHeader } from './components/layout/AppHeader';
import { TimelineGrid } from './components/timeline/TimelineGrid';
import { TaskModal } from './components/modals/TaskModal';
import { LogModal, type LogModalConfig } from './components/modals/LogModal';
import { useSettingsStore } from './store/settingsStore';
import { useTaskStore } from './store/taskStore';
import { useTimeLogStore } from './store/timeLogStore';
import { slotIndexToDate } from './utils/timeUtils';
import type { Task, TimeLog } from './types';

export default function App() {
  const darkMode = useSettingsStore((s) => s.darkMode);
  const slotDuration = useSettingsStore((s) => s.slotDuration);
  const taskLoading = useTaskStore((s) => s.loading);
  const logLoading = useTimeLogStore((s) => s.loading);
  const initTasks = useTaskStore((s) => s.init);
  const initLogs = useTimeLogStore((s) => s.init);
  const addLog = useTimeLogStore((s) => s.addLog);

  // ── Load data from Supabase on mount ──────────────────────────────────────
  useEffect(() => {
    initTasks();
    initLogs();
  }, [initTasks, initLogs]);

  // ── Task modal state ──────────────────────────────────────────────────────
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newSubtaskParentId, setNewSubtaskParentId] = useState<string | null>(null);

  // ── Log modal state ───────────────────────────────────────────────────────
  const [logModalConfig, setLogModalConfig] = useState<LogModalConfig | null>(null);
  const [copiedLog, setCopiedLog] = useState<import('./types').TimeLog | null>(null);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleAddTask = () => {
    setEditingTask(null);
    setNewSubtaskParentId(null);
    setTaskModalOpen(true);
  };

  const handleEditTask = useCallback((task: Task) => {
    setEditingTask(task);
    setNewSubtaskParentId(null);
    setTaskModalOpen(true);
  }, []);

  const handleAddSubtask = useCallback((parentId: string) => {
    setEditingTask(null);
    setNewSubtaskParentId(parentId);
    setTaskModalOpen(true);
  }, []);

  const handleOpenLogModal = useCallback(
    (taskId: string, dayISO: string, startSlot: number, endSlot: number) => {
      setLogModalConfig({ taskId, dayISO, startSlot, endSlot });
    },
    []
  );

  const handleEditLog = useCallback((log: TimeLog) => {
    setLogModalConfig({ log });
  }, []);

  const handleCopyLog = useCallback((log: TimeLog) => {
    setCopiedLog(log);
  }, []);

  const handlePasteLog = useCallback(
    (taskId: string, dayISO: string, startSlot: number, endSlot: number) => {
      if (!copiedLog) return;
      const day = parseISO(dayISO);
      const startTime = format(slotIndexToDate(day, startSlot, slotDuration), "yyyy-MM-dd'T'HH:mm");
      const endTime = format(addMinutes(slotIndexToDate(day, endSlot, slotDuration), slotDuration), "yyyy-MM-dd'T'HH:mm");
      addLog({ taskId, startTime, endTime, content: copiedLog.content });
    },
    [copiedLog, slotDuration, addLog]
  );

  const handleCloseTaskModal = () => {
    setTaskModalOpen(false);
    setEditingTask(null);
    setNewSubtaskParentId(null);
  };

  const handleCloseLogModal = () => {
    setLogModalConfig(null);
  };

  // ── Loading screen ────────────────────────────────────────────────────────
  if (taskLoading || logLoading) {
    return (
      <div className={`h-screen flex items-center justify-center ${darkMode ? 'dark bg-slate-900' : 'bg-slate-50'}`}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-slate-500 dark:text-slate-400">Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${darkMode ? 'dark bg-slate-900' : 'bg-slate-50'}`}>
      <AppHeader onAddTask={handleAddTask} />

      <main className="flex-1 overflow-hidden flex flex-col">
        <TimelineGrid
          onOpenLogModal={handleOpenLogModal}
          onEditLog={handleEditLog}
          onEditTask={handleEditTask}
          onAddSubtask={handleAddSubtask}
          onCopyLog={handleCopyLog}
          copiedLog={copiedLog}
          onPasteLog={handlePasteLog}
        />
      </main>

      {/* Modals */}
      <TaskModal
        isOpen={taskModalOpen}
        onClose={handleCloseTaskModal}
        editTask={editingTask}
        defaultParentId={newSubtaskParentId}
      />

      <LogModal
        config={logModalConfig}
        onClose={handleCloseLogModal}
      />
    </div>
  );
}
