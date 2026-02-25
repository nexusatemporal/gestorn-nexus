/**
 * Recurring Event Modal Component
 * Modal for configuring recurring event rules (RRULE)
 *
 * NOTE: Currently using rrule-mock until npm is fixed and real rrule package can be installed
 * TODO: Replace '@/lib/rrule-mock' with 'rrule' once npm works
 */

import { useState, useMemo } from 'react';
// import { RRule, Frequency } from 'rrule'; // TODO: Uncomment when rrule is installed
import { RRule, Frequency } from '@/lib/rrule-mock'; // Temporary mock
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Check } from '@/components/icons';

interface RecurringEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rruleString: string, recurrenceEnd?: Date) => void;
  initialRule?: string;
  startDate: Date;
}

type FrequencyType = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
type EndType = 'NEVER' | 'ON_DATE' | 'AFTER';

const WEEKDAYS = [
  { label: 'Dom', value: RRule.SU, fullName: 'Domingo' },
  { label: 'Seg', value: RRule.MO, fullName: 'Segunda' },
  { label: 'Ter', value: RRule.TU, fullName: 'Terça' },
  { label: 'Qua', value: RRule.WE, fullName: 'Quarta' },
  { label: 'Qui', value: RRule.TH, fullName: 'Quinta' },
  { label: 'Sex', value: RRule.FR, fullName: 'Sexta' },
  { label: 'Sáb', value: RRule.SA, fullName: 'Sábado' },
];

const FREQUENCY_OPTIONS = [
  { value: 'DAILY', label: 'Diário' },
  { value: 'WEEKLY', label: 'Semanal' },
  { value: 'MONTHLY', label: 'Mensal' },
  { value: 'YEARLY', label: 'Anual' },
];

export function RecurringEventModal({
  isOpen,
  onClose,
  onSave,
  initialRule,
  startDate,
}: RecurringEventModalProps) {
  // Parse initial rule if provided
  const parsedRule = useMemo(() => {
    if (!initialRule) return null;
    try {
      return RRule.fromString(initialRule);
    } catch {
      return null;
    }
  }, [initialRule]);

  const [frequency, setFrequency] = useState<FrequencyType>(
    parsedRule ? getFrequencyType(parsedRule.options.freq) : 'WEEKLY'
  );
  const [interval, setInterval] = useState<number>(parsedRule?.options.interval || 1);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>(
    parsedRule?.options.byweekday || []
  );
  const [endType, setEndType] = useState<EndType>(
    parsedRule?.options.until ? 'ON_DATE' : parsedRule?.options.count ? 'AFTER' : 'NEVER'
  );
  const [endDate, setEndDate] = useState<Date>(
    parsedRule?.options.until || new Date(new Date().setMonth(new Date().getMonth() + 6))
  );
  const [occurrences, setOccurrences] = useState<number>(parsedRule?.options.count || 10);

  // Generate RRULE from current state
  const generatedRule = useMemo(() => {
    const options: {
      freq: Frequency;
      interval?: number;
      byweekday?: number[];
      until?: Date;
      count?: number;
      dtstart?: Date;
    } = {
      freq: getFrequencyValue(frequency),
      interval,
      dtstart: startDate,
    };

    if (frequency === 'WEEKLY' && selectedWeekdays.length > 0) {
      options.byweekday = selectedWeekdays;
    }

    if (endType === 'ON_DATE') {
      options.until = endDate;
    } else if (endType === 'AFTER') {
      options.count = occurrences;
    }

    return new RRule(options);
  }, [frequency, interval, selectedWeekdays, endType, endDate, occurrences, startDate]);

  // Generate preview occurrences
  const previewOccurrences = useMemo(() => {
    try {
      return generatedRule.all((_date: Date, i: number) => i < 5);
    } catch {
      return [];
    }
  }, [generatedRule]);

  const toggleWeekday = (day: number) => {
    setSelectedWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSave = () => {
    const rruleString = generatedRule.toString();
    const recurrenceEnd = endType === 'ON_DATE' ? endDate : undefined;
    onSave(rruleString, recurrenceEnd);
    onClose();
  };

  const getIntervalLabel = () => {
    switch (frequency) {
      case 'DAILY':
        return interval === 1 ? 'dia' : 'dias';
      case 'WEEKLY':
        return interval === 1 ? 'semana' : 'semanas';
      case 'MONTHLY':
        return interval === 1 ? 'mês' : 'meses';
      case 'YEARLY':
        return interval === 1 ? 'ano' : 'anos';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configurar Recorrência" size="lg">
      <div className="space-y-6">
        {/* Frequency */}
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Repetir"
            value={frequency}
            onChange={(e) => {
              setFrequency(e.target.value as FrequencyType);
              setSelectedWeekdays([]);
            }}
            options={FREQUENCY_OPTIONS}
          />

          <div>
            <label className="text-xs font-medium text-zinc-400 block mb-1">
              A cada
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={99}
                value={interval}
                onChange={(e) => setInterval(parseInt(e.target.value) || 1)}
                className="w-20"
              />
              <span className="text-sm text-zinc-400">{getIntervalLabel()}</span>
            </div>
          </div>
        </div>

        {/* Weekday selector for WEEKLY frequency */}
        {frequency === 'WEEKLY' && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400 block">
              Repetir em
            </label>
            <div className="flex gap-2">
              {WEEKDAYS.map((day) => {
                const isSelected = selectedWeekdays.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleWeekday(day.value)}
                    className={`w-12 h-12 rounded-xl font-black text-xs transition-all ${
                      isSelected
                        ? 'bg-nexus-orange text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                    title={day.fullName}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* End condition */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-400 block">Terminar</label>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="endType"
                value="NEVER"
                checked={endType === 'NEVER'}
                onChange={(e) => setEndType(e.target.value as EndType)}
                className="w-4 h-4 border-zinc-700 bg-zinc-800 text-nexus-orange focus:ring-nexus-orange/20"
              />
              <span className="text-sm text-zinc-300">Nunca</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="endType"
                value="ON_DATE"
                checked={endType === 'ON_DATE'}
                onChange={(e) => setEndType(e.target.value as EndType)}
                className="w-4 h-4 border-zinc-700 bg-zinc-800 text-nexus-orange focus:ring-nexus-orange/20"
              />
              <span className="text-sm text-zinc-300">Em</span>
              <input
                type="date"
                disabled={endType !== 'ON_DATE'}
                value={endDate.toISOString().split('T')[0]}
                onChange={(e) => setEndDate(new Date(e.target.value))}
                className="flex-1 rounded-xl px-3 py-2 text-sm border bg-zinc-800 border-zinc-700 text-white focus:ring-2 focus:ring-nexus-orange/20 outline-none disabled:opacity-50"
              />
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="endType"
                value="AFTER"
                checked={endType === 'AFTER'}
                onChange={(e) => setEndType(e.target.value as EndType)}
                className="w-4 h-4 border-zinc-700 bg-zinc-800 text-nexus-orange focus:ring-nexus-orange/20"
              />
              <span className="text-sm text-zinc-300">Após</span>
              <Input
                type="number"
                min={1}
                max={999}
                disabled={endType !== 'AFTER'}
                value={occurrences}
                onChange={(e) => setOccurrences(parseInt(e.target.value) || 1)}
                className="w-20"
              />
              <span className="text-sm text-zinc-300">ocorrências</span>
            </label>
          </div>
        </div>

        {/* Preview */}
        <div className="p-4 rounded-xl border bg-zinc-800/40 border-zinc-800">
          <h4 className="text-[10px] font-black uppercase text-zinc-500 mb-3 tracking-widest">
            Próximas Ocorrências
          </h4>
          <div className="space-y-2">
            {previewOccurrences.length > 0 ? (
              previewOccurrences.map((date: Date, i: number) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-sm text-zinc-300"
                >
                  <Check size={14} className="text-nexus-orange" />
                  {date.toLocaleDateString('pt-BR', {
                    weekday: 'short',
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </div>
              ))
            ) : (
              <p className="text-xs text-zinc-500 italic">
                Nenhuma ocorrência para preview
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4 pt-4">
          <Button
            type="button"
            onClick={onClose}
            variant="secondary"
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            variant="primary"
            className="flex-1"
            disabled={frequency === 'WEEKLY' && selectedWeekdays.length === 0}
          >
            Salvar Regra
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// Helper functions
function getFrequencyValue(freq: FrequencyType): Frequency {
  switch (freq) {
    case 'DAILY':
      return RRule.DAILY;
    case 'WEEKLY':
      return RRule.WEEKLY;
    case 'MONTHLY':
      return RRule.MONTHLY;
    case 'YEARLY':
      return RRule.YEARLY;
  }
}

function getFrequencyType(freq: Frequency): FrequencyType {
  switch (freq) {
    case RRule.DAILY:
      return 'DAILY';
    case RRule.WEEKLY:
      return 'WEEKLY';
    case RRule.MONTHLY:
      return 'MONTHLY';
    case RRule.YEARLY:
      return 'YEARLY';
    default:
      return 'WEEKLY';
  }
}
