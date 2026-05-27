'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { usaDatosQuemadosHbi } from '@/lib/hbi/mock-config';
import { setMockUsuarioActivo } from '@/lib/hbi/mock-store';

/** Enlaza la sesión NextAuth con el actor de trazabilidad del mock store. */
export function MockSessionBridge() {
  const { data } = useSession();

  useEffect(() => {
    if (!usaDatosQuemadosHbi()) return;
    const nombre = data?.user?.name?.trim();
    if (nombre) setMockUsuarioActivo(nombre);
  }, [data?.user?.name]);

  return null;
}
