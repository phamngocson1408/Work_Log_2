import React, { useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTaskStore } from '../../store/taskStore';
import { TaskItem } from './TaskItem';
import type { Task } from '../../types';

const SIDEBAR_WIDTH = 280;
const ROW_HEIGHT = 40;

interface SortableTaskRowProps {
  task: Task;
  depth: number;
  hasChildren: boolean;
  onEdit: (t: Task) => void;
  onAddSubtask: (pid: string) => void;
}

const SortableTaskRow: React.FC<SortableTaskRowProps> = ({
  task,
  depth,
  hasChildren,
  onEdit,
  onAddSubtask,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    height: ROW_HEIGHT,
    width: SIDEBAR_WIDTH,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TaskItem
        task={task}
        depth={depth}
        hasChildren={hasChildren}
        onEdit={onEdit}
        onAddSubtask={onAddSubtask}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
};

interface TaskSidebarProps {
  visibleTasks: Task[];
  onEdit: (task: Task) => void;
  onAddSubtask: (parentId: string) => void;
}

export const TaskSidebar: React.FC<TaskSidebarProps> = ({
  visibleTasks,
  onEdit,
  onAddSubtask,
}) => {
  const { tasks, reorderTasks } = useTaskStore();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const getDepth = useCallback(
    (task: Task): number => {
      let depth = 0;
      let current = task;
      while (current.parentId) {
        const parent = tasks.find((t) => t.id === current.parentId);
        if (!parent) break;
        depth++;
        current = parent;
      }
      return depth;
    },
    [tasks]
  );

  const hasChildren = useCallback(
    (taskId: string) => tasks.some((t) => t.parentId === taskId),
    [tasks]
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = visibleTasks.findIndex((t) => t.id === active.id);
    const newIndex = visibleTasks.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = [...visibleTasks];
    const [moved] = newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, moved);
    reorderTasks(newOrder.map((t) => t.id));
  };

  if (visibleTasks.length === 0) {
    return (
      <div
        style={{ width: SIDEBAR_WIDTH, minWidth: SIDEBAR_WIDTH }}
        className="flex items-center justify-center text-xs text-slate-400 italic p-4"
      >
        No tasks yet
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={visibleTasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div style={{ width: SIDEBAR_WIDTH, minWidth: SIDEBAR_WIDTH }}>
          {visibleTasks.map((task) => (
            <SortableTaskRow
              key={task.id}
              task={task}
              depth={getDepth(task)}
              hasChildren={hasChildren(task.id)}
              onEdit={onEdit}
              onAddSubtask={onAddSubtask}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};
