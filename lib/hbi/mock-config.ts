import { esModoDemo } from '@/lib/demo/app-mode';

/** Datos quemados en memoria/localStorage (sin PostgreSQL). */
export function usaDatosQuemadosHbi(): boolean {
  return esModoDemo();
}
