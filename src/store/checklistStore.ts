import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabase';
import type { ChecklistItem } from '../types';

function rowToItem(row: Record<string, unknown>): ChecklistItem {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    text: row.text as string,
    done: row.done as boolean,
    orderIndex: row.order_index as number,
    deadline: (row.deadline as string | null) ?? null,
  };
}

interface ChecklistState {
  items: ChecklistItem[];
  loading: boolean;
  init: () => Promise<void>;
  getItemsForTask: (taskId: string) => ChecklistItem[];
  addItem: (taskId: string, text: string, deadline?: string | null) => void;
  updateItem: (id: string, updates: Partial<Omit<ChecklistItem, 'id' | 'taskId'>>) => void;
  deleteItem: (id: string) => void;
  toggleItem: (id: string) => void;
}

export const useChecklistStore = create<ChecklistState>((set, get) => ({
  items: [],
  loading: true,

  init: async () => {
    set({ loading: true });
    const { data } = await supabase
      .from('task_checklist_items')
      .select('*')
      .order('order_index');
    set({ items: (data ?? []).map(rowToItem), loading: false });
  },

  getItemsForTask: (taskId) => {
    return get()
      .items.filter((i) => i.taskId === taskId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  },

  addItem: (taskId, text, deadline = null) => {
    const siblings = get().items.filter((i) => i.taskId === taskId);
    const maxIndex = siblings.reduce((m, i) => Math.max(m, i.orderIndex), -1);
    const item: ChecklistItem = {
      id: uuidv4(),
      taskId,
      text,
      done: false,
      orderIndex: maxIndex + 1,
      deadline,
    };

    set((s) => ({ items: [...s.items, item] }));

    supabase
      .from('task_checklist_items')
      .insert({
        id: item.id,
        task_id: item.taskId,
        text: item.text,
        done: item.done,
        order_index: item.orderIndex,
        deadline: item.deadline,
      })
      .then(({ error }) => {
        if (error) {
          set((s) => ({ items: s.items.filter((i) => i.id !== item.id) }));
          console.error('addItem error:', error.message);
        }
      });
  },

  updateItem: (id, updates) => {
    const prev = get().items.find((i) => i.id === id);
    if (!prev) return;

    const updated = { ...prev, ...updates };
    set((s) => ({ items: s.items.map((i) => (i.id === id ? updated : i)) }));

    const dbUpdates: Record<string, unknown> = {};
    if (updates.text !== undefined) dbUpdates.text = updates.text;
    if (updates.done !== undefined) dbUpdates.done = updates.done;
    if (updates.orderIndex !== undefined) dbUpdates.order_index = updates.orderIndex;
    if (updates.deadline !== undefined) dbUpdates.deadline = updates.deadline;

    supabase
      .from('task_checklist_items')
      .update(dbUpdates)
      .eq('id', id)
      .then(({ error }) => {
        if (error) {
          set((s) => ({ items: s.items.map((i) => (i.id === id ? prev : i)) }));
          console.error('updateItem error:', error.message);
        }
      });
  },

  deleteItem: (id) => {
    const prev = get().items.find((i) => i.id === id);
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));

    supabase
      .from('task_checklist_items')
      .delete()
      .eq('id', id)
      .then(({ error }) => {
        if (error) {
          if (prev) set((s) => ({ items: [...s.items, prev] }));
          console.error('deleteItem error:', error.message);
        }
      });
  },

  toggleItem: (id) => {
    const item = get().items.find((i) => i.id === id);
    if (!item) return;
    get().updateItem(id, { done: !item.done });
  },
}));
