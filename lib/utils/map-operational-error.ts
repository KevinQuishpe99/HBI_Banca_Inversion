import { ZodError } from 'zod';
import { emailTemplateFieldLabel } from '@/lib/email/email-template-field-labels';
import { AppError, ValidationError } from '@/lib/utils/errors';

type PgError = Error & {
  code?: string;
  detail?: string;
  column?: string;
  constraint?: string;
};

/** Detecta AppError cuando `instanceof` falla entre bundles de Next.js. */
export function isAppErrorLike(error: unknown): error is AppError {
  if (!(typeof error === 'object' && error !== null)) return false;
  const e = error as AppError;
  return (
    typeof e.statusCode === 'number' &&
    e.statusCode >= 400 &&
    e.statusCode < 600 &&
    typeof e.message === 'string' &&
    e.message.length > 0
  );
}

/**
 * Convierte errores técnicos (Postgres, Azure, payload, etc.) en mensajes entendibles para el usuario.
 * Devuelve null si no hay un mensaje seguro que mostrar.
 */
export function mapUnknownErrorToAppError(error: unknown): AppError | null {
  if (error instanceof AppError) return error;
  if (isAppErrorLike(error)) return error;

  if (error instanceof ZodError) return null;

  if (!(error instanceof Error)) return null;

  const pg = error as PgError;
  const msgLower = error.message.toLowerCase();

  if (pg.code) {
    switch (pg.code) {
      case '22001':
        return new ValidationError(
          'Uno de los datos ingresados es demasiado largo. Si adjuntó varios archivos, acorte los nombres de archivo e intente de nuevo.'
        );
      case '23502':
        return new ValidationError(
          'Faltan datos obligatorios en el formulario. Revise los campos marcados con * e intente de nuevo.'
        );
      case '23503':
        return new ValidationError(
          'Alguna opción seleccionada ya no es válida (tipo de documento, firma o plantilla). Recargue la página y vuelva a intentar.'
        );
      case '23505':
        return new ValidationError(
          'Ya existe un registro con esos datos. Si crea un trámite, verifique que no se haya guardado en un intento anterior.'
        );
      case '23514':
        if (msgLower.includes('odoo') || pg.constraint?.includes('odoo')) {
          return new ValidationError(
            'El código Odoo debe empezar con "S" y tener como máximo 6 caracteres.'
          );
        }
        return new ValidationError(
          'Algún dato del formulario no cumple las reglas del sistema. Revise fechas, montos y códigos.'
        );
      case '22P02':
        return new ValidationError('Hay un dato con formato inválido. Revise fechas y montos.');
      case '57014':
        return new AppError(
          503,
          'La operación tardó demasiado. Intente con menos archivos o más tarde.'
        );
      case '42P01':
        if (msgLower.includes('correos_enviados')) {
          return new AppError(
            503,
            'El historial de correos no está disponible en este servidor. Solicite al soporte técnico que active el registro de correos.'
          );
        }
        break;
      default:
        break;
    }
  }

  if (
    msgLower.includes('azure storage credentials') ||
    msgLower.includes('no configuradas')
  ) {
    return new AppError(
      503,
      'El almacenamiento de archivos no está disponible. Contacte al administrador del sistema.'
    );
  }

  if (
    msgLower.includes('request body') ||
    msgLower.includes('payload too large') ||
    msgLower.includes('entity too large') ||
    msgLower.includes('body exceeded') ||
    msgLower.includes('413')
  ) {
    return new AppError(
      413,
      'Los archivos adjuntos son demasiado grandes para enviar en una sola solicitud. Suba menos archivos o reduzca su tamaño.'
    );
  }

  if (msgLower.includes('timeout') || msgLower.includes('timed out')) {
    return new AppError(
      503,
      'La operación tardó demasiado en completarse. Intente de nuevo con menos archivos o más tarde.'
    );
  }

  if (msgLower.includes('econnrefused') || msgLower.includes('enotfound')) {
    return new AppError(
      503,
      'No se pudo conectar con el servidor de base de datos o almacenamiento. Intente más tarde.'
    );
  }

  // Errores lanzados en la app con mensaje en español (throw new Error('...'))
  const trimmed = error.message.trim();
  if (
    trimmed.length >= 8 &&
    trimmed.length <= 400 &&
    !trimmed.includes(' at ') &&
    !trimmed.startsWith('Unexpected') &&
    !trimmed.includes('ECONNRESET')
  ) {
    const looksUserFacing =
      /[áéíóúñÁÉÍÓÚÑ]/.test(trimmed) ||
      /^(El |La |Los |Las |Debe |No se |Error al |Faltan |Revise )/.test(trimmed);
    if (looksUserFacing) {
      return new ValidationError(trimmed);
    }
  }

  return null;
}

/** Primer mensaje legible de un error Zod para mostrar en UI. */
export function zodErrorToUserMessage(error: ZodError): string {
  if (error.errors.length === 0) return 'Revise los datos del formulario e intente de nuevo.';
  const lines = error.errors.slice(0, 6).map((issue) => {
    const key = issue.path?.length ? issue.path.join('.') : 'formulario';
    const label = key !== 'formulario' && !key.includes('.') ? emailTemplateFieldLabel(key) : key;
    const msg =
      issue.message === 'Required' || issue.message.includes('required')
        ? 'dato obligatorio'
        : issue.message;
    return `• ${label}: ${msg}`;
  });
  return `Faltan o son incorrectos estos campos:\n${lines.join('\n')}`;
}
