'use client';

import { signIn } from 'next-auth/react';

type Props = {
  callbackUrl: string;
  /** Microsoft arriba del formulario de correo/contraseña local, o debajo. */
  placement?: 'top' | 'bottom';
};

/** Botón solo si NEXT_PUBLIC_MICROSOFT_LOGIN_ENABLED=true (el servidor debe tener AZURE_AUTH_*). */
export function LoginMicrosoftButton({ callbackUrl, placement = 'top' }: Props) {
  if (process.env.NEXT_PUBLIC_MICROSOFT_LOGIN_ENABLED !== 'true') {
    return null;
  }

  const button = (
    <button
      type="button"
      onClick={() => void signIn('azure-ad', { callbackUrl })}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
    >
      <MicrosoftLogo className="h-5 w-5 shrink-0" aria-hidden />
      Iniciar sesión con Microsoft
    </button>
  );

  if (placement === 'top') {
    return <div>{button}</div>;
  }

  return (
    <div className="space-y-3">
      <div className="relative py-1">
        <div className="absolute inset-x-0 top-1/2 border-t border-slate-200" aria-hidden />
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-2 text-slate-500">o continúe con</span>
        </div>
      </div>
      {button}
    </div>
  );
}

function MicrosoftLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}
