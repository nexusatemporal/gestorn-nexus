/**
 * Calendar View Component
 * Main calendar component with month/week/day/year views
 */

import { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  Search,
  X,
} from '@/components/icons';
import {
  DndContext,
  DragEndEvent,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import { useCalendarEvents } from '../hooks/useCalendarEvents';
import { useCalendarDnd } from '../hooks/useCalendarDnd';
import { CalendarFilters } from './CalendarFilters';
import { CalendarUpcoming } from './CalendarUpcoming';
import { CalendarEventForm } from './CalendarEventForm';
import { CalendarEventDetail } from './CalendarEventDetail';
import { CalendarGoogleSync } from './CalendarGoogleSync';
import { RecurrenceEditModal } from './RecurrenceEditModal';
import { DraggableEvent } from './DraggableEvent';
import { EventType, EVENT_TYPE_CONFIG, UpdateMode } from '../types/calendar.types';
import type { CalendarEvent, CalendarView as ViewType } from '../types/calendar.types';
import { Loading } from '@/components/ui/Loading';
import { EmptyState } from '@/components/ui/EmptyState';
import { useUIStore } from '@/stores/useUIStore';

export function CalendarView() {
  const { theme } = useUIStore();
  const isDark = theme === 'dark';

  const [view, setView] = useState<ViewType>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<EventType[]>(Object.values(EventType) as EventType[]);
  const [searchQuery, setSearchQuery] = useState('');

  // Drag and Drop
  const {
    showRecurrenceModal,
    error: dndError,
    handleDragStart,
    handleDrop,
    handleDragCancel,
    handleRecurrenceDecision,
    clearError,
  } = useCalendarDnd();

  // Configure sensors for drag and drop (requires 5px movement before activating)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  // Calculate date range based on view
  const dateRange = useMemo(() => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);

    if (view === 'month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
    } else if (view === 'week') {
      start.setDate(start.getDate() - start.getDay());
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (view === 'day') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (view === 'year') {
      start.setMonth(0);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(11);
      end.setDate(31);
      end.setHours(23, 59, 59, 999);
    }

    return { start, end };
  }, [currentDate, view]);

  // Fetch events
  const { data: events = [], isLoading, error } = useCalendarEvents({
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  // Filter events by type and search query
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesType = selectedTypes.includes(event.type);
      const matchesSearch = searchQuery.trim() === '' ||
        event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (event.description && event.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesType && matchesSearch;
    });
  }, [events, selectedTypes, searchQuery]);

  // Navigation handlers
  const changeDate = (amount: number) => {
    const newDate = new Date(currentDate);
    if (view === 'month') newDate.setMonth(newDate.getMonth() + amount);
    else if (view === 'week') newDate.setDate(newDate.getDate() + amount * 7);
    else if (view === 'day') newDate.setDate(newDate.getDate() + amount);
    else if (view === 'year') newDate.setFullYear(newDate.getFullYear() + amount);
    setCurrentDate(newDate);
  };

  const toggleType = (type: EventType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleCreateEvent = () => {
    setEditingEvent(null);
    setIsFormOpen(true);
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    setIsFormOpen(true);
    setSelectedEvent(null);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
  };

  const handleMonthClick = (date: Date) => {
    setCurrentDate(date);
    setView('month');
  };

  // Format current date display
  const formatCurrentDate = () => {
    if (view === 'day') {
      return currentDate.toLocaleDateString('pt-BR', { dateStyle: 'long' });
    }
    if (view === 'month') {
      return currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    }
    if (view === 'year') {
      return currentDate.getFullYear().toString();
    }
    return `Semana de ${currentDate.getDate()}`;
  };

  // Handle drag start
  const handleDragStartEvent = (event: CalendarEvent) => {
    handleDragStart(event);
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      handleDragCancel();
      return;
    }

    // Parse drop target data
    const dropData = over.data.current as { date: Date; hour?: number };
    if (!dropData?.date) {
      handleDragCancel();
      return;
    }

    // Get dragged event
    const draggedEvent = active.data.current as CalendarEvent;
    if (!draggedEvent) {
      handleDragCancel();
      return;
    }

    // Perform drop
    handleDrop(dropData.date, dropData.hour);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className={`h-screen flex flex-col overflow-hidden ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
      {/* Header */}
      <div className={`h-16 border-b flex items-center justify-between px-8 z-20 shadow-xl ${isDark ? 'bg-zinc-900 border-zinc-800 shadow-black/20' : 'bg-white border-zinc-200 shadow-zinc-200/50'}`}>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-nexus-orange text-white rounded-xl shadow-lg shadow-nexus-orange/20">
              <CalendarIcon size={20} />
            </div>
            <h1 className={`text-lg font-black tracking-tight ${isDark ? 'text-white' : 'text-zinc-900'}`}>
              Calendário Corporativo
            </h1>
          </div>
          <div className={`flex border rounded-xl p-1 ${isDark ? 'bg-zinc-950/50 border-zinc-800' : 'bg-zinc-100 border-zinc-200'}`}>
            {(['day', 'week', 'month', 'year'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  view === v
                    ? 'bg-nexus-orange text-white shadow-lg shadow-nexus-orange/20'
                    : isDark ? 'text-zinc-500 hover:text-nexus-orange' : 'text-zinc-600 hover:text-nexus-orange'
                }`}
              >
                {v === 'day' ? 'Dia' : v === 'week' ? 'Semana' : v === 'month' ? 'Mês' : 'Ano'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => changeDate(-1)}
              className={`p-2 rounded-xl transition-all ${isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-600'}`}
            >
              <ChevronLeft size={20} />
            </button>
            <span className={`text-sm font-black px-4 min-w-[200px] text-center ${isDark ? 'text-white' : 'text-zinc-900'}`}>
              {formatCurrentDate()}
            </span>
            <button
              onClick={() => changeDate(1)}
              className={`p-2 rounded-xl transition-all ${isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-600'}`}
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <CalendarGoogleSync />
            <button
              onClick={handleCreateEvent}
              className="px-6 py-2.5 bg-nexus-orange hover:bg-nexus-orangeDark text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-nexus-orange/20 active:scale-95 flex items-center gap-2"
            >
              <Plus size={16} />
              Novo Evento
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Calendar Area */}
        <main className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <Loading />
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <EmptyState
                title="Erro ao carregar eventos"
                description="Não foi possível carregar os eventos do calendário. Tente novamente."
              />
            </div>
          )}

          {!isLoading && !error && (
            <>
              {view === 'month' && <MonthView events={filteredEvents} currentDate={currentDate} onEventClick={handleEventClick} onDragStart={handleDragStartEvent} isDark={isDark} />}
              {view === 'week' && <WeekView events={filteredEvents} currentDate={currentDate} onEventClick={handleEventClick} onDragStart={handleDragStartEvent} isDark={isDark} />}
              {view === 'day' && <DayView events={filteredEvents} currentDate={currentDate} onEventClick={handleEventClick} onDragStart={handleDragStartEvent} isDark={isDark} />}
              {view === 'year' && <YearView events={filteredEvents} currentDate={currentDate} onMonthClick={handleMonthClick} isDark={isDark} />}
            </>
          )}
        </main>

        {/* Sidebar */}
        <aside className={`w-80 border-l p-6 overflow-y-auto space-y-8 transition-all ${isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'}`}>
          {/* Search */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
              <Search size={14} className="text-nexus-orange" /> Buscar Eventos
            </h3>
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar por título ou descrição..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full rounded-xl px-4 py-3 pl-10 text-sm border focus:ring-2 focus:ring-nexus-orange/20 outline-none transition-all ${isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500' : 'bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400'}`}
              />
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${isDark ? 'text-zinc-500 hover:text-white' : 'text-zinc-400 hover:text-zinc-900'}`}
                >
                  <X size={16} />
                </button>
              )}
            </div>
            {searchQuery && (
              <div className="text-xs text-zinc-500">
                {filteredEvents.length} {filteredEvents.length === 1 ? 'resultado' : 'resultados'}
              </div>
            )}
          </div>

          <CalendarFilters selectedTypes={selectedTypes} onToggleType={toggleType} />
          <CalendarUpcoming events={filteredEvents} onEventClick={handleEventClick} />
        </aside>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <CalendarEventDetail
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onEdit={handleEditEvent}
        />
      )}

      {/* Event Form Modal */}
      {isFormOpen && (
        <CalendarEventForm
          event={editingEvent}
          defaultDate={currentDate}
          onClose={() => {
            setIsFormOpen(false);
            setEditingEvent(null);
          }}
        />
      )}

      {/* Recurrence Edit Modal */}
      {showRecurrenceModal && (
        <RecurrenceEditModal
          isOpen={showRecurrenceModal}
          onClose={() => {
            handleDragCancel();
          }}
          onEditThis={() => handleRecurrenceDecision(UpdateMode.THIS_ONLY)}
          onEditSeries={() => handleRecurrenceDecision(UpdateMode.ALL_FUTURE)}
        />
      )}

      {/* Drag and Drop Error Alert */}
      {dndError && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-red-500 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 max-w-md">
            <span className="text-sm font-medium">{dndError}</span>
            <button
              onClick={clearError}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
    </DndContext>
  );
}

// Placeholder components - to be implemented properly
interface ViewProps {
  events: CalendarEvent[];
  currentDate: Date;
  onEventClick: (event: CalendarEvent) => void;
  onDragStart: (event: CalendarEvent) => void;
  isDark: boolean;
}

interface YearViewProps {
  events: CalendarEvent[];
  currentDate: Date;
  onMonthClick: (date: Date) => void;
  isDark: boolean;
}

function MonthView({ events, currentDate, onEventClick, onDragStart, isDark }: ViewProps) {
  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const startDay = monthStart.getDay(); // 0 = Sunday
  const daysInMonth = monthEnd.getDate();

  // Create array of days including previous and next month to fill grid
  const days: Date[] = [];

  // Add days from previous month
  const prevMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);
  for (let i = startDay - 1; i >= 0; i--) {
    days.push(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, prevMonthEnd.getDate() - i));
  }

  // Add days from current month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i));
  }

  // Add days from next month to complete the grid (42 cells = 6 weeks)
  const remainingDays = 42 - days.length;
  for (let i = 1; i <= remainingDays; i++) {
    days.push(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, i));
  }

  const today = new Date();
  const isToday = (date: Date) => {
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  // Group events by date
  const eventsByDate = events.reduce((acc, event) => {
    const eventDate = new Date(event.startAt);
    const dateKey = `${eventDate.getFullYear()}-${eventDate.getMonth()}-${eventDate.getDate()}`;
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(event);
    return acc;
  }, {} as Record<string, CalendarEvent[]>);

  const getEventsForDate = (date: Date) => {
    const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    return eventsByDate[dateKey] || [];
  };

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="h-full flex flex-col">
      {/* Week day headers */}
      <div className={`grid grid-cols-7 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
        {weekDays.map((day) => (
          <div
            key={day}
            className="py-3 text-center text-[10px] font-black uppercase tracking-widest text-zinc-500"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 grid grid-cols-7 grid-rows-6">
        {days.map((date, index) => {
          const dayEvents = getEventsForDate(date);
          const visibleEvents = dayEvents.slice(0, 3);
          const hasMore = dayEvents.length > 3;

          return (
            <DroppableCell key={index} date={date} isDark={isDark}>
              <div
                className={`h-full border-b border-r p-2 min-h-[120px] ${
                  isDark ? 'border-zinc-800' : 'border-zinc-200'
                } ${
                  !isCurrentMonth(date) ? (isDark ? 'bg-zinc-900/50' : 'bg-zinc-100') : ''
                } ${isToday(date) ? 'bg-nexus-orange/5' : ''}`}
              >
                {/* Day number */}
                <div
                  className={`text-sm font-bold mb-2 ${
                    isToday(date)
                      ? 'w-7 h-7 rounded-full bg-nexus-orange text-white flex items-center justify-center'
                      : isCurrentMonth(date)
                      ? (isDark ? 'text-zinc-200' : 'text-zinc-900')
                      : (isDark ? 'text-zinc-600' : 'text-zinc-400')
                  }`}
                >
                  {date.getDate()}
                </div>

                {/* Events */}
                <div className="space-y-1">
                  {visibleEvents.map((event) => {
                    const config = EVENT_TYPE_CONFIG[event.type];
                    return (
                      <DraggableEvent key={event.id} event={event} onDragStart={onDragStart}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick(event);
                          }}
                          className={`w-full text-left px-2 py-1 rounded text-[10px] font-bold truncate transition-all ${config.bgColor} text-white hover:opacity-80`}
                          title={event.title}
                        >
                          {!event.isAllDay && (
                            <span className="mr-1">
                              {new Date(event.startAt).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                          {event.title}
                        </button>
                      </DraggableEvent>
                    );
                  })}

                  {hasMore && (
                    <div className="text-[9px] font-bold text-zinc-500 px-2">
                      +{dayEvents.length - 3} mais
                    </div>
                  )}
                </div>
              </div>
            </DroppableCell>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ events, currentDate, onEventClick, onDragStart, isDark }: ViewProps) {
  // Get start of week (Sunday)
  const weekStart = new Date(currentDate);
  weekStart.setDate(currentDate.getDate() - currentDate.getDay());
  weekStart.setHours(0, 0, 0, 0);

  // Create array of 7 days
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    return day;
  });

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const today = new Date();
  const isToday = (date: Date) => {
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  // Group events by day
  const eventsByDay = events.reduce((acc, event) => {
    const eventDate = new Date(event.startAt);
    const dayIndex = Math.floor((eventDate.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
    if (dayIndex >= 0 && dayIndex < 7) {
      if (!acc[dayIndex]) acc[dayIndex] = [];
      acc[dayIndex].push(event);
    }
    return acc;
  }, {} as Record<number, CalendarEvent[]>);

  const getEventsForDayAndHour = (dayIndex: number, hour: number) => {
    const dayEvents = eventsByDay[dayIndex] || [];
    return dayEvents.filter((event) => {
      const eventDate = new Date(event.startAt);
      const eventHour = eventDate.getHours();
      return eventHour === hour;
    });
  };

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="h-full flex flex-col overflow-auto">
      {/* Header with days */}
      <div className={`grid grid-cols-[60px_repeat(7,1fr)] border-b sticky top-0 z-10 ${isDark ? 'border-zinc-800 bg-zinc-950' : 'border-zinc-200 bg-zinc-50'}`}>
        <div className={`border-r ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`} /> {/* Empty cell for hour column */}
        {days.map((day, index) => (
          <div
            key={index}
            className={`py-3 text-center border-r ${isDark ? 'border-zinc-800' : 'border-zinc-200'} ${
              isToday(day) ? 'bg-nexus-orange/10' : ''
            }`}
          >
            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              {weekDays[day.getDay()]}
            </div>
            <div
              className={`text-xl font-black mt-1 ${
                isToday(day)
                  ? 'w-10 h-10 rounded-full bg-nexus-orange text-white flex items-center justify-center mx-auto'
                  : (isDark ? 'text-zinc-200' : 'text-zinc-900')
              }`}
            >
              {day.getDate()}
            </div>
          </div>
        ))}
      </div>

      {/* Timeline grid */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)]">
        {hours.map((hour) => (
          <div key={hour} className="contents">
            {/* Hour label */}
            <div className={`border-r border-b py-2 px-2 text-[10px] font-bold text-zinc-500 text-right ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
              {hour.toString().padStart(2, '0')}:00
            </div>

            {/* Day columns */}
            {days.map((day, dayIndex) => {
              const hourEvents = getEventsForDayAndHour(dayIndex, hour);
              return (
                <DroppableCell key={dayIndex} date={day} hour={hour} isDark={isDark}>
                  <div
                    className={`h-full border-r border-b p-1 min-h-[60px] relative ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}
                  >
                    {hourEvents.map((event) => {
                      const config = EVENT_TYPE_CONFIG[event.type];
                      return (
                        <DraggableEvent key={event.id} event={event} onDragStart={onDragStart}>
                          <button
                            onClick={() => onEventClick(event)}
                            className={`w-full text-left px-2 py-1 rounded text-[10px] font-bold mb-1 transition-all ${config.bgColor} text-white hover:opacity-80`}
                            title={event.title}
                          >
                            <div className="truncate">{event.title}</div>
                            <div className="text-[9px] opacity-70">
                              {new Date(event.startAt).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </button>
                        </DraggableEvent>
                      );
                    })}
                  </div>
                </DroppableCell>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function DayView({ events, currentDate, onEventClick, onDragStart, isDark }: ViewProps) {
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Filter events for current date
  const dayEvents = events.filter((event) => {
    const eventDate = new Date(event.startAt);
    return eventDate.getDate() === currentDate.getDate() &&
           eventDate.getMonth() === currentDate.getMonth() &&
           eventDate.getFullYear() === currentDate.getFullYear();
  });

  // Group events by hour
  const eventsByHour = dayEvents.reduce((acc, event) => {
    const eventDate = new Date(event.startAt);
    const hour = eventDate.getHours();
    if (!acc[hour]) acc[hour] = [];
    acc[hour].push(event);
    return acc;
  }, {} as Record<number, CalendarEvent[]>);

  const getEventsForHour = (hour: number) => {
    return eventsByHour[hour] || [];
  };

  const weekDays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  return (
    <div className="h-full flex flex-col overflow-auto">
      {/* Header */}
      <div className={`border-b py-4 px-6 sticky top-0 z-10 ${isDark ? 'border-zinc-800 bg-zinc-950' : 'border-zinc-200 bg-zinc-50'}`}>
        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
          {weekDays[currentDate.getDay()]}
        </div>
        <div className={`text-3xl font-black mt-1 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
          {currentDate.getDate()} de{' '}
          {currentDate.toLocaleDateString('pt-BR', { month: 'long' })},{' '}
          {currentDate.getFullYear()}
        </div>
        {dayEvents.length > 0 && (
          <div className={`text-sm mt-2 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
            {dayEvents.length} {dayEvents.length === 1 ? 'evento' : 'eventos'}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="flex-1">
        {hours.map((hour) => {
          const hourEvents = getEventsForHour(hour);
          return (
            <div key={hour} className={`flex border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
              {/* Hour label */}
              <div className={`w-24 py-4 px-4 text-sm font-bold text-zinc-500 text-right border-r ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
                {hour.toString().padStart(2, '0')}:00
              </div>

              {/* Events */}
              <DroppableCell date={currentDate} hour={hour} isDark={isDark}>
                <div className="flex-1 p-3 space-y-2 min-h-[80px]">
                  {hourEvents.map((event) => {
                    const config = EVENT_TYPE_CONFIG[event.type];
                    return (
                      <DraggableEvent key={event.id} event={event} onDragStart={onDragStart}>
                        <button
                          onClick={() => onEventClick(event)}
                          className={`w-full text-left p-3 rounded-xl transition-all ${config.bgColor} text-white hover:opacity-80`}
                        >
                          <div className="font-black text-sm truncate">{event.title}</div>
                          <div className="text-xs opacity-70 mt-1">
                            {new Date(event.startAt).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            -{' '}
                            {new Date(event.endAt).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                          {event.location && (
                            <div className="text-xs opacity-70 mt-1">{event.location}</div>
                          )}
                        </button>
                      </DraggableEvent>
                    );
                  })}
                  {hourEvents.length === 0 && (
                    <div className={`h-full flex items-center justify-center text-[10px] italic ${isDark ? 'text-zinc-700' : 'text-zinc-400'}`}>
                      Sem eventos
                    </div>
                  )}
                </div>
              </DroppableCell>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function YearView({ events, currentDate, onMonthClick, isDark }: YearViewProps) {
  const months = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];

  // Count events by month
  const eventsByMonth = events.reduce((acc, event) => {
    const eventDate = new Date(event.startAt);
    if (eventDate.getFullYear() === currentDate.getFullYear()) {
      const monthIndex = eventDate.getMonth();
      acc[monthIndex] = (acc[monthIndex] || 0) + 1;
    }
    return acc;
  }, {} as Record<number, number>);

  const getEventsCountForMonth = (monthIndex: number) => {
    return eventsByMonth[monthIndex] || 0;
  };

  const isCurrentMonth = (monthIndex: number) => {
    const today = new Date();
    return monthIndex === today.getMonth() && currentDate.getFullYear() === today.getFullYear();
  };

  return (
    <div className="h-full overflow-auto p-8">
      <div className="max-w-7xl mx-auto">
        <h2 className={`text-4xl font-black mb-8 ${isDark ? 'text-white' : 'text-zinc-900'}`}>{currentDate.getFullYear()}</h2>

        {/* 12-month grid (3 rows x 4 columns) */}
        <div className="grid grid-cols-4 gap-6">
          {months.map((monthName, monthIndex) => {
            const eventsCount = getEventsCountForMonth(monthIndex);
            const isCurrent = isCurrentMonth(monthIndex);

            return (
              <button
                key={monthIndex}
                onClick={() => {
                  const newDate = new Date(currentDate.getFullYear(), monthIndex, 1);
                  onMonthClick(newDate);
                }}
                className={`p-6 rounded-2xl border transition-all text-left ${
                  isCurrent
                    ? 'bg-nexus-orange/10 border-nexus-orange'
                    : isDark
                    ? 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700'
                    : 'bg-white border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300'
                }`}
              >
                {/* Month name */}
                <div
                  className={`text-sm font-black uppercase tracking-widest mb-3 ${
                    isCurrent ? 'text-nexus-orange' : 'text-zinc-400'
                  }`}
                >
                  {monthName}
                </div>

                {/* Mini calendar grid */}
                <MiniMonthCalendar
                  year={currentDate.getFullYear()}
                  month={monthIndex}
                  isCurrent={isCurrent}
                  isDark={isDark}
                />

                {/* Events count */}
                {eventsCount > 0 && (
                  <div className="mt-4 text-xs font-bold text-zinc-500">
                    {eventsCount} {eventsCount === 1 ? 'evento' : 'eventos'}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Mini calendar component for year view
function MiniMonthCalendar({ year, month, isCurrent, isDark }: { year: number; month: number; isCurrent: boolean; isDark: boolean }) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const days: (number | null)[] = [];

  // Add empty cells for days before month starts
  for (let i = 0; i < startDay; i++) {
    days.push(null);
  }

  // Add days of month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const today = new Date();
  const isToday = (day: number | null) => {
    if (!day) return false;
    return day === today.getDate() &&
           month === today.getMonth() &&
           year === today.getFullYear();
  };

  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((day, index) => (
        <div
          key={index}
          className={`aspect-square flex items-center justify-center text-[10px] rounded ${
            day === null
              ? ''
              : isToday(day)
              ? 'bg-nexus-orange text-white font-black'
              : isCurrent
              ? (isDark ? 'text-zinc-300 font-medium' : 'text-zinc-700 font-medium')
              : (isDark ? 'text-zinc-500 font-medium' : 'text-zinc-400 font-medium')
          }`}
        >
          {day}
        </div>
      ))}
    </div>
  );
}

// Droppable Cell Component
interface DroppableCellProps {
  date: Date;
  hour?: number;
  isDark: boolean;
  children: React.ReactNode;
}

function DroppableCell({ date, hour, isDark, children }: DroppableCellProps) {
  const dropId = `${date.toISOString()}-${hour ?? 'all-day'}`;
  const { setNodeRef, isOver } = useDroppable({
    id: dropId,
    data: { date, hour },
  });

  return (
    <div
      ref={setNodeRef}
      className={`relative ${isOver ? (isDark ? 'bg-nexus-orange/10' : 'bg-nexus-orange/5') : ''}`}
    >
      {children}
    </div>
  );
}
