import { useState, useCallback, useEffect } from 'react';

export interface SelectionRange {
  taskId: string;
  dayISO: string;
  startSlot: number;
  endSlot: number;
}

interface UseTimelineSelectionReturn {
  selection: SelectionRange | null;
  isSelecting: boolean;
  onSlotMouseDown: (taskId: string, dayISO: string, slotIndex: number) => void;
  onSlotMouseEnter: (taskId: string, dayISO: string, slotIndex: number) => void;
  clearSelection: () => void;
  getSelectionForCell: (
    taskId: string,
    dayISO: string,
    slotIndex: number
  ) => boolean;
}

export function useTimelineSelection(
  onSelectionComplete: (range: SelectionRange) => void
): UseTimelineSelectionReturn {
  const [isSelecting, setIsSelecting] = useState(false);
  const [anchorTaskId, setAnchorTaskId] = useState<string | null>(null);
  const [anchorDay, setAnchorDay] = useState<string | null>(null);
  const [anchorSlot, setAnchorSlot] = useState<number | null>(null);
  const [currentSlot, setCurrentSlot] = useState<number | null>(null);

  const clearSelection = useCallback(() => {
    setIsSelecting(false);
    setAnchorTaskId(null);
    setAnchorDay(null);
    setAnchorSlot(null);
    setCurrentSlot(null);
  }, []);

  const onSlotMouseDown = useCallback(
    (taskId: string, dayISO: string, slotIndex: number) => {
      setIsSelecting(true);
      setAnchorTaskId(taskId);
      setAnchorDay(dayISO);
      setAnchorSlot(slotIndex);
      setCurrentSlot(slotIndex);
    },
    []
  );

  const onSlotMouseEnter = useCallback(
    (taskId: string, dayISO: string, slotIndex: number) => {
      if (!isSelecting) return;
      // Only extend within same task + day
      if (taskId !== anchorTaskId || dayISO !== anchorDay) return;
      setCurrentSlot(slotIndex);
    },
    [isSelecting, anchorTaskId, anchorDay]
  );

  const selection: SelectionRange | null =
    isSelecting &&
    anchorTaskId !== null &&
    anchorDay !== null &&
    anchorSlot !== null &&
    currentSlot !== null
      ? {
          taskId: anchorTaskId,
          dayISO: anchorDay,
          startSlot: Math.min(anchorSlot, currentSlot),
          endSlot: Math.max(anchorSlot, currentSlot),
        }
      : null;

  // Global mouseup to finalize selection
  useEffect(() => {
    const handleMouseUp = () => {
      if (isSelecting && selection) {
        onSelectionComplete(selection);
      }
      clearSelection();
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [isSelecting, selection, onSelectionComplete, clearSelection]);

  const getSelectionForCell = useCallback(
    (taskId: string, dayISO: string, slotIndex: number): boolean => {
      if (!selection) return false;
      return (
        selection.taskId === taskId &&
        selection.dayISO === dayISO &&
        slotIndex >= selection.startSlot &&
        slotIndex <= selection.endSlot
      );
    },
    [selection]
  );

  return {
    selection,
    isSelecting,
    onSlotMouseDown,
    onSlotMouseEnter,
    clearSelection,
    getSelectionForCell,
  };
}
