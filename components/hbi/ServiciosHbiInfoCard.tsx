'use client';

import { FileText, Shield, Calculator } from 'lucide-react';
import { usaDatosQuemadosHbi } from '@/lib/hbi/mock-config';

const SERVICIOS = [
  {
    icon: FileText,
    titulo: 'Anexo 1 — Agente administrativo',
    texto:
      'Gestión contractual, desembolsos por fases del proyecto, reportes al sindicato y comunicación con deudor y acreedores.',
  },
  {
    icon: Shield,
    titulo: 'Anexo 2 — Garantías',
    texto:
      'Seguimiento de garantías reales/personales, certificaciones de cumplimiento y liberación condicionada a hitos.',
  },
  {
    icon: Calculator,
    titulo: 'Anexo 3 — Cálculo',
    texto:
      'Cronogramas, tasas, cuotas y validación de cálculos financieros del crédito sindicado.',
  },
] as const;

export function ServiciosHbiInfoCard() {
  if (!usaDatosQuemadosHbi()) return null;

  return (
    <section className="rounded-xl border border-[var(--color-brand-border)] bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">
        Rol de HBI como agente de financiación
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        En créditos sindicados, HBI actúa como intermediario: el deudor recibe recursos, los
        acreedores aportan capital y HBI administra contratos, comunicaciones, expediente y
        desembolsos auditados por fase (especialmente en proyectos de gran envergadura).
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <article className="rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-accent)]/30 p-3">
          <p className="text-lg font-bold text-[var(--color-brand-primary)]">+20 años</p>
          <p className="text-xs text-slate-600">experiencia en el mercado latinoamericano</p>
        </article>
        <article className="rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-accent)]/30 p-3">
          <p className="text-lg font-bold text-[var(--color-brand-primary)]">US$ 1,200M+</p>
          <p className="text-xs text-slate-600">cierres financieros exitosos reportados por HBI</p>
        </article>
        <article className="rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-accent)]/30 p-3">
          <p className="text-lg font-bold text-[var(--color-brand-primary)]">5 países</p>
          <p className="text-xs text-slate-600">alianzas estratégicas en Latam + EE.UU.</p>
        </article>
      </div>
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
      <p className="mt-4 text-xs text-slate-500">
        Referencia de contenido institucional: hbi.com.co
      </p>
    </section>
  );
}
