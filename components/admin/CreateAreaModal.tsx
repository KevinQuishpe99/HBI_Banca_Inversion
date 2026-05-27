'use client';

import { useEffect, useState } from 'react';
import { ModalFrame } from '@/components/ui/ModalFrame';
import { adminBtnPrimary, adminBtnSecondary, adminInput, adminLabel } from '@/lib/ui/admin-ui';

export type CreateAreaPayload = {
  label: string;
  isActive: boolean;
  isSelectable: boolean;
  isMandatory: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: CreateAreaPayload) => void | Promise<void>;
  isPending: boolean;
};

export function CreateAreaModal({ open, onClose, onCreate, isPending }: Props) {
  const [label, setLabel] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isSelectable, setIsSelectable] = useState(true);
  const [isMandatory, setIsMandatory] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLabel('');
    setIsActive(true);
    setIsSelectable(true);
    setIsMandatory(false);
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) return;
    void onCreate({
      label: trimmed,
      isActive,
      isSelectable,
      isMandatory,
    });
  };

  return (
    <ModalFrame className="max-w-lg">
      <h3 className="mb-1 text-lg font-bold text-admin-text-strong">Nueva área</h3>
      <p className="mb-4 text-sm text-admin-text-secondary">
        El área se identifica por su id interno. Supervisores y usuarios se asignan en Gestión de usuarios.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="create-area-label" className={adminLabel}>
            Nombre del área
          </label>
          <input
            id="create-area-label"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Nombre visible"
            className={`${adminInput} mt-1`}
            disabled={isPending}
            required
            autoComplete="off"
          />
        </div>
        <div className="flex flex-col gap-2 text-sm text-admin-text">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              disabled={isPending}
            />
            <span>Activa</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isSelectable}
              onChange={(e) => setIsSelectable(e.target.checked)}
              disabled={isPending}
            />
            <span>Seleccionable (registro público / autoregistro)</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isMandatory}
              onChange={(e) => setIsMandatory(e.target.checked)}
              disabled={isPending}
            />
            <span>Obligatoria en el flujo</span>
          </label>
        </div>
        <div className="flex flex-col justify-end gap-2 border-t border-admin-border pt-4 sm:flex-row sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            className={`${adminBtnSecondary} w-full sm:w-auto`}
            disabled={isPending}
          >
            Cancelar
          </button>
          <button type="submit" disabled={isPending} className={`${adminBtnPrimary} w-full sm:w-auto`}>
            {isPending ? 'Creando…' : 'Crear área'}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}
