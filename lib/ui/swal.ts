'use client';

import Swal from 'sweetalert2';

/** Escapa texto para usar dentro de `html` de SweetAlert2 (evita XSS). */
export function escapeSwalHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Alerta de validación (sustituye `alert()` nativo). */
export async function swalAlertWarning(title: string, text?: string): Promise<void> {
  await Swal.fire({
    icon: 'warning',
    title,
    text,
    confirmButtonText: 'Aceptar',
    confirmButtonColor: '#6d28d9',
  });
}

export async function swalAlertError(title: string, text?: string): Promise<void> {
  await Swal.fire({
    icon: 'error',
    title,
    text,
    confirmButtonText: 'Aceptar',
    confirmButtonColor: '#2563eb',
  });
}

/** Confirmación de acción correcta (guardados, envíos, etc.). */
export async function swalAlertSuccess(title: string, text?: string): Promise<void> {
  await Swal.fire({
    icon: 'success',
    title,
    text,
    confirmButtonText: 'Aceptar',
    confirmButtonColor: '#16a34a',
  });
}

/** Confirmación destructiva con SweetAlert2. */
export async function swalConfirmDanger(params: {
  title: string;
  text?: string;
  html?: string;
  confirmButtonText?: string;
}): Promise<boolean> {
  const r = await Swal.fire({
    icon: 'warning',
    title: params.title,
    text: params.text,
    html: params.html,
    showCancelButton: true,
    confirmButtonText: params.confirmButtonText ?? 'Sí, continuar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#b91c1c',
    cancelButtonColor: '#6b7280',
    reverseButtons: true,
  });
  return r.isConfirmed;
}

export { Swal };
