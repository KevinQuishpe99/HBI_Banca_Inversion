'use client';

import { Calculator, ChevronDown, ChevronUp, FileText, Shield } from 'lucide-react';
import { GUIA_ANEXOS } from '@/lib/hbi/anexos-guia';
import { AGENTE_FINANCIACION_HBI, TIPOS_SERVICIO_LABEL } from '@/types/hbi/operacion.types';
import type { TipoServicioHbi } from '@/types/hbi/operacion.types';

const ICONO_ANEXO = {
  ANEXO_1_ADMINISTRATIVO: FileText,
  ANEXO_2_GARANTIAS: Shield,
  ANEXO_3_CALCULO: Calculator,
} as const;

const TODOS_SERVICIOS: TipoServicioHbi[] = [
  'ANEXO_1_ADMINISTRATIVO',
  'ANEXO_2_GARANTIAS',
  'ANEXO_3_CALCULO',
];

type Props = {
  servicios: TipoServicioHbi[];
  onToggle: (codigo: TipoServicioHbi) => void;
  onSeleccionarTodos?: () => void;
  anexoExpandido: TipoServicioHbi | null;
  onToggleExpandir: (codigo: TipoServicioHbi | null) => void;
  /** Muestra qué evidencias exige cada desembolso según servicios activos */
  mostrarEvidenciasDesembolso?: boolean;
};

export function ServiciosHbiContratacion({
  servicios,
  onToggle,
  onSeleccionarTodos,
  anexoExpandido,
  onToggleExpandir,
  mostrarEvidenciasDesembolso = true,
}: Props) {
  const todosActivos = TODOS_SERVICIOS.every((s) => servicios.includes(s));

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5">
        <h3 className="text-base font-semibold text-indigo-900">{AGENTE_FINANCIACION_HBI}</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">
          En un <strong>crédito sindicado</strong>, el deudor recibe los recursos y varios acreedores
          aportan el capital. HBI actúa como <strong>agente de financiación</strong> administrando el
          crédito mediante uno, dos o los tres servicios siguientes (contratos Anexo 1, 2 y 3).
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {TODOS_SERVICIOS.map((s) => (
            <span
              key={s}
              className={[
                'rounded-full px-3 py-1 text-xs font-medium',
                servicios.includes(s)
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-500 ring-1 ring-slate-200',
              ].join(' ')}
            >
              {TIPOS_SERVICIO_LABEL[s]}
            </span>
          ))}
        </div>
        {onSeleccionarTodos && !todosActivos ? (
          <button
            type="button"
            onClick={onSeleccionarTodos}
            className="mt-3 text-sm font-medium text-indigo-700 hover:underline"
          >
            Seleccionar los 3 servicios (recomendado en sindicados)
          </button>
        ) : null}
      </div>

      {mostrarEvidenciasDesembolso && servicios.length > 0 ? (
        <aside className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
          <p className="font-medium">Por cada desembolso del proyecto deberá cargar evidencias de:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {servicios.includes('ANEXO_1_ADMINISTRATIVO') ? (
              <li>Agente Administrativo (Anexo 1) — solicitud y reportes</li>
            ) : null}
            {servicios.includes('ANEXO_2_GARANTIAS') ? (
              <li>Agente de Garantías (Anexo 2) — certificación de pólizas</li>
            ) : null}
            {servicios.includes('ANEXO_3_CALCULO') ? (
              <li>Agente de Cálculo (Anexo 3) — cronograma y saldos</li>
            ) : null}
          </ul>
          <p className="mt-2 text-xs text-amber-800">
            Sin completar evidencias y checklist, no se habilita el siguiente desembolso.
          </p>
        </aside>
      ) : null}

      {GUIA_ANEXOS.map((g) => {
        const Icon = ICONO_ANEXO[g.codigo];
        const activo = servicios.includes(g.codigo);
        const expandido = anexoExpandido === g.codigo;
        return (
          <article
            key={g.codigo}
            className={[
              'rounded-xl border transition',
              activo
                ? 'border-[var(--color-brand-primary)]/50 bg-[var(--color-brand-accent)]/25 shadow-sm'
                : 'border-slate-200 bg-white',
            ].join(' ')}
          >
            <div className="flex items-start gap-3 p-4">
              <input
                type="checkbox"
                checked={activo}
                onChange={() => onToggle(g.codigo)}
                className="mt-1 h-4 w-4 rounded border-slate-300"
                aria-label={`Contratar ${g.titulo}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Icon className="h-5 w-5 text-[var(--color-brand-primary)]" />
                  <p className="font-semibold text-slate-900">{g.titulo}</p>
                  {activo ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                      Contratado
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-slate-600">{g.resumen}</p>
                <button
                  type="button"
                  onClick={() => onToggleExpandir(expandido ? null : g.codigo)}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-brand-primary)]"
                >
                  {expandido ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {expandido ? 'Ocultar detalle' : 'Ver responsabilidades y documentos'}
                </button>
                {expandido ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">Responsabilidades</p>
                      <ul className="mt-1 space-y-1">
                        {g.responsabilidades.map((r) => (
                          <li key={r} className="text-xs text-slate-700">
                            ✓ {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">Documentos clave</p>
                      <ul className="mt-1 space-y-1">
                        {g.documentosClave.map((d) => (
                          <li key={d} className="text-xs text-slate-700">
                            📄 {d}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export { TODOS_SERVICIOS as SERVICIOS_HBI_TODOS };
