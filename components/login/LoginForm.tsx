'use client';

import Link from 'next/link';
import { LoginHeader } from './LoginHeader';
import { LoginCredentialsForm } from './LoginCredentialsForm';
import { LoginMicrosoftButton } from './LoginMicrosoftButton';
import { LoginDemoUsers } from './LoginDemoUsers';
import { useLoginCredentials } from '@/hooks/useLoginCredentials';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UI_COPY } from '@/lib/ui-copy';
import { isDemoAuthEnabled } from '@/lib/auth/demo-users';

export function LoginForm() {
  const {
    email,
    password,
    setEmail,
    setPassword,
    error,
    isLoading,
    submit,
    callbackUrl,
    registeredSuccess,
  } = useLoginCredentials();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-100 via-[var(--color-brand-accent)]/70 to-white px-4 py-12 sm:px-6 lg:px-8">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgb(148 163 184 / 0.35) 1px, transparent 0)`,
          backgroundSize: '24px 24px',
        }}
        aria-hidden
      />
      <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-[var(--color-brand-accent)]/70 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-20 -right-16 h-80 w-80 rounded-full bg-[var(--color-brand-secondary)]/20 blur-3xl" aria-hidden />

      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-2xl border border-slate-200/90 bg-white/95 p-8 shadow-[0_25px_50px_-12px_rgba(15,23,42,0.18)] ring-1 ring-slate-900/5 backdrop-blur-sm sm:p-10 [color-scheme:light]">
          <div className="space-y-8">
            <LoginHeader />
            {registeredSuccess ? (
              <Alert className="border-emerald-200 bg-emerald-50 text-emerald-950">
                <AlertDescription>{UI_COPY.loginAfterRegister}</AlertDescription>
              </Alert>
            ) : null}
            <LoginMicrosoftButton callbackUrl={callbackUrl} placement="top" />
            <LoginCredentialsForm
              email={email}
              password={password}
              onEmailChange={setEmail}
              onPasswordChange={setPassword}
              error={error || null}
              isLoading={isLoading}
              onSubmit={submit}
            />
            {!isDemoAuthEnabled() ? (
              <p className="text-center text-sm text-slate-600">
                ¿No tienes cuenta?{' '}
                <Link
                  href="/register"
                  className="font-medium text-[var(--color-brand-primary)] underline underline-offset-2 hover:text-[var(--color-brand-primary-hover)]"
                >
                  Regístrate
                </Link>
              </p>
            ) : null}
            <LoginDemoUsers callbackUrl={callbackUrl} />
          </div>
        </div>
      </div>
    </div>
  );
}
