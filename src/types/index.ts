export type TaskStatus = 'not_started' | 'in_progress' | 'completed';
export type ViewMode = 'day' | 'week' | 'month';
export type SlotDuration = 10 | 30;

export interface Task {
  id: string;
  title: string;
  color: string;       // hex color
  status: TaskStatus;
  parentId: string | null;
  orderIndex: number;
  isExpanded: boolean;
  note: string;
}

export interface TimeLog {
  id: string;
  taskId: string;
  startTime: string;   // ISO 8601 datetime string
  endTime: string;     // ISO 8601 datetime string
  content: string;
}

export interface Settings {
  slotDuration: SlotDuration;
  viewMode: ViewMode;
  currentDate: string; // ISO date string YYYY-MM-DD
  darkMode: boolean;
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
