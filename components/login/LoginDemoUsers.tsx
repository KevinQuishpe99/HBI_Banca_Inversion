'use client';

import { useState, useCallback } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2, UserCircle2 } from 'lucide-react';
import { DEMO_PASSWORD, DEMO_USUARIO_PRINCIPAL, isDemoAuthEnabled } from '@/lib/auth/demo-users';

type Props = {
  callbackUrl: string;
};

export function LoginDemoUsers({ callbackUrl }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const usuario = DEMO_USUARIO_PRINCIPAL;

  const loginAs = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const result = await signIn('credentials', {
        email: usuario.email,
        password: DEMO_PASSWORD,
        redirect: false,
        callbackUrl,
      });
      if (result?.error) {
        setError('No se pudo iniciar sesión.');
        setLoading(false);
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError('Error al iniciar sesión.');
      setLoading(false);
    }
  }, [callbackUrl, router, usuario.email]);

  if (!isDemoAuthEnabled()) return null;

  return (
    <div className="mt-6 border-t border-slate-200 pt-6">
      <p className="text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
        Acceso demo HBI
      </p>
      <div className="mt-3">
        <button
          type="button"
          disabled={loading}
          onClick={() => void loginAs()}
          className="flex w-full items-center gap-3 rounded-xl border-2 border-[var(--color-brand-primary)] bg-[var(--color-brand-accent)]/40 px-4 py-3 text-left transition-colors hover:bg-[var(--color-brand-accent)]/70 disabled:opacity-60"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[var(--color-brand-primary)] shadow-sm">
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <UserCircle2 className="h-6 w-6" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-900">
              Entrar como {usuario.nombre} {usuario.apellido}
            </span>
            <span className="block text-xs text-slate-600">{usuario.descripcion}</span>
            <span className="mt-1 block font-mono text-xs text-slate-500">{usuario.email}</span>
          </span>
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-slate-500">
        Un clic para entrar · contraseña manual:{' '}
        <code className="rounded bg-slate-100 px-1">{DEMO_PASSWORD}</code>
      </p>
      {error ? <p className="mt-2 text-center text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
