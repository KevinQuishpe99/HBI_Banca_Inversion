import type { UserRole } from '@/types/user.types';

/** Usuario de demostración (sin base de datos). */
export interface DemoUser {
  id: string;
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  rol: UserRole;
  areaName?: string;
  puedeFirmar?: boolean;
  descripcion: string;
  servicioHbi?: 'ANEXO_1' | 'ANEXO_2' | 'ANEXO_3' | 'GESTION' | 'DEUDOR' | 'ACREEDOR';
}

/** Credenciales compartidas del demo (solo entorno de demostración). */
export const DEMO_PASSWORD = 'Demo2026!';

export const DEMO_USERS: DemoUser[] = [
  {
    id: 'demo-user-maria',
    email: 'maria.gonzalez@hbi-demo.com',
    password: DEMO_PASSWORD,
    nombre: 'María',
    apellido: 'González',
    rol: 'USER',
    areaName: 'Agente Administrativo',
    descripcion: 'Analista HBI — Anexo 1 (administración y desembolsos)',
    servicioHbi: 'ANEXO_1',
  },
  {
    id: 'demo-user-carlos',
    email: 'carlos.ruiz@hbi-demo.com',
    password: DEMO_PASSWORD,
    nombre: 'Carlos',
    apellido: 'Ruiz',
    rol: 'USER',
    areaName: 'Garantías',
    descripcion: 'Especialista — Anexo 2 (garantías y cumplimiento)',
    servicioHbi: 'ANEXO_2',
  },
  {
    id: 'demo-user-ana',
    email: 'ana.torres@hbi-demo.com',
    password: DEMO_PASSWORD,
    nombre: 'Ana',
    apellido: 'Torres',
    rol: 'USER',
    areaName: 'Cálculo financiero',
    descripcion: 'Analista — Anexo 3 (cálculo, tasas y cronogramas)',
    servicioHbi: 'ANEXO_3',
  },
  {
    id: 'demo-user-director',
    email: 'director@hbi-demo.com',
    password: DEMO_PASSWORD,
    nombre: 'Roberto',
    apellido: 'Vega',
    rol: 'ADMIN',
    puedeFirmar: true,
    descripcion: 'Director — vista completa del agente de financiación',
    servicioHbi: 'GESTION',
  },
  {
    id: 'demo-user-deudor',
    email: 'deudor@hbi-demo.com',
    password: DEMO_PASSWORD,
    nombre: 'Laura',
    apellido: 'Muñoz',
    rol: 'USER',
    areaName: 'Cliente deudor',
    descripcion: 'Perfil cliente deudor — seguimiento de desembolsos por hitos',
    servicioHbi: 'DEUDOR',
  },
  {
    id: 'demo-user-acreedor',
    email: 'acreedor@hbi-demo.com',
    password: DEMO_PASSWORD,
    nombre: 'Felipe',
    apellido: 'Restrepo',
    rol: 'USER',
    areaName: 'Acreedor sindicado',
    descripcion: 'Perfil acreedor — control contractual y reportes de cumplimiento',
    servicioHbi: 'ACREEDOR',
  },
];

/** Activo cuando no hay PostgreSQL (demo en Vercel o local). */
export function isDemoAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_HBI_MOCK_DATA !== 'false';
}

export function findDemoUser(email: string, password: string): DemoUser | null {
  if (!isDemoAuthEnabled()) return null;
  const emailNorm = email.trim().toLowerCase();
  const user = DEMO_USERS.find((u) => u.email.toLowerCase() === emailNorm);
  if (!user || user.password !== password) return null;
  return user;
}

export function demoUserToSession(user: DemoUser) {
  return {
    id: user.id,
    email: user.email,
    name: `${user.nombre} ${user.apellido}`,
    role: user.rol,
    areaName: user.areaName,
    canSign: !!user.puedeFirmar,
  };
}
