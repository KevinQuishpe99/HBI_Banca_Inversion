'use client';

import { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
  /** ms; errores no se cierran solos */
  duration?: number;
  /** Apilado cuando hay varias alertas */
  zIndex?: number;
}

/** Por encima de modales habituales (p. ej. confirm z-110) */
const TOAST_BASE_Z = 200;

export function Toast({ message, type, onClose, duration, zIndex = TOAST_BASE_Z }: ToastProps) {
  const isError = type === 'error';
  const autoMs = isError ? undefined : duration ?? 4500;

  useEffect(() => {
    if (autoMs == null || autoMs <= 0) return;
    const timer = setTimeout(() => {
      onClose();
    }, autoMs);
    return () => clearTimeout(timer);
  }, [autoMs, onClose]);

  const icons = {
    success: <CheckCircle className="h-6 w-6 text-green-600" />,
    error: <XCircle className="h-6 w-6 text-red-600" />,
    info: <AlertCircle className="h-6 w-6 text-blue-600" />,
  };

  const cardStyles = {
    success: 'border-green-200 bg-green-50',
    error: 'border-red-200 bg-red-50',
    info: 'border-blue-200 bg-blue-50',
  };

  const textStyles = {
    success: 'text-green-950',
    error: 'text-red-950',
    info: 'text-blue-950',
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      style={{ zIndex }}
      role="presentation"
      onClick={onClose}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="toast-message"
        className={`max-h-[min(85vh,480px)] w-full max-w-md overflow-y-auto rounded-xl border-2 p-5 shadow-2xl ${cardStyles[type]}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <div className="flex-shrink-0 pt-0.5">{icons[type]}</div>
          <p
            id="toast-message"
            className={`min-w-0 flex-1 break-words whitespace-pre-wrap text-sm font-medium leading-relaxed ${textStyles[type]}`}
          >
            {message}
          </p>
        </div>
        <div className="mt-6 flex justify-end border-t border-black/5 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
