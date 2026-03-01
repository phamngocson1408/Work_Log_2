import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Task, TaskStatus } from '../types';

const STORAGE_KEY = 'wtl_tasks';

function loadFromStorage(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : defaultTasks();
  } catch {
    return defaultTasks();
  }
}

function saveToStorage(tasks: Task[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function defaultTasks(): Task[] {
  return [
    {
      id: uuidv4(),
      title: 'Sample Task',
      color: '#3B82F6',
      status: 'in_progress',
      parentId: null,
      orderIndex: 0,
      isExpanded: true,
    },
  ];
}

interface TaskState {
  tasks: Task[];
  addTask: (title: string, color: string, parentId?: string | null) => Task;
  updateTask: (id: string, updates: Partial<Omit<Task, 'id'>>) => void;
  deleteTask: (id: string) => void;
  reorderTasks: (orderedIds: string[]) => void;
  toggleExpanded: (id: string) => void;
  getChildren: (parentId: string | null) => Task[];
  getFlatList: () => Task[];
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: loadFromStorage(),

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
    };
    set((s) => {
      const updated = [...s.tasks, task];
      saveToStorage(updated);
      return { tasks: updated };
    });
    return task;
  },

  updateTask: (id, updates) => {
    set((s) => {
      const updated = s.tasks.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      );
      saveToStorage(updated);
      return { tasks: updated };
    });
  },

  deleteTask: (id) => {
    // Also delete all descendants
    const collectDescendants = (pid: string, allTasks: Task[]): string[] => {
      const children = allTasks.filter((t) => t.parentId === pid);
      return [
        pid,
        ...children.flatMap((c) => collectDescendants(c.id, allTasks)),
      ];
    };
    set((s) => {
      const toDelete = new Set(collectDescendants(id, s.tasks));
      const updated = s.tasks.filter((t) => !toDelete.has(t.id));
      saveToStorage(updated);
      return { tasks: updated };
    });
  },

  reorderTasks: (orderedIds) => {
    set((s) => {
      const idToIndex = new Map(orderedIds.map((id, i) => [id, i]));
      const updated = s.tasks.map((t) => ({
        ...t,
        orderIndex: idToIndex.has(t.id) ? idToIndex.get(t.id)! : t.orderIndex,
      }));
      saveToStorage(updated);
      return { tasks: updated };
    });
  },

  toggleExpanded: (id) => {
    set((s) => {
      const updated = s.tasks.map((t) =>
        t.id === id ? { ...t, isExpanded: !t.isExpanded } : t
      );
      saveToStorage(updated);
      return { tasks: updated };
    });
  },

  getChildren: (parentId) => {
    return get()
      .tasks.filter((t) => t.parentId === parentId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  },

  /** Flat list of visible tasks in display order (respecting expand/collapse) */
  getFlatList: () => {
    const { tasks } = get();

    const buildVisible = (parentId: string | null): Task[] => {
      const children = tasks
        .filter((t) => t.parentId === parentId)
        .sort((a, b) => a.orderIndex - b.orderIndex);

      const result: Task[] = [];
      for (const child of children) {
        result.push(child);
        if (child.isExpanded) {
          result.push(...buildVisible(child.id));
        }
      }
      return result;
    };

    return buildVisible(null);
  },
}));
