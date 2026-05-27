'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { PasswordInputWithToggle } from '@/components/admin/user-management/PasswordInputWithToggle';
import { getApiErrorMessage } from '@/lib/api/parse-api-error';
import { Swal } from '@/lib/ui/swal';

type PasswordStatus = {
  hasLocalPassword: boolean;
  microsoftLoginEnabled: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ChangePasswordModal({ open, onClose }: Props) {
  const [status, setStatus] = useState<PasswordStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setFieldError(null);
  }, []);

  const loadStatus = useCallback(async () => {
    setStatus(null);
    resetForm();
    setLoadingStatus(true);
    try {
      const res = await fetch('/api/account/password');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          getApiErrorMessage(json as Record<string, unknown>, 'No se pudo cargar la información')
        );
      }
      setStatus((json as { data?: PasswordStatus }).data ?? null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al cargar';
      await Swal.fire({
        icon: 'error',
        title: 'Contraseña',
        text: msg,
        confirmButtonColor: '#2563eb',
      });
      onClose();
    } finally {
      setLoadingStatus(false);
    }
  }, [onClose, resetForm]);

  useEffect(() => {
    if (!open) return;
    void loadStatus();
  }, [open, loadStatus]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(null);

    if (newPassword.length < 6) {
      setFieldError('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setFieldError('Las contraseñas no coinciden');
      return;
    }
    if (status?.hasLocalPassword && !currentPassword.trim()) {
      setFieldError('Ingrese su contraseña actual');
      return;
    }

    setSaving(true);
    void fetch('/api/account/password', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: status?.hasLocalPassword ? currentPassword : undefined,
        newPassword,
        confirmPassword,
      }),
    })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            getApiErrorMessage(json as Record<string, unknown>, 'No se pudo actualizar la contraseña')
          );
        }
        const msg =
          typeof (json as { data?: { message?: string } }).data?.message === 'string'
            ? (json as { data: { message: string } }).data.message
            : 'Contraseña guardada';
        resetForm();
        onClose();
        await Swal.fire({
          icon: 'success',
          title: 'Listo',
          text: msg,
          confirmButtonColor: '#2563eb',
        });
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Error al guardar';
        setFieldError(msg);
      })
      .finally(() => setSaving(false));
  };

  if (!open) return null;

  const needsCurrent = status?.hasLocalPassword === true;

  return (
    <div
      className="fixed inset-0 z-[260] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-title"
    >
      <div className="relative w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="absolute right-3 top-3 rounded p-1 text-gray-500 hover:bg-gray-100"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 id="change-password-title" className="pr-8 text-lg font-semibold text-gray-900">
          {needsCurrent ? 'Cambiar contraseña' : 'Establecer contraseña'}
        </h2>

        {loadingStatus ? (
          <div className="mt-6 flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-gray-600">
              {needsCurrent
                ? 'Use esta contraseña para iniciar sesión con su correo electrónico.'
                : 'Su cuenta entra con Microsoft. Puede crear una contraseña local adicional para entrar con correo y contraseña.'}
            </p>
            {status?.microsoftLoginEnabled && !needsCurrent ? (
              <p className="mt-2 text-xs text-gray-500">
                Para cambiar la contraseña de Microsoft 365, use la cuenta de Microsoft o el
                administrador de su organización.
              </p>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {needsCurrent ? (
                <PasswordInputWithToggle
                  id="current-password"
                  label="Contraseña actual"
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  autoComplete="current-password"
                  required
                />
              ) : null}
              <PasswordInputWithToggle
                id="new-password"
                label="Nueva contraseña"
                value={newPassword}
                onChange={setNewPassword}
                autoComplete="new-password"
                minLength={6}
                required
              />
              <PasswordInputWithToggle
                id="confirm-password"
                label="Confirmar nueva contraseña"
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
                minLength={6}
                required
              />

              {fieldError ? (
                <p className="text-sm text-red-600" role="alert">
                  {fieldError}
                </p>
              ) : null}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
