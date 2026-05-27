'use client';

import { useState } from 'react';
import { FileText, Loader2, Mail, Download } from 'lucide-react';
import {
  useEnviarReporteSindicato,
  useGenerarReporteSindicato,
} from '@/hooks/useHbiIbAvanzado';
import { formatearMonto } from '@/lib/hbi/hitos-plantilla';
import type { ReporteSindicato } from '@/types/hbi/ib-avanzado.types';

type Props = { operacionId: string; codigoOperacion: string };

export function ReporteSindicatoPanel({ operacionId, codigoOperacion }: Props) {
  const generar = useGenerarReporteSindicato(operacionId);
  const enviar = useEnviarReporteSindicato(operacionId);
  const [reporte, setReporte] = useState<ReporteSindicato | null>(null);

  const handleGenerar = async () => {
    const r = await generar.mutateAsync();
    setReporte(r);
  };

  const handleEnviar = async () => {
    if (!reporte) return;
    const enviado = await enviar.mutateAsync(reporte);
    setReporte(enviado);
  };

  const handleDescargar = () => {
    if (!reporte) return;
    const texto = [
      `REPORTE AL SINDICADO — ${codigoOperacion}`,
      `Periodo: ${reporte.periodo}`,
      `Generado: ${new Date(reporte.generadoEn).toLocaleString('es-CO')}`,
      '',
      reporte.resumenEjecutivo,
      '',
      'MÉTRICAS',
      `- Saldo vigente: ${formatearMonto(reporte.metricas.saldoVigente, 'USD')}`,
      `- Desembolsado: ${formatearMonto(reporte.metricas.desembolsado, 'USD')}`,
      `- Por desembolsar: ${formatearMonto(reporte.metricas.porDesembolsar, 'USD')}`,
      `- Covenants en riesgo: ${reporte.metricas.covenantsEnRiesgo}`,
      `- Obligaciones vencidas: ${reporte.metricas.obligacionesVencidas}`,
      '',
      'DESTINATARIOS',
      ...reporte.destinatarios.map((d) => `- ${d}`),
    ].join('\n');
    const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-sindicado-${codigoOperacion}-${reporte.periodo.replace(/\s/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-slate-900">Reporte al sindicado de acreedores</h3>
        <p className="mt-1 text-sm text-slate-600">
          Informe periódico con métricas de cartera, covenants y obligaciones — entregable estándar del agente
          administrativo (Anexo 1).
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleGenerar()}
          disabled={generar.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {generar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          Generar reporte Q actual
        </button>
        {reporte ? (
          <>
            <button
              type="button"
              onClick={handleDescargar}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Descargar .txt
            </button>
            {!reporte.enviado ? (
              <button
                type="button"
                onClick={() => void handleEnviar()}
                disabled={enviar.isPending}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
              >
                {enviar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Enviar al sindicado (demo)
              </button>
            ) : (
              <span className="inline-flex items-center rounded-lg bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-800">
                Enviado al sindicado
              </span>
            )}
          </>
        ) : null}
      </div>

      {reporte ? (
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <header className="border-b border-slate-100 pb-3">
            <p className="font-mono text-sm text-blue-700">{codigoOperacion}</p>
            <h4 className="text-lg font-semibold text-slate-900">Reporte {reporte.periodo}</h4>
            <p className="text-xs text-slate-500">
              Generado por {reporte.generadoPor} · {new Date(reporte.generadoEn).toLocaleString('es-CO')}
            </p>
          </header>
          <p className="mt-4 text-sm leading-relaxed text-slate-700">{reporte.resumenEjecutivo}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Metrica label="Saldo vigente" value={formatearMonto(reporte.metricas.saldoVigente, 'USD')} />
            <Metrica label="Desembolsado" value={formatearMonto(reporte.metricas.desembolsado, 'USD')} />
            <Metrica label="Por desembolsar" value={formatearMonto(reporte.metricas.porDesembolsar, 'USD')} />
            <Metrica label="Covenants en riesgo" value={String(reporte.metricas.covenantsEnRiesgo)} />
            <Metrica label="Obligaciones vencidas" value={String(reporte.metricas.obligacionesVencidas)} />
            <Metrica label="Destinatarios" value={String(reporte.destinatarios.length)} />
          </div>
          {reporte.destinatarios.length > 0 ? (
            <ul className="mt-4 text-sm text-slate-600">
              {reporte.destinatarios.map((d) => (
                <li key={d}>· {d}</li>
              ))}
            </ul>
          ) : null}
        </article>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
          Genere un reporte para previsualizar el informe al sindicado.
        </div>
      )}
    </div>
  );
}

function Metrica({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{value}</p>
    </div>
  );
}
