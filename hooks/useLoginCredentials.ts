'use client';

import { useState, useEffect, useCallback } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

export function useLoginCredentials() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawCallbackUrl = searchParams.get('callbackUrl') || '/';
  const callbackUrl =
    rawCallbackUrl.startsWith('/login') || rawCallbackUrl === 'undefined' ? '/' : rawCallbackUrl;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const registeredSuccess = searchParams.get('registered') === '1';
  const oauthErrorFromUrl = Boolean(searchParams.get('error'));
  const displayError = error || (oauthErrorFromUrl ? 'Error al iniciar sesión' : '');

  useEffect(() => {
    if (!searchParams.has('email') && !searchParams.has('password')) return;

    const qEmail = searchParams.get('email');
    const qPassword = searchParams.get('password');
    queueMicrotask(() => {
      if (qEmail) setEmail(qEmail);
      if (qPassword) setPassword(qPassword);
    });

    const params = new URLSearchParams();
    const cb = searchParams.get('callbackUrl');
    if (cb) params.set('callbackUrl', cb);
    const errParam = searchParams.get('error');
    if (errParam) params.set('error', errParam);
    if (searchParams.get('registered') === '1') params.set('registered', '1');
    const qs = params.toString();
    router.replace(qs ? `/login?${qs}` : '/login', { scroll: false });
  }, [searchParams, router]);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setIsLoading(true);

      try {
        const result = await signIn('credentials', {
          email,
          password,
          redirect: false,
          callbackUrl,
        });

        if (result?.error) {
          const err = result.error;
          if (err === 'CredentialsSignin' || err === 'Credenciales inválidas') {
            setError('Credenciales inválidas');
          } else {
            setError('Error al iniciar sesión');
          }
          setIsLoading(false);
          return;
        }

        router.push(callbackUrl);
        router.refresh();
      } catch {
        setError('Error al iniciar sesión');
        setIsLoading(false);
      }
    },
    [email, password, callbackUrl, router]
  );

  return {
    email,
    password,
    setEmail,
    setPassword,
    error: displayError,
    isLoading,
    submit,
    callbackUrl,
    registeredSuccess,
  };
}
