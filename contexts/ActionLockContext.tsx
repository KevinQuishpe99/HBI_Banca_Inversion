'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

type ActionLockContextValue = {
  isLocked: boolean;
  message: string;
  runLocked: <T>(message: string, fn: () => Promise<T>) => Promise<T>;
};

type MutationLockSnapshot = {
  pendingCount: number;
  message: string;
};

const ActionLockContext = createContext<ActionLockContextValue | null>(null);

const DEFAULT_MESSAGE = 'Procesando, espere por favor…';

function getMutationLockSnapshot(cache: ReturnType<QueryClient['getMutationCache']>): MutationLockSnapshot {
  const pending = cache.getAll().filter((m) => m.state.status === 'pending');
  const metaMsg = pending
    .map((m) => (m.options.meta as { lockMessage?: string } | undefined)?.lockMessage)
    .find((m) => typeof m === 'string' && m.trim());
  return {
    pendingCount: pending.length,
    message:
      typeof metaMsg === 'string' && metaMsg.trim()
        ? metaMsg.trim()
        : pending.length > 0
          ? DEFAULT_MESSAGE
          : DEFAULT_MESSAGE,
  };
}

export function ActionLockProvider({
  children,
  queryClient,
}: {
  children: ReactNode;
  queryClient: QueryClient;
}) {
  const [manualCount, setManualCount] = useState(0);
  const [manualMessage, setManualMessage] = useState(DEFAULT_MESSAGE);
  const [mutationLock, setMutationLock] = useState<MutationLockSnapshot>(() =>
    getMutationLockSnapshot(queryClient.getMutationCache())
  );

  useEffect(() => {
    const cache = queryClient.getMutationCache();
    const syncSnapshot = () => {
      const next = getMutationLockSnapshot(cache);
      setMutationLock((prev) =>
        prev.pendingCount === next.pendingCount && prev.message === next.message ? prev : next
      );
    };
    syncSnapshot();
    return cache.subscribe(syncSnapshot);
  }, [queryClient]);

  const isLocked = manualCount > 0 || mutationLock.pendingCount > 0;
  const message = manualCount > 0 ? manualMessage : mutationLock.message;

  const runLocked = useCallback(async <T,>(lockMessage: string, fn: () => Promise<T>): Promise<T> => {
    setManualMessage(lockMessage);
    setManualCount((c) => c + 1);
    try {
      return await fn();
    } finally {
      setManualCount((c) => Math.max(0, c - 1));
    }
  }, []);

  const value = useMemo(
    () => ({ isLocked, message, runLocked }),
    [isLocked, message, runLocked]
  );

  return (
    <ActionLockContext.Provider value={value}>
      {children}
      {isLocked ? (
        <div
          className="fixed inset-0 z-[250] flex items-center justify-center bg-black/45 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-busy="true"
          aria-live="assertive"
          aria-label={message}
        >
          <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-xl bg-white px-8 py-7 shadow-2xl">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" aria-hidden />
            <p className="text-center text-base font-medium text-gray-900">{message}</p>
            <p className="text-center text-sm text-gray-500">No cierre ni recargue esta página.</p>
          </div>
        </div>
      ) : null}
    </ActionLockContext.Provider>
  );
}

export function useActionLock(): ActionLockContextValue {
  const ctx = useContext(ActionLockContext);
  if (!ctx) {
    throw new Error('useActionLock debe usarse dentro de ActionLockProvider');
  }
  return ctx;
}
