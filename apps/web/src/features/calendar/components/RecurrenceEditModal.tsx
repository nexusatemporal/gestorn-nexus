/**
 * Recurrence Edit Modal Component
 * Appears when user drags a recurring event
 * Asks if they want to edit just this occurrence or the entire series
 */

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface RecurrenceEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEditThis: () => void;
  onEditSeries: () => void;
}

export function RecurrenceEditModal({
  isOpen,
  onClose,
  onEditThis,
  onEditSeries,
}: RecurrenceEditModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Editar Evento Recorrente"
      size="sm"
    >
      <div className="space-y-6">
        <p className="text-sm text-zinc-300">
          Este é um evento recorrente. Como você deseja proceder com a alteração?
        </p>

        <div className="space-y-3">
          <Button
            variant="primary"
            className="w-full"
            onClick={() => {
              onEditThis();
              onClose();
            }}
          >
            Apenas este evento
          </Button>

          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              onEditSeries();
              onClose();
            }}
          >
            Toda a série
          </Button>

          <Button
            variant="secondary"
            className="w-full"
            onClick={onClose}
          >
            Cancelar
          </Button>
        </div>

        <div className="text-xs text-zinc-500 space-y-2">
          <p>
            <strong>Apenas este evento:</strong> Altera apenas esta ocorrência específica,
            mantendo as demais intactas.
          </p>
          <p>
            <strong>Toda a série:</strong> Altera todas as ocorrências futuras deste evento recorrente.
          </p>
        </div>
      </div>
    </Modal>
  );
}
