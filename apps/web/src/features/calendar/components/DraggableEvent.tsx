/**
 * Draggable Event Component
 * Wraps calendar events to make them draggable
 */

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { CalendarEvent } from '../types/calendar.types';
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';

interface DraggableEventProps {
  event: CalendarEvent;
  children: ReactNode;
  onDragStart?: (event: CalendarEvent) => void;
}

export function DraggableEvent({ event, children, onDragStart }: DraggableEventProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: event.id,
    data: event,
  });

  const prevIsDragging = useRef(false);

  // Call onDragStart when dragging starts
  useEffect(() => {
    if (isDragging && !prevIsDragging.current && onDragStart) {
      onDragStart(event);
    }
    prevIsDragging.current = isDragging;
  }, [isDragging, event, onDragStart]);

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {children}
    </div>
  );
}
