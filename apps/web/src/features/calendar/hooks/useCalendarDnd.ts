/**
 * Custom hook for Calendar Drag and Drop
 * Handles event dragging, dropping, and updating with conflict validation
 */

import { useState } from 'react';
import { useUpdateCalendarEvent } from './useCalendarEvents';
import { UpdateMode } from '../types/calendar.types';
import type { CalendarEvent } from '../types/calendar.types';

interface DragState {
  event: CalendarEvent | null;
  originalStartAt: Date | null;
  originalEndAt: Date | null;
}

export function useCalendarDnd() {
  const [dragState, setDragState] = useState<DragState>({
    event: null,
    originalStartAt: null,
    originalEndAt: null,
  });
  const [showRecurrenceModal, setShowRecurrenceModal] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<{
    newStartAt: Date;
    newEndAt: Date;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateMutation = useUpdateCalendarEvent();

  /**
   * Start dragging an event
   */
  const handleDragStart = (event: CalendarEvent) => {
    setDragState({
      event,
      originalStartAt: new Date(event.startAt),
      originalEndAt: new Date(event.endAt),
    });
    setError(null);
  };

  /**
   * Calculate new dates when event is dropped
   */
  const calculateNewDates = (
    originalStart: Date,
    originalEnd: Date,
    dropDate: Date,
    dropHour?: number
  ): { newStartAt: Date; newEndAt: Date } => {
    const duration = originalEnd.getTime() - originalStart.getTime();

    let newStartAt: Date;

    if (dropHour !== undefined) {
      // Week/Day view - has specific hour
      newStartAt = new Date(dropDate);
      newStartAt.setHours(dropHour, originalStart.getMinutes(), 0, 0);
    } else {
      // Month view - keep same time, change date
      newStartAt = new Date(dropDate);
      newStartAt.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0);
    }

    const newEndAt = new Date(newStartAt.getTime() + duration);

    return { newStartAt, newEndAt };
  };

  /**
   * Handle event drop
   */
  const handleDrop = async (dropDate: Date, dropHour?: number) => {
    if (!dragState.event || !dragState.originalStartAt || !dragState.originalEndAt) {
      return;
    }

    const { newStartAt, newEndAt } = calculateNewDates(
      dragState.originalStartAt,
      dragState.originalEndAt,
      dropDate,
      dropHour
    );

    // Validate: não pode mover evento para o passado
    const now = new Date();
    if (newStartAt < now) {
      setError('Não é possível mover eventos para datas ou horários passados');
      setDragState({ event: null, originalStartAt: null, originalEndAt: null });
      return;
    }

    // Se é evento recorrente, perguntar ao usuário
    if (dragState.event.isRecurring) {
      setPendingUpdate({ newStartAt, newEndAt });
      setShowRecurrenceModal(true);
      return;
    }

    // Evento normal, atualizar diretamente
    await performUpdate(dragState.event.id, newStartAt, newEndAt);
  };

  /**
   * Perform the actual update
   */
  const performUpdate = async (
    eventId: string,
    newStartAt: Date,
    newEndAt: Date,
    updateMode?: UpdateMode
  ) => {
    try {
      await updateMutation.mutateAsync({
        id: eventId,
        data: {
          startAt: newStartAt,
          endAt: newEndAt,
        },
        updateMode,
      });

      // Success
      setDragState({ event: null, originalStartAt: null, originalEndAt: null });
      setPendingUpdate(null);
      setError(null);
    } catch (error: any) {
      console.error('Error updating event:', error);

      // Handle conflict error
      if (error?.response?.status === 400 && error?.response?.data?.message) {
        const errorMessage = error.response.data.message;
        if (errorMessage.includes('Conflito') || errorMessage.includes('conflito')) {
          setError(`⚠️ ${errorMessage}`);
        } else if (errorMessage.includes('passado')) {
          setError('⚠️ Não é possível mover eventos para datas ou horários passados');
        } else {
          setError(`⚠️ ${errorMessage}`);
        }
      } else {
        setError('⚠️ Erro ao mover evento. Tente novamente.');
      }

      // Rollback (evento volta para posição original)
      setDragState({ event: null, originalStartAt: null, originalEndAt: null });
    }
  };

  /**
   * Handle recurrence modal decision
   */
  const handleRecurrenceDecision = (decision: UpdateMode) => {
    if (!dragState.event || !pendingUpdate) return;

    performUpdate(
      dragState.event.id,
      pendingUpdate.newStartAt,
      pendingUpdate.newEndAt,
      decision
    );

    setShowRecurrenceModal(false);
  };

  /**
   * Cancel drag operation
   */
  const handleDragCancel = () => {
    setDragState({ event: null, originalStartAt: null, originalEndAt: null });
    setPendingUpdate(null);
    setShowRecurrenceModal(false);
    setError(null);
  };

  /**
   * Clear error
   */
  const clearError = () => {
    setError(null);
  };

  return {
    dragState,
    showRecurrenceModal,
    error,
    isLoading: updateMutation.isPending,
    handleDragStart,
    handleDrop,
    handleDragCancel,
    handleRecurrenceDecision,
    clearError,
  };
}
