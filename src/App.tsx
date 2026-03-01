import React, { useState, useCallback } from 'react';
import { AppHeader } from './components/layout/AppHeader';
import { TimelineGrid } from './components/timeline/TimelineGrid';
import { TaskModal } from './components/modals/TaskModal';
import { LogModal, type LogModalConfig } from './components/modals/LogModal';
import type { Task, TimeLog } from './types';

export default function App() {
  // ── Task modal state ──────────────────────────────────────────────────────
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newSubtaskParentId, setNewSubtaskParentId] = useState<string | null>(null);

  // ── Log modal state ───────────────────────────────────────────────────────
  const [logModalConfig, setLogModalConfig] = useState<LogModalConfig | null>(null);

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

  const handleCloseTaskModal = () => {
    setTaskModalOpen(false);
    setEditingTask(null);
    setNewSubtaskParentId(null);
  };

  const handleCloseLogModal = () => {
    setLogModalConfig(null);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden">
      <AppHeader onAddTask={handleAddTask} />

      <main className="flex-1 overflow-hidden flex flex-col">
        <TimelineGrid
          onOpenLogModal={handleOpenLogModal}
          onEditLog={handleEditLog}
          onEditTask={handleEditTask}
          onAddSubtask={handleAddSubtask}
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
