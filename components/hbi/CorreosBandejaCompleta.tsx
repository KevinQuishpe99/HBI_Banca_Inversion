'use client';

import { useMemo, useState } from 'react';
import { Loader2, Mail, Send, Inbox, MailPlus, Eye } from 'lucide-react';
import {
  useHbiCorreos,
  useHbiCorreosEnviados,
  useRegistrarCorreoHbi,
  useEnviarCorreoHbi,
} from '@/hooks/useHbiOperaciones';
import { etiquetaTipoCorreoEnviado } from '@/lib/hbi/email-labels';
import type { CorreoEnviadoHbi, CorreoOperacion } from '@/types/hbi/operacion.types';
import { InfoProyectoViabilidadPanel } from '@/components/hbi/InfoProyectoViabilidadPanel';
import type { InfoProyectoHbi } from '@/types/hbi/operacion.types';

type Props = {
  operacionId: string;
  codigoOperacion: string;
  infoProyecto?: InfoProyectoHbi | null;
};

const ORIGEN_LABEL: Record<string, string> = {
  AGENTE_HBI: 'Agente HBI',
  DEUDOR: 'Deudor',
  ACREEDOR: 'Acreedor',
  OTRO: 'Otro',
};

export function CorreosBandejaCompleta({ operacionId, codigoOperacion, infoProyecto }: Props) {
  const [tab, setTab] = useState<'recibidos' | 'enviados' | 'enviar'>('recibidos');
  const [correoSel, setCorreoSel] = useState<CorreoOperacion | null>(null);
  const [enviadoSel, setEnviadoSel] = useState<CorreoEnviadoHbi | null>(null);
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

  const bandejaRecibidos = useMemo(
    () => recibidos?.filter((c) => c.direccion !== 'ENVIADO') ?? [],
    [recibidos]
  );
  const bandejaEnviadosLocal = useMemo(
    () => recibidos?.filter((c) => c.direccion === 'ENVIADO') ?? [],
    [recibidos]
  );
  const historialEnviados = enviadosData?.items ?? [];

  const correoActivo =
    correoSel ??
    (tab === 'recibidos' && bandejaRecibidos[0] ? bandejaRecibidos[0] : null);

  return (
    <div className="space-y-6">
      <InfoProyectoViabilidadPanel operacionId={operacionId} infoInicial={infoProyecto} />

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h3 className="font-semibold text-slate-900">Fase 2 — Comunicaciones y correos</h3>
          <p className="mt-1 text-sm text-slate-600">
            Bandeja única por operación {codigoOperacion}: registre correos de Agente HBI, deudor y
            acreedores. Seleccione un mensaje para leer el contenido completo.
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
              onClick={() => {
                setTab(t.id);
                setEnviadoSel(null);
              }}
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
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="space-y-3 lg:col-span-2">
              <form
                className="grid gap-2 rounded-lg border border-dashed border-indigo-200 bg-indigo-50/40 p-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const c = await registrar.mutateAsync({ remitente, asunto, cuerpoResumen: cuerpo });
                  setRemitente('');
                  setAsunto('');
                  setCuerpo('');
                  setCorreoSel(c);
                }}
              >
                <p className="text-xs font-medium text-indigo-900">Registrar correo recibido</p>
                <input
                  required
                  placeholder="Remitente (correo)"
                  value={remitente}
                  onChange={(e) => setRemitente(e.target.value)}
                  className="rounded border px-2 py-1.5 text-sm"
                />
                <input
                  required
                  placeholder="Asunto"
                  value={asunto}
                  onChange={(e) => setAsunto(e.target.value)}
                  className="rounded border px-2 py-1.5 text-sm"
                />
                <textarea
                  required
                  placeholder="Cuerpo del mensaje / resumen"
                  value={cuerpo}
                  onChange={(e) => setCuerpo(e.target.value)}
                  rows={4}
                  className="rounded border px-2 py-1.5 text-sm"
                />
                <button
                  type="submit"
                  disabled={registrar.isPending}
                  className="rounded bg-indigo-600 px-3 py-2 text-sm text-white"
                >
                  Registrar recibido
                </button>
              </form>

              {loadIn ? (
                <Loader2 className="mx-auto h-6 w-6 animate-spin" />
              ) : (
                <ListaCorreos
                  items={bandejaRecibidos}
                  vacio="Sin correos recibidos."
                  seleccionadoId={correoActivo?.id}
                  onSeleccionar={setCorreoSel}
                />
              )}
            </div>

            <div className="lg:col-span-3">
              <DetalleCorreo correo={correoActivo} />
            </div>
          </div>
        ) : null}

        {tab === 'enviados' ? (
          loadOut ? (
            <Loader2 className="mx-auto h-6 w-6 animate-spin" />
          ) : (
            <div className="grid gap-4 lg:grid-cols-5">
              <div className="space-y-3 lg:col-span-2">
                <section>
                  <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">
                    Auditoría enviados ({historialEnviados.length})
                  </h4>
                  {historialEnviados.length === 0 ? (
                    <p className="text-sm text-slate-500">Aún no hay correos enviados.</p>
                  ) : (
                    <ul className="max-h-80 space-y-2 overflow-y-auto">
                      {historialEnviados.map((e) => (
                        <li key={e.id}>
                          <button
                            type="button"
                            onClick={() => setEnviadoSel(e)}
                            className={[
                              'w-full rounded-lg border px-3 py-2 text-left text-sm transition',
                              enviadoSel?.id === e.id
                                ? 'border-violet-400 bg-violet-50 ring-1 ring-violet-200'
                                : e.estado === 'fallido'
                                  ? 'border-red-200 bg-red-50 hover:bg-red-100/80'
                                  : 'border-violet-100 bg-violet-50/50 hover:bg-violet-50',
                            ].join(' ')}
                          >
                            <p className="font-medium line-clamp-1">{e.asunto}</p>
                            <p className="text-xs text-slate-500">
                              Para: {e.destinatarioEmail} · {etiquetaTipoCorreoEnviado(e.tipo)}
                            </p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                {bandejaEnviadosLocal.length > 0 ? (
                  <section>
                    <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">
                      Copia en bandeja
                    </h4>
                    <ListaCorreos
                      items={bandejaEnviadosLocal}
                      vacio=""
                      seleccionadoId={correoSel?.id}
                      onSeleccionar={setCorreoSel}
                    />
                  </section>
                ) : null}
              </div>
              <div className="lg:col-span-3">
                {enviadoSel ? (
                  <DetalleCorreoEnviado correo={enviadoSel} />
                ) : correoSel && correoSel.direccion === 'ENVIADO' ? (
                  <DetalleCorreo correo={correoSel} />
                ) : (
                  <div className="flex h-full min-h-[200px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                    Seleccione un correo enviado para ver el mensaje completo.
                  </div>
                )}
              </div>
            </div>
          )
        ) : null}

        {tab === 'enviar' ? (
          <form
            className="mx-auto max-w-xl space-y-3 rounded-lg border border-violet-200 bg-violet-50/50 p-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await enviar.mutateAsync({
                destinatarioEmail: destinatario,
                asunto: asuntoOut,
                cuerpoTexto: cuerpoOut,
              });
              setDestinatario('');
              setAsuntoOut('');
              setCuerpoOut('');
              setEnviadoSel(res.correoEnviado);
              setTab('enviados');
            }}
          >
            <p className="text-sm text-violet-900">
              En modo demo el envío se simula y queda en historial y trazabilidad.
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
              placeholder="Mensaje completo"
              value={cuerpoOut}
              onChange={(e) => setCuerpoOut(e.target.value)}
              rows={8}
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
    </div>
  );
}

function ListaCorreos({
  items,
  vacio,
  seleccionadoId,
  onSeleccionar,
}: {
  items: CorreoOperacion[];
  vacio: string;
  seleccionadoId?: string;
  onSeleccionar: (c: CorreoOperacion) => void;
}) {
  if (items.length === 0 && vacio) {
    return <p className="text-sm text-slate-500">{vacio}</p>;
  }
  return (
    <ul className="max-h-96 space-y-1 overflow-y-auto">
      {items.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            onClick={() => onSeleccionar(c)}
            className={[
              'w-full rounded-lg border px-3 py-2 text-left text-sm transition',
              seleccionadoId === c.id
                ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-200'
                : 'border-slate-100 bg-slate-50 hover:bg-white',
            ].join(' ')}
          >
            <div className="flex gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
              <div className="min-w-0">
                <p className="truncate font-medium">{c.asunto}</p>
                <p className="truncate text-xs text-slate-500">
                  {c.remitente}
                  {c.destinatarioPrincipal ? ` → ${c.destinatarioPrincipal}` : ''}
                </p>
                <p className="text-[10px] text-slate-400">
                  {ORIGEN_LABEL[c.origen] ?? c.origen} · {c.prioridad}
                </p>
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function DetalleCorreo({ correo }: { correo: CorreoOperacion | null }) {
  if (!correo) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
        <Eye className="mr-2 h-4 w-4" />
        Seleccione un correo para visualizarlo.
      </div>
    );
  }

  return (
    <article className="rounded-xl border border-indigo-100 bg-white p-5 shadow-sm">
      <header className="border-b border-slate-100 pb-3">
        <h4 className="text-lg font-semibold text-slate-900">{correo.asunto}</h4>
        <dl className="mt-2 grid gap-1 text-sm">
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-slate-500">De:</dt>
            <dd className="font-medium text-slate-800">{correo.remitente}</dd>
          </div>
          {correo.destinatarioPrincipal ? (
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-slate-500">Para:</dt>
              <dd>{correo.destinatarioPrincipal}</dd>
            </div>
          ) : null}
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-slate-500">Origen:</dt>
            <dd>{ORIGEN_LABEL[correo.origen] ?? correo.origen}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-slate-500">Prioridad:</dt>
            <dd>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium">
                {correo.prioridad}
              </span>
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-slate-500">Fecha:</dt>
            <dd>{new Date(correo.recibidoEn).toLocaleString('es-CO')}</dd>
          </div>
        </dl>
      </header>
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase text-slate-500">Contenido</p>
        <div className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">
          {correo.cuerpoResumen?.trim() ||
            '(Sin cuerpo registrado — edite el correo o registre uno nuevo con el texto completo.)'}
        </div>
      </div>
    </article>
  );
}

function DetalleCorreoEnviado({ correo }: { correo: CorreoEnviadoHbi }) {
  return (
    <article className="rounded-xl border border-violet-100 bg-white p-5 shadow-sm">
      <header className="border-b border-slate-100 pb-3">
        <h4 className="text-lg font-semibold text-slate-900">{correo.asunto}</h4>
        <dl className="mt-2 grid gap-1 text-sm">
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-slate-500">Para:</dt>
            <dd className="font-medium">{correo.destinatarioEmail}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-slate-500">Estado:</dt>
            <dd className={correo.estado === 'enviado' ? 'text-emerald-700' : 'text-red-700'}>
              {correo.estado}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-slate-500">Fecha:</dt>
            <dd>{new Date(correo.creadoEn).toLocaleString('es-CO')}</dd>
          </div>
        </dl>
      </header>
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase text-slate-500">Mensaje enviado</p>
        <div className="mt-2 whitespace-pre-wrap rounded-lg bg-violet-50/50 p-4 text-sm leading-relaxed text-slate-800">
          {correo.cuerpoTexto?.trim() || '(Sin cuerpo)'}
        </div>
      </div>
      {correo.mensajeError ? (
        <p className="mt-3 text-sm text-red-700">{correo.mensajeError}</p>
      ) : null}
    </article>
  );
}
