export type TaskStatus = 'not_started' | 'in_progress' | 'completed';
export type ViewMode = 'hour' | 'day' | 'week' | 'month';
export type SlotDuration = 10 | 30;

export interface Task {
  id: string;
  title: string;
  color: string;       // hex color
  status: TaskStatus;
  parentId: string | null;
  orderIndex: number;
  isExpanded: boolean;
  hidden: boolean;
  note: string;
}

export interface TimeLog {
  id: string;
  taskId: string;
  startTime: string;   // ISO 8601 datetime string
  endTime: string;     // ISO 8601 datetime string
  content: string;
  progress: number | null;  // 0-100, null = not set
}

export interface Settings {
  slotDuration: SlotDuration;
  viewMode: ViewMode;
  currentDate: string; // ISO date string YYYY-MM-DD
  darkMode: boolean;
  sidebarWidth: number;
}

// Derived/computed types used in rendering
export interface SlotInfo {
  index: number;
  startMinutes: number; // minutes from midnight
  label: string;        // e.g. "09:30"
}

export interface LogConflict {
  existingLog: TimeLog;
  action: 'merge' | 'overwrite' | 'cancel';
}

export interface ChecklistItem {
  id: string;
  taskId: string;
  text: string;
  done: boolean;
  orderIndex: number;
  deadline: string | null; // ISO date YYYY-MM-DD
}
