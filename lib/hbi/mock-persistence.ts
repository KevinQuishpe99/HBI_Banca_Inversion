/**
 * Persistencia del store HBI en localStorage (caché del navegador) para el demo en Vercel.
 */

const STORAGE_KEY = 'hbi-demo-store-v2';

export type PersistedMockSnapshot = {
  version: 2;
  seq: number;
  store: unknown;
  savedAt: string;
};

export function loadPersistedMockSnapshot(): PersistedMockSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedMockSnapshot;
    if (parsed?.version !== 2 || !parsed.store) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePersistedMockSnapshot(seq: number, store: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: PersistedMockSnapshot = {
      version: 2,
      seq,
      store,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota o modo privado */
  }
}

export function clearPersistedMockSnapshot(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignorar */
  }
}

export function getPersistedSavedAt(): string | null {
  return loadPersistedMockSnapshot()?.savedAt ?? null;
}
