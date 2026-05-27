import { buildPayloadTooLargeUserMessage } from '@/lib/upload/file-size-report';

type ZodIssueLike = { message?: string; path?: (string | number)[] };

export type GetApiErrorOptions = {
  httpStatus?: number;
  /** Archivos del formulario (para mensaje detallado en 413). */
  uploadFiles?: File[];
};

/**
 * Extrae el mensaje que debe ver el usuario desde la respuesta JSON de la API.
 */
export function getApiErrorMessage(
  payload: Record<string, unknown>,
  fallback = 'No se pudo completar la operación. Intente de nuevo.',
  options?: GetApiErrorOptions
): string {
  if (options?.httpStatus === 413) {
    if (options.uploadFiles?.length) {
      return buildPayloadTooLargeUserMessage(options.uploadFiles);
    }
    const direct = payload.error;
    if (typeof direct === 'string' && direct.trim() && direct !== 'Error interno del servidor') {
      return direct.trim();
    }
    return (
      'El servidor rechazó el envío porque es demasiado grande (error 413). ' +
      'Reduzca el tamaño de los archivos, suba menos archivos o contacte al administrador para aumentar el límite del servidor.'
    );
  }

  if (options?.httpStatus === 401) {
    return 'Su sesión expiró. Cierre sesión, vuelva a entrar e intente de nuevo.';
  }
  const direct = payload.error;
  if (typeof direct === 'string' && direct.trim() && direct !== 'Error interno del servidor') {
    return direct.trim();
  }

  const details = payload.details;
  if (Array.isArray(details) && details.length > 0) {
    const first = details[0] as ZodIssueLike;
    if (typeof first?.message === 'string') {
      const path = first.path?.length ? first.path.map(String).join('.') : 'formulario';
      return `${path}: ${first.message}`;
    }
  }

  if (
    typeof details === 'object' &&
    details !== null &&
    !Array.isArray(details) &&
    typeof (details as { message?: string }).message === 'string'
  ) {
    const m = (details as { message: string }).message.trim();
    if (m && m !== 'Error interno del servidor') return m;
  }

  return fallback;
}
