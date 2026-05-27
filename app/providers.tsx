'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { useState } from 'react';
import { ActionLockProvider } from '@/contexts/ActionLockContext';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            gcTime: 5 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            meta: { lockMessage: 'Procesando, espere por favor…' },
          },
        },
      })
  );

  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <QueryClientProvider client={queryClient}>
        <ActionLockProvider queryClient={queryClient}>{children}</ActionLockProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
