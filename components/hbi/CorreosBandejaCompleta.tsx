'use client';

import { useState } from 'react';
import { Loader2, Mail, Send, Inbox, MailPlus } from 'lucide-react';
import {
  useHbiCorreos,
  useHbiCorreosEnviados,
  useRegistrarCorreoHbi,
  useEnviarCorreoHbi,
} from '@/hooks/useHbiOperaciones';
import { etiquetaTipoCorreoEnviado } from '@/lib/hbi/email-labels';

type Props = {
  operacionId: string;
  codigoOperacion: string;
};

export function CorreosBandejaCompleta({ operacionId, codigoOperacion }: Props) {
  const [tab, setTab] = useState<'recibidos' | 'enviados' | 'enviar'>('recibidos');
  const { data: recibidos, isLoading: loadIn } = useHbiCorreos(operacionId);
  const { data: enviadosData, isLoading: loadOut } = useHbiCorreosEnviados(operacionId);
  const registrar = useRegistrarCorreoHbi(operacionId);
  const enviar = useEnviarCorreoHbi(operacionId);

  const [remitente, setRemitente] = useState('');
  const [asunto, setAsunto] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [destinatario, setDestinatario] = useState('');
  const [asuntoOut, setAsuntoOut] = useState('');
  const [cuerpoOut, setCuerpoOut] = useState('');

  const bandejaRecibidos = recibidos?.filter((c) => c.direccion !== 'ENVIADO') ?? [];
  const bandejaEnviadosLocal = recibidos?.filter((c) => c.direccion === 'ENVIADO') ?? [];
  const historialEnviados = enviadosData?.items ?? [];

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h3 className="font-semibold text-slate-900">Comunicaciones — trazabilidad de correos</h3>
        <p className="mt-1 text-sm text-slate-600">
          Bandeja única por operación {codigoOperacion}: recibidos, enviados e historial auditado.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
        {(
          [
            { id: 'recibidos' as const, label: 'Recibidos', icon: Inbox },
            { id: 'enviados' as const, label: 'Historial enviados', icon: Send },
            { id: 'enviar' as const, label: 'Enviar correo', icon: MailPlus },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={[
              'inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium',
              tab === t.id ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-600',
            ].join(' ')}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'recibidos' ? (
        <>
          <form
            className="grid gap-2 rounded-lg border border-dashed border-indigo-200 bg-indigo-50/40 p-3 sm:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              await registrar.mutateAsync({ remitente, asunto, cuerpoResumen: cuerpo });
              setRemitente('');
              setAsunto('');
              setCuerpo('');
            }}
          >
            <p className="text-xs font-medium text-indigo-900 sm:col-span-2">
              Registrar correo recibido (Agente–HBI, Deudor, Acreedor)
            </p>
            <input
              required
              placeholder="Remitente"
              value={remitente}
              onChange={(e) => setRemitente(e.target.value)}
              className="rounded border px-2 py-1.5 text-sm sm:col-span-2"
            />
            <input
              required
              placeholder="Asunto"
              value={asunto}
              onChange={(e) => setAsunto(e.target.value)}
              className="rounded border px-2 py-1.5 text-sm sm:col-span-2"
            />
            <textarea
              placeholder="Resumen"
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
              rows={2}
              className="rounded border px-2 py-1.5 text-sm sm:col-span-2"
            />
            <button
              type="submit"
              disabled={registrar.isPending}
              className="rounded bg-indigo-600 px-3 py-2 text-sm text-white sm:col-span-2"
            >
              Registrar recibido
            </button>
          </form>
          {loadIn ? (
            <Loader2 className="mx-auto h-6 w-6 animate-spin" />
          ) : (
            <ListaCorreos items={bandejaRecibidos} vacio="Sin correos recibidos." />
          )}
        </>
      ) : null}

      {tab === 'enviados' ? (
        loadOut ? (
          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
        ) : (
          <div className="space-y-4">
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">
                Auditoría correos_enviados ({historialEnviados.length})
              </h4>
              {historialEnviados.length === 0 ? (
                <p className="text-sm text-slate-500">Aún no hay correos enviados registrados.</p>
              ) : (
                <ul className="space-y-2">
                  {historialEnviados.map((e) => (
                    <li
                      key={e.id}
                      className={[
                        'rounded-lg border px-3 py-2 text-sm',
                        e.estado === 'fallido' ? 'border-red-200 bg-red-50' : 'border-violet-100 bg-violet-50/50',
                      ].join(' ')}
                    >
                      <div className="flex items-start gap-2">
                        <Send className="mt-0.5 h-4 w-4 text-violet-600" />
                        <div>
                          <p className="font-medium">{e.asunto}</p>
                          <p className="text-xs text-slate-500">
                            Para: {e.destinatarioEmail} · {etiquetaTipoCorreoEnviado(e.tipo)} ·{' '}
                            <span className={e.estado === 'enviado' ? 'text-emerald-700' : 'text-red-700'}>
                              {e.estado}
                            </span>
                          </p>
                          <time className="text-xs text-slate-400">
                            {new Date(e.creadoEn).toLocaleString('es-EC')}
                          </time>
                          {e.mensajeError ? (
                            <p className="mt-1 text-xs text-red-700">{e.mensajeError}</p>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {bandejaEnviadosLocal.length > 0 ? (
              <section>
                <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">
                  Copia en bandeja de la operación
                </h4>
                <ListaCorreos items={bandejaEnviadosLocal} vacio="" />
              </section>
            ) : null}
          </div>
        )
      ) : null}

      {tab === 'enviar' ? (
        <form
          className="space-y-3 rounded-lg border border-violet-200 bg-violet-50/50 p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            await enviar.mutateAsync({
              destinatarioEmail: destinatario,
              asunto: asuntoOut,
              cuerpoTexto: cuerpoOut,
            });
            setDestinatario('');
            setAsuntoOut('');
            setCuerpoOut('');
            setTab('enviados');
          }}
        >
          <p className="text-sm text-violet-900">
            En modo demo el envío se simula y queda en historial de enviados y trazabilidad (sin Graph ni BD).
          </p>
          <input
            required
            type="email"
            placeholder="Destinatario"
            value={destinatario}
            onChange={(e) => setDestinatario(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm"
          />
          <input
            required
            placeholder="Asunto"
            value={asuntoOut}
            onChange={(e) => setAsuntoOut(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm"
          />
          <textarea
            required
            placeholder="Mensaje"
            value={cuerpoOut}
            onChange={(e) => setCuerpoOut(e.target.value)}
            rows={5}
            className="w-full rounded border px-3 py-2 text-sm"
          />
          {enviar.error ? <p className="text-sm text-red-600">{enviar.error.message}</p> : null}
          <button
            type="submit"
            disabled={enviar.isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 py-2.5 text-sm text-white"
          >
            {enviar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar y registrar en historial
          </button>
        </form>
      ) : null}
    </div>
  );
}

function ListaCorreos({
  items,
  vacio,
}: {
  items: Array<{
    id: string;
    asunto: string;
    remitente: string;
    origen: string;
    prioridad: string;
    leido?: boolean;
    destinatarioPrincipal?: string;
  }>;
  vacio: string;
}) {
  if (items.length === 0 && vacio) {
    return <p className="text-sm text-slate-500">{vacio}</p>;
  }
  return (
    <ul className="max-h-72 space-y-2 overflow-y-auto">
      {items.map((c) => (
        <li key={c.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
          <div className="flex gap-2">
            <Mail className="h-4 w-4 shrink-0 text-indigo-600" />
            <div>
              <p className="font-medium">{c.asunto}</p>
              <p className="text-xs text-slate-500">
                {c.remitente}
                {c.destinatarioPrincipal ? ` → ${c.destinatarioPrincipal}` : ''} · {c.origen} ·{' '}
                {c.prioridad}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
