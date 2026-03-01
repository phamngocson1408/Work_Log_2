import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabase';
import type { Task, TaskStatus } from '../types';

// ── DB row → App type ──────────────────────────────────────────────────────
function rowToTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    title: row.title as string,
    color: row.color as string,
    status: row.status as TaskStatus,
    parentId: (row.parent_id as string | null) ?? null,
    orderIndex: row.order_index as number,
    isExpanded: row.is_expanded as boolean,
    note: (row.note as string) ?? '',
  };
}

// ── App type → DB row ──────────────────────────────────────────────────────
function taskToRow(t: Task) {
  return {
    id: t.id,
    title: t.title,
    color: t.color,
    status: t.status,
    parent_id: t.parentId,
    order_index: t.orderIndex,
    is_expanded: t.isExpanded,
    note: t.note,
  };
}

interface TaskState {
  tasks: Task[];
  loading: boolean;
  init: () => Promise<void>;
  addTask: (title: string, color: string, parentId?: string | null) => Task;
  updateTask: (id: string, updates: Partial<Omit<Task, 'id'>>) => void;
  deleteTask: (id: string) => void;
  reorderTasks: (orderedIds: string[]) => void;
  toggleExpanded: (id: string) => void;
  getChildren: (parentId: string | null) => Task[];
  getFlatList: () => Task[];
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  loading: true,

  init: async () => {
    set({ loading: true });
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .order('order_index');
    set({ tasks: (data ?? []).map(rowToTask), loading: false });
  },

  addTask: (title, color, parentId = null) => {
    const siblings = get().tasks.filter((t) => t.parentId === parentId);
    const maxIndex = siblings.reduce((m, t) => Math.max(m, t.orderIndex), -1);
    const task: Task = {
      id: uuidv4(),
      title,
      color,
      status: 'not_started',
      parentId,
      orderIndex: maxIndex + 1,
      isExpanded: true,
      note: '',
    };

    // Optimistic update
    set((s) => ({ tasks: [...s.tasks, task] }));

    // Sync to DB
    supabase.from('tasks').insert(taskToRow(task)).then(({ error }) => {
      if (error) {
        // Rollback
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== task.id) }));
        console.error('addTask error:', error.message);
      }
    });

    return task;
  },

  updateTask: (id, updates) => {
    const prev = get().tasks.find((t) => t.id === id);
    if (!prev) return;

    const updated = { ...prev, ...updates };

    // Optimistic update
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? updated : t)) }));

    // Sync to DB
    const dbUpdates: Record<string, unknown> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.color !== undefined) dbUpdates.color = updates.color;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.parentId !== undefined) dbUpdates.parent_id = updates.parentId;
    if (updates.orderIndex !== undefined) dbUpdates.order_index = updates.orderIndex;
    if (updates.isExpanded !== undefined) dbUpdates.is_expanded = updates.isExpanded;
    if (updates.note !== undefined) dbUpdates.note = updates.note;

    supabase.from('tasks').update(dbUpdates).eq('id', id).then(({ error }) => {
      if (error) {
        // Rollback
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? prev : t)) }));
        console.error('updateTask error:', error.message);
      }
    });
  },

  deleteTask: (id) => {
    // Collect all descendant ids to remove from local state
    const allTasks = get().tasks;
    const collectDescendants = (pid: string): string[] => {
      const children = allTasks.filter((t) => t.parentId === pid);
      return [pid, ...children.flatMap((c) => collectDescendants(c.id))];
    };
    const toDelete = new Set(collectDescendants(id));

    // Optimistic update
    set((s) => ({ tasks: s.tasks.filter((t) => !toDelete.has(t.id)) }));

    // Sync to DB — CASCADE handles descendants + time_logs
    supabase.from('tasks').delete().eq('id', id).then(({ error }) => {
      if (error) {
        // Rollback: re-fetch to restore correct state
        get().init();
        console.error('deleteTask error:', error.message);
      }
    });
  },

  reorderTasks: (orderedIds) => {
    const idToIndex = new Map(orderedIds.map((id, i) => [id, i]));

    // Optimistic update
    set((s) => ({
      tasks: s.tasks.map((t) => ({
        ...t,
        orderIndex: idToIndex.has(t.id) ? idToIndex.get(t.id)! : t.orderIndex,
      })),
    }));

    // Sync to DB
    const rows = orderedIds.map((id, i) => ({ id, order_index: i }));
    supabase.from('tasks').upsert(rows, { onConflict: 'id' }).then(({ error }) => {
      if (error) {
        get().init(); // re-fetch on error
        console.error('reorderTasks error:', error.message);
      }
    });
  },

  toggleExpanded: (id) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;
    const newVal = !task.isExpanded;

    // Optimistic update
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, isExpanded: newVal } : t)),
    }));

    // Sync to DB
    supabase.from('tasks').update({ is_expanded: newVal }).eq('id', id).then(({ error }) => {
      if (error) {
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, isExpanded: !newVal } : t)),
        }));
        console.error('toggleExpanded error:', error.message);
      }
    });
  },

  getChildren: (parentId) => {
    return get()
      .tasks.filter((t) => t.parentId === parentId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  },

  getFlatList: () => {
    const { tasks } = get();
    const buildVisible = (parentId: string | null): Task[] => {
      const children = tasks
        .filter((t) => t.parentId === parentId)
        .sort((a, b) => a.orderIndex - b.orderIndex);
      const result: Task[] = [];
      for (const child of children) {
        result.push(child);
        if (child.isExpanded) result.push(...buildVisible(child.id));
      }
      return result;
    };
    return buildVisible(null);
  },
}));
