/**
 * Error de negocio / validación del flujo (no es un fallo técnico).
 * Sirve para no hacer `console.error` en la UI cuando ya mostramos el toast.
 */
export class FlowValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FlowValidationError';
    Object.setPrototypeOf(this, FlowValidationError.prototype);
  }
}

/**
 * Formatea el cuerpo de error de APIs de flujo (p. ej. pendingAreas desde ValidationError).
 */
function normalizePendingAreas(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === 'string' && raw.trim()) return [raw.trim()];
  return [];
}

export function formatFlowApiError(body: unknown): string {
  const b = body as { error?: string; details?: { pendingAreas?: unknown } };
  const base = b.error ?? 'Error en la operación';
  const areas = normalizePendingAreas(b.details?.pendingAreas);
  if (areas.length) {
    return [
      'Áreas que faltan por revisar:',
      ...areas.map((a) => `• ${a}`),
      '',
      base,
    ].join('\n');
  }
  return base;
}

/**
 * Lanza FlowValidationError con mensaje formateado (para mutateAsync).
 * Si el cuerpo no trae `error` ni `details.pendingAreas`, usa `fallbackMessage`.
 */
export function throwFlowApiError(body: unknown, fallbackMessage = 'Error en la operación'): never {
  const b = body as { error?: string; details?: { pendingAreas?: unknown } };
  const hasServerMsg = typeof b.error === 'string' && b.error.length > 0;
  const hasAreas = normalizePendingAreas(b.details?.pendingAreas).length > 0;
  if (!hasServerMsg && !hasAreas) {
    throw new FlowValidationError(fallbackMessage);
  }
  throw new FlowValidationError(formatFlowApiError(body));
}
