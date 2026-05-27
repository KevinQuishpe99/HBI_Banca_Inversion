'use client';

import { useState } from 'react';
import { ModalFrame } from '@/components/ui/ModalFrame';
import { formInputPurple, formLabel } from '@/components/ui/form-classes';
import { RoleSelect } from './RoleSelect';
import { AreaRoleFields } from './AreaRoleFields';
import { PasswordInputWithToggle } from './PasswordInputWithToggle';
import type { AdminUserRow } from './types';
import { swalAlertWarning } from '@/lib/ui/swal';

type Props = {
  user: AdminUserRow;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
  isLoading: boolean;
};

export function EditUserModal({ user, onClose, onSubmit, isLoading }: Props) {
  const [formData, setFormData] = useState({
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    area: user.area || '',
    canSign: user.puedeFirmar ?? user.canSign ?? false,
    areaAllowsSigning: user.areaSupportsSigning === true,
    isActive: user.isActive,
    newPassword: '',
    confirmPassword: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.area) {
      await swalAlertWarning('Falta el área', 'Debe seleccionar un área.');
      return;
    }
    if (formData.newPassword || formData.confirmPassword) {
      if (formData.newPassword.length < 6) {
        await swalAlertWarning('Contraseña corta', 'La nueva contraseña debe tener al menos 6 caracteres.');
        return;
      }
      if (formData.newPassword !== formData.confirmPassword) {
        await swalAlertWarning('Contraseñas distintas', 'Las contraseñas no coinciden.');
        return;
      }
    }
    const submitData: Record<string, unknown> = {
      email: formData.email.trim(),
      firstName: formData.firstName,
      lastName: formData.lastName,
      role: formData.role,
      isActive: formData.isActive,
    };
    if (formData.newPassword.trim()) {
      submitData.newPassword = formData.newPassword;
    }
    submitData.area = formData.area;
    if (formData.role === 'AREA_USER' && formData.areaAllowsSigning) {
      submitData.canSign = formData.canSign;
    } else {
      submitData.canSign = false;
    }
    onSubmit(submitData);
  };

  return (
    <ModalFrame>
      <h3 className="mb-4 text-lg font-bold text-gray-900 sm:text-xl">Editar usuario</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={formLabel}>Correo electrónico</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className={formInputPurple}
            required
            autoComplete="off"
          />
          {process.env.NEXT_PUBLIC_MICROSOFT_LOGIN_ENABLED === 'true' ? (
            <p className="mt-1 text-xs text-gray-500">Mismo correo que en Microsoft si usa ese acceso.</p>
          ) : null}
        </div>
        <div>
          <label className={formLabel}>Nombre</label>
          <input
            type="text"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            className={formInputPurple}
            required
          />
        </div>
        <div>
          <label className={formLabel}>Apellido</label>
          <input
            type="text"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            className={formInputPurple}
            required
          />
        </div>
        <RoleSelect
          value={formData.role}
          onChange={(role) => setFormData({ ...formData, role, canSign: false })}
        />
        <AreaRoleFields
          area={formData.area}
          onAreaChange={(area, allowsSigning) => {
            setFormData((prev) => ({
              ...prev,
              area,
              areaAllowsSigning: allowsSigning,
              canSign: allowsSigning ? prev.canSign : false,
            }));
          }}
          required
          showHint={formData.role === 'AREA_USER'}
        />
        {formData.role === 'AREA_USER' && formData.areaAllowsSigning ? (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="canSign"
              checked={formData.canSign}
              onChange={(e) => setFormData({ ...formData, canSign: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            <label htmlFor="canSign" className="text-sm font-medium text-gray-700">
              Puede firmar documentos
            </label>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isActive"
            checked={formData.isActive}
            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
          />
          <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
            Usuario activo
          </label>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3">
          <p className="mb-3 text-xs font-medium text-amber-950">Nueva contraseña (opcional)</p>
          <div className="space-y-3">
            <PasswordInputWithToggle
              id="edit-new-password"
              label="Nueva contraseña (opcional)"
              value={formData.newPassword}
              onChange={(v) => setFormData({ ...formData, newPassword: v })}
              placeholder="Dejar vacío para no cambiar"
            />
            <PasswordInputWithToggle
              id="edit-confirm-password"
              label="Confirmar nueva contraseña"
              value={formData.confirmPassword}
              onChange={(v) => setFormData({ ...formData, confirmPassword: v })}
              placeholder="Repetir si cambia la contraseña"
            />
          </div>
        </div>

        <div className="flex flex-col justify-end gap-3 pt-4 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-md px-4 py-2 text-gray-700 hover:bg-gray-100 sm:w-auto"
            disabled={isLoading}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-md bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 disabled:opacity-50 sm:w-auto"
          >
            {isLoading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}
