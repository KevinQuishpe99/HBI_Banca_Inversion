'use client';

import { useState, useCallback } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2, UserCircle2 } from 'lucide-react';
import { DEMO_PASSWORD, DEMO_USERS, isDemoAuthEnabled } from '@/lib/auth/demo-users';

type Props = {
  callbackUrl: string;
};

export function LoginDemoUsers({ callbackUrl }: Props) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loginAs = useCallback(
    async (userId: string, email: string) => {
      setError('');
      setLoadingId(userId);
      try {
        const result = await signIn('credentials', {
          email,
          password: DEMO_PASSWORD,
          redirect: false,
          callbackUrl,
        });
        if (result?.error) {
          setError('No se pudo iniciar sesión con el usuario de prueba.');
          setLoadingId(null);
          return;
        }
        router.push(callbackUrl);
        router.refresh();
      } catch {
        setError('Error al iniciar sesión.');
        setLoadingId(null);
      }
    },
    [callbackUrl, router]
  );

  if (!isDemoAuthEnabled()) return null;

  return (
    <div className="mt-6 border-t border-slate-200 pt-6">
      <p className="text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
        Usuarios de prueba
      </p>
      <p className="mt-1 text-center text-xs text-slate-500">
        Clic para entrar sin escribir contraseña · contraseña manual:{' '}
        <code className="rounded bg-slate-100 px-1">{DEMO_PASSWORD}</code>
      </p>
      <ul className="mt-3 space-y-2">
        {DEMO_USERS.map((u) => (
          <li key={u.id}>
            <button
              type="button"
              disabled={loadingId !== null}
              onClick={() => loginAs(u.id, u.email)}
              className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-accent)]/30 px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-brand-accent)]/60 disabled:opacity-60"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[var(--color-brand-primary)] shadow-sm">
                {loadingId === u.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserCircle2 className="h-5 w-5" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-900">
                  {u.nombre} {u.apellido}
                </span>
                <span className="block truncate text-xs text-slate-600">{u.descripcion}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {error ? <p className="mt-2 text-center text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
