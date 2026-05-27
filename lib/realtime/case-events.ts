import { EventEmitter } from 'events';

/**
 * Bus en memoria para notificar a clientes conectados por SSE a un trámite.
 * En un solo proceso (dev / un nodo) todos los clientes reciben push al instante.
 * Con varias réplicas hace falta Redis pub/sub (futuro).
 */
const g = globalThis as unknown as { __caseRealtime?: Map<string, EventEmitter> };

function getMap(): Map<string, EventEmitter> {
  if (!g.__caseRealtime) g.__caseRealtime = new Map();
  return g.__caseRealtime;
}

const throttleUntil = new Map<string, number>();
const THROTTLE_MS = 800;

/** Suscriptor para GET /api/cases/:id/events */
export function subscribeCaseChannel(
  caseId: string,
  onData: (payload: { type: string; at: number }) => void
): () => void {
  const map = getMap();
  let em = map.get(caseId);
  if (!em) {
    em = new EventEmitter();
    em.setMaxListeners(500);
    map.set(caseId, em);
  }
  const handler = (payload: { type: string; at: number }) => onData(payload);
  em.on('update', handler);
  return () => {
    em?.off('update', handler);
    if (em && em.listenerCount('update') === 0) {
      map.delete(caseId);
    }
  };
}

/**
 * Notifica a todos los clientes escuchando este trámite (invalidar React Query en cliente).
 * Con throttle opcional para endpoints muy frecuentes (p. ej. heartbeat de presencia).
 */
export function notifyCaseSubscribers(caseId: string, opts?: { throttle?: boolean }): void {
  const now = Date.now();
  if (opts?.throttle) {
    const prev = throttleUntil.get(caseId) ?? 0;
    if (now - prev < THROTTLE_MS) return;
    throttleUntil.set(caseId, now);
  }

  const map = getMap();
  const em = map.get(caseId);
  if (!em) return;
  em.emit('update', { type: 'update', at: now });
}
