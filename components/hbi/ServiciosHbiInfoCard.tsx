'use client';

import { FileText, Shield, Calculator } from 'lucide-react';
import { usaDatosQuemadosHbi } from '@/lib/hbi/mock-config';
import { AGENTE_FINANCIACION_HBI } from '@/types/hbi/operacion.types';

const SERVICIOS = [
  {
    icon: FileText,
    titulo: 'Agente Administrativo (Anexo 1)',
    texto:
      'Gestión contractual, solicitudes de desembolso por fase, reportes al sindicado y comunicación con deudor y acreedores.',
  },
  {
    icon: Shield,
    titulo: 'Agente de Garantías (Anexo 2)',
    texto:
      'Seguimiento de garantías reales y personales, certificaciones de cumplimiento y liberación condicionada a hitos del proyecto.',
  },
  {
    icon: Calculator,
    titulo: 'Agente de Cálculo (Anexo 3)',
    texto:
      'Cronogramas, tasas, certificación de saldos y validación de cálculos financieros del crédito sindicado.',
  },
] as const;

export function ServiciosHbiInfoCard() {
  if (!usaDatosQuemadosHbi()) return null;

  return (
    <section className="rounded-xl border border-[var(--color-brand-border)] bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{AGENTE_FINANCIACION_HBI}</h2>
      <p className="mt-2 text-sm text-slate-600">
        HBI actúa como intermediario en créditos sindicados: el deudor recibe recursos, los acreedores
        aportan capital y HBI administra el crédito mediante hasta tres servicios (Anexos 1, 2 y 3).
        Cada desembolso del proyecto exige evidencias documentales de los anexos contratados antes de
        habilitar el siguiente giro.
      </p>
      <ul className="mt-4 grid gap-4 sm:grid-cols-3">
        {SERVICIOS.map((s) => {
          const Icon = s.icon;
          return (
            <li
              key={s.titulo}
              className="rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-accent)]/30 p-4"
            >
              <Icon className="h-6 w-6 text-[var(--color-brand-primary)]" />
              <p className="mt-2 text-sm font-medium text-slate-900">{s.titulo}</p>
              <p className="mt-1 text-xs text-slate-600">{s.texto}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
