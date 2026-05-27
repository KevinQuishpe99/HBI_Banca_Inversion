'use client';

import { useState } from 'react';
import { Loader2, Mail, MailPlus } from 'lucide-react';
import { useHbiCorreos, useRegistrarCorreoHbi } from '@/hooks/useHbiOperaciones';

const ORIGENES = ['AGENTE_HBI', 'DEUDOR', 'ACREEDOR', 'OTRO'] as const;
const PRIORIDADES = ['BAJA', 'MEDIA', 'ALTA', 'URGENTE'] as const;

type Props = { operacionId: string };

export function Fase2CorreosPanel({ operacionId }: Props) {
  const { data: correos, isLoading } = useHbiCorreos(operacionId);
  const registrar = useRegistrarCorreoHbi(operacionId);
  const [remitente, setRemitente] = useState('');
  const [asunto, setAsunto] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [origen, setOrigen] = useState<string>('');
  const [prioridad, setPrioridad] = useState<string>('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await registrar.mutateAsync({
      remitente,
      asunto,
      cuerpoResumen: cuerpo || undefined,
      origen: origen || undefined,
      prioridad: prioridad || undefined,
    });
    setRemitente('');
    setAsunto('');
    setCuerpo('');
  };

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h3 className="font-semibold text-slate-900">Fase 2 — Bandeja de correos por operación</h3>
        <p className="mt-1 text-sm text-slate-600">
          Canal único: Agente–HBI, Deudor y Acreedores. Remitente, tema y prioridad identificados automáticamente.
        </p>
      </div>

      <form onSubmit={onSubmit} className="grid gap-3 rounded-lg border border-dashed border-indigo-200 bg-indigo-50/50 p-4 sm:grid-cols-2">
        <input
          required
          placeholder="Remitente (correo o nombre)"
          value={remitente}
          onChange={(e) => setRemitente(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
        />
        <input
          required
          placeholder="Asunto"
          value={asunto}
          onChange={(e) => setAsunto(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
        />
        <select
          value={origen}
          onChange={(e) => setOrigen(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Origen (auto)</option>
          {ORIGENES.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <select
          value={prioridad}
          onChange={(e) => setPrioridad(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Prioridad (auto)</option>
          {PRIORIDADES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <textarea
          placeholder="Resumen del mensaje (opcional)"
          value={cuerpo}
          onChange={(e) => setCuerpo(e.target.value)}
          rows={2}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
        />
        <button
          type="submit"
          disabled={registrar.isPending}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white sm:col-span-2"
        >
          {registrar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailPlus className="h-4 w-4" />}
          Registrar en bandeja
        </button>
      </form>

      {isLoading ? (
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-indigo-600" />
      ) : (
        <ul className="max-h-80 space-y-2 overflow-y-auto">
          {correos?.length === 0 ? (
            <li className="text-sm text-slate-500">Bandeja vacía — registre el primer correo de la operación.</li>
          ) : (
            correos?.map((c) => (
              <li
                key={c.id}
                className={[
                  'rounded-lg border px-3 py-2 text-sm',
                  c.prioridad === 'URGENTE' ? 'border-red-200 bg-red-50' : 'border-slate-100 bg-slate-50',
                  !c.leido ? 'ring-1 ring-blue-200' : '',
                ].join(' ')}
              >
                <div className="flex items-start gap-2">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{c.asunto}</p>
                    <p className="text-xs text-slate-500">
                      {c.remitente} · {c.origen} · {c.prioridad}
                      {!c.leido ? ' · No leído' : ''}
                    </p>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
