'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils/cn';
import { ComwareLogo } from '@/components/brand/ComwareLogo';
import {
  getComwareEmailRegistrationHint,
  isComwareRegistrationEmail,
} from '@/lib/auth/registration-email';
import { UI_COPY } from '@/lib/ui-copy';

type AreaOption = { area: string; label: string };

export function RegisterForm() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [area, setArea] = useState('');
  const [areaOptions, setAreaOptions] = useState<AreaOption[]>([]);
  const [areasLoading, setAreasLoading] = useState(true);
  const [areasError, setAreasError] = useState('');
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setAreasLoading(true);
      setAreasError('');
      try {
        const res = await fetch('/api/meta/areas');
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setAreasError('No se pudieron cargar las áreas. Intente más tarde o contacte a administración.');
          setAreaOptions([]);
          return;
        }
        const rows = Array.isArray(json?.data) ? json.data : [];
        // Misma regla que en administración de áreas: solo "Seleccionable" para quien se registra solo.
        const opts = rows
          .filter(
            (x: { area?: string; label?: string; isSelectable?: boolean }) =>
              Boolean(x?.area && x?.label && x.isSelectable === true)
          )
          .map((x: { area: string; label: string }) => ({ area: x.area, label: x.label }));
        setAreaOptions(opts);
        if (opts.length === 0) {
          setAreasError(
            'No hay áreas disponibles para autoregistro (deben estar activas y marcadas como seleccionables). Contacte a administración.'
          );
        }
      } catch {
        if (!cancelled) {
          setAreasError('No se pudieron cargar las áreas. Revise su conexión.');
          setAreaOptions([]);
        }
      } finally {
        if (!cancelled) setAreasLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function syncEmailValidation(value: string) {
    const t = value.trim();
    if (!t) {
      setEmailError('');
      return;
    }
    if (isComwareRegistrationEmail(t)) {
      setEmailError('');
      return;
    }
    const hint = getComwareEmailRegistrationHint(value);
    if (hint) setEmailError(hint);
    else setEmailError('');
  }

  function onEmailBlur() {
    const t = email.trim();
    if (!t) {
      setEmailError('');
      return;
    }
    if (isComwareRegistrationEmail(t)) {
      setEmailError('');
      return;
    }
    setEmailError('Usa un correo @comware.com.ec.');
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!isComwareRegistrationEmail(email.trim())) {
      setEmailError('Usa un correo @comware.com.ec.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (!area.trim()) {
      setError('Debe seleccionar el área a la que pertenece.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          password,
          area,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setError(typeof json.error === 'string' ? json.error : 'No se pudo registrar. Intenta de nuevo.');
        setIsLoading(false);
        return;
      }
      router.push(`/login?registered=1&email=${encodeURIComponent(email.trim())}`);
    } catch {
      setError('Error de red. Intenta de nuevo.');
      setIsLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-100 via-sky-50/90 to-indigo-100 px-4 py-12 sm:px-6 lg:px-8">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgb(148 163 184 / 0.35) 1px, transparent 0)`,
          backgroundSize: '24px 24px',
        }}
        aria-hidden
      />
      <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-sky-300/30 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-20 -right-16 h-80 w-80 rounded-full bg-indigo-300/25 blur-3xl" aria-hidden />

      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-2xl border border-slate-200/90 bg-white/95 p-8 shadow-[0_25px_50px_-12px_rgba(15,23,42,0.18)] ring-1 ring-slate-900/5 backdrop-blur-sm sm:p-10 [color-scheme:light]">
          <div className="space-y-6">
            <div className="space-y-5 text-center">
              <ComwareLogo variant="login" />
              <div className="space-y-1">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Crear cuenta</h1>
                <p className="text-sm text-slate-600">{UI_COPY.appName}</p>
              </div>
            </div>

            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="firstName">Nombre</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    autoComplete="given-name"
                    required
                    minLength={2}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Apellido</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    autoComplete="family-name"
                    required
                    minLength={2}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => {
                    const v = e.target.value;
                    setEmail(v);
                    syncEmailValidation(v);
                  }}
                  onBlur={onEmailBlur}
                  placeholder="nombre@comware.com.ec"
                  aria-invalid={emailError ? true : undefined}
                  className={cn(emailError && 'border-red-500 focus-visible:ring-red-500')}
                />
                {emailError ? (
                  <p className="mt-1.5 text-xs text-red-600" role="alert">
                    {emailError}
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-slate-500">
                    Solo correos corporativos Comware (p. ej.{' '}
                    <span className="whitespace-nowrap">@comware.com.ec</span>).
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="area">
                  Área <span className="text-red-600">*</span>
                </Label>
                <select
                  id="area"
                  name="area"
                  required
                  value={area}
                  disabled={areasLoading || areaOptions.length === 0}
                  onChange={(e) => setArea(e.target.value)}
                  aria-invalid={areasError ? true : undefined}
                  aria-busy={areasLoading}
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <option value="" disabled>
                    {areasLoading ? 'Cargando áreas…' : 'Seleccione su área…'}
                  </option>
                  {areaOptions.map((o) => (
                    <option key={o.area} value={o.area}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {areasError ? (
                  <p className="mt-1.5 text-xs text-red-600" role="alert">
                    {areasError}
                  </p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="confirm">Confirmar contraseña</Label>
                <Input
                  id="confirm"
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>

              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <Button
                type="submit"
                className="w-full"
                disabled={
                  isLoading ||
                  !!emailError ||
                  areasLoading ||
                  areaOptions.length === 0 ||
                  !area.trim()
                }
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  'Registrarse'
                )}
              </Button>
            </form>

            <p className="text-center text-sm text-slate-600">
              ¿Ya tienes cuenta?{' '}
              <Link href="/login" className="font-medium text-sky-700 underline underline-offset-2 hover:text-sky-800">
                Iniciar sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
