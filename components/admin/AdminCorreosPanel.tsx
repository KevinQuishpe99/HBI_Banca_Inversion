'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Loader2,
  Mail,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Send,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { Toast } from '@/components/shared/Toast';
import { getApiErrorMessage } from '@/lib/api/parse-api-error';
import { swalAlertError, swalAlertSuccess, swalConfirmDanger } from '@/lib/ui/swal';
import {
  adminBtnPrimary,
  adminBtnSecondary,
  adminCard,
  adminInput,
  adminLabel,
  adminPageDesc,
  adminSelect,
  adminTableHead,
  adminToolbar,
  adminToolbarInner,
} from '@/lib/ui/admin-ui';
import {
  EMAIL_LOG_TIPO_LABELS,
  type EmailLogRecord,
  type EmailLogTipo,
} from '@/types/email-log';
import { AdminEmailTemplatePanel } from '@/components/admin/AdminEmailTemplatePanel';
import { EmailPreviewFrame } from '@/components/admin/EmailPreviewFrame';

type MailConfigPayload = {
  graphTenantConfigured: boolean;
  graphClientIdConfigured: boolean;
  graphClientSecretConfigured: boolean;
  mailFromAddress: string | null;
  appUrl: string | null;
  subjectPrefix: string;
  transport: string;
  ready: boolean;
  missing: string[];
  graphTokenOk: boolean | null;
  graphTokenError: string | null;
};

type LogsPayload = {
  items: EmailLogRecord[];
  total: number;
  page: number;
  pageSize: number;
};

const TIPOS_FILTRO: { value: '' | EmailLogTipo; label: string }[] = [
  { value: '', label: 'Todos los tipos' },
  ...(Object.entries(EMAIL_LOG_TIPO_LABELS) as [EmailLogTipo, string][]).map(([value, label]) => ({
    value,
    label,
  })),
];

function ConfigBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        ok ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
      }`}
    >
      {ok ? <CheckCircle2 className="h-3 w-3" aria-hidden /> : <XCircle className="h-3 w-3" aria-hidden />}
      {label}
    </span>
  );
}

function formatFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-EC', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function EmailLogDetailModal({ log, onClose }: { log: EmailLogRecord; onClose: () => void }) {
  const [vista, setVista] = useState<'correo' | 'texto' | 'datos'>('correo');
  const [full, setFull] = useState<EmailLogRecord | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/email-logs/${log.id}`, { credentials: 'include' });
        const json = (await res.json()) as Record<string, unknown> & {
          success?: boolean;
          data?: EmailLogRecord;
        };
        if (!cancelled && res.ok && json.success && json.data) {
          setFull(json.data);
        } else if (!cancelled) {
          setFull(log);
        }
      } catch {
        if (!cancelled) setFull(log);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [log]);

  const row = full ?? log;
  const html = row.cuerpoHtml;
  const showCorreo = Boolean(html?.trim()) || row.tieneVistaHtml || row.usaHtml;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="log-detail-title"
    >
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-admin-border bg-admin-surface shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-admin-border px-4 py-3">
          <h2 id="log-detail-title" className="text-lg font-semibold text-admin-text">
            Correo enviado
          </h2>
          <button type="button" onClick={onClose} className={adminBtnSecondary}>
            Cerrar
          </button>
        </div>
        <div className="flex gap-2 border-b border-admin-border px-4 py-2">
          {showCorreo ? (
            <button
              type="button"
              className={`rounded px-3 py-1 text-sm ${vista === 'correo' ? 'bg-admin-primary text-white' : 'text-admin-text-secondary hover:bg-admin-muted'}`}
              onClick={() => setVista('correo')}
            >
              Como se ve
            </button>
          ) : null}
          <button
            type="button"
            className={`rounded px-3 py-1 text-sm ${vista === 'texto' ? 'bg-admin-primary text-white' : 'text-admin-text-secondary hover:bg-admin-muted'}`}
            onClick={() => setVista('texto')}
          >
            Texto plano
          </button>
          <button
            type="button"
            className={`rounded px-3 py-1 text-sm ${vista === 'datos' ? 'bg-admin-primary text-white' : 'text-admin-text-secondary hover:bg-admin-muted'}`}
            onClick={() => setVista('datos')}
          >
            Datos de envío
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm text-admin-text">
          {loading && vista === 'correo' ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-admin-primary" aria-hidden />
            </div>
          ) : null}
          {vista === 'correo' && showCorreo ? (
            html?.trim() ? (
              <div className="rounded border border-admin-border overflow-hidden">
                <EmailPreviewFrame html={html} title="Vista del correo enviado" />
              </div>
            ) : (
              <p className="text-admin-text-secondary">
                Este envío es anterior al registro visual; solo está disponible el texto plano.
              </p>
            )
          ) : null}
          {vista === 'texto' ? (
            <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-md border border-admin-border bg-admin-muted p-3 text-xs">
              {row.cuerpoTexto ?? 'Sin contenido de texto guardado.'}
            </pre>
          ) : null}
          {vista === 'datos' ? (
            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-admin-text-secondary">Tipo</dt>
                <dd>{EMAIL_LOG_TIPO_LABELS[row.tipo] ?? row.tipo}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-admin-text-secondary">Estado</dt>
                <dd>{row.estado === 'enviado' ? 'Enviado correctamente' : 'Fallido'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-admin-text-secondary">Para</dt>
                <dd>
                  {row.destinatarioEmail}
                  {row.destinatarioNombre ? ` (${row.destinatarioNombre})` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-admin-text-secondary">Desde</dt>
                <dd>{row.remitente ?? '—'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-admin-text-secondary">Asunto</dt>
                <dd className="break-words">{row.asunto}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-admin-text-secondary">Formato enviado</dt>
                <dd>{row.usaHtml ? 'HTML con plantilla COMWARE' : 'Solo texto'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-admin-text-secondary">Fecha</dt>
                <dd>{formatFecha(row.creadoEn)}</dd>
              </div>
              {row.numeroTramite ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-admin-text-secondary">Trámite</dt>
                  <dd>
                    {row.tramiteId ? (
                      <Link href={`/cases/${row.tramiteId}`} className="text-admin-primary hover:underline">
                        {row.numeroTramite}
                      </Link>
                    ) : (
                      row.numeroTramite
                    )}
                  </dd>
                </div>
              ) : null}
              {row.mensajeError ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-red-700">Error</dt>
                  <dd className="break-words text-red-800">{row.mensajeError}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </div>
      </div>
    </div>
  );
}

async function apiErrorMessage(res: Response, json: Record<string, unknown>): Promise<string> {
  return getApiErrorMessage(json, 'No se pudo completar la operación.', { httpStatus: res.status });
}

type AdminUserOption = {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
};

export function AdminCorreosPanel() {
  const { toasts, showToast, hideToast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'comunicados' | 'historial' | 'plantilla' | 'config'>('comunicados');
  const [page, setPage] = useState(1);
  const [tipoFiltro, setTipoFiltro] = useState<'' | EmailLogTipo>('');
  const [busqueda, setBusqueda] = useState('');
  const [busquedaAplicada, setBusquedaAplicada] = useState('');
  const [detalle, setDetalle] = useState<EmailLogRecord | null>(null);
  const [audience, setAudience] = useState<'all' | 'selected'>('selected');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userFilter, setUserFilter] = useState('');
  const [comSubject, setComSubject] = useState('');
  const [comMessage, setComMessage] = useState('');

  const configQuery = useQuery({
    queryKey: ['admin', 'mail-config'],
    queryFn: async (): Promise<MailConfigPayload> => {
      const res = await fetch('/api/admin/mail-config', { credentials: 'include' });
      const json = (await res.json()) as Record<string, unknown> & {
        success?: boolean;
        data?: MailConfigPayload;
      };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(await apiErrorMessage(res, json));
      }
      return json.data;
    },
  });

  const probeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/mail-config?probe=1', { credentials: 'include' });
      const json = (await res.json()) as Record<string, unknown> & {
        success?: boolean;
        data?: MailConfigPayload;
      };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(await apiErrorMessage(res, json));
      }
      return json.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['admin', 'mail-config'], data);
      if (data.graphTokenOk) {
        showToast('Token de Microsoft Graph obtenido correctamente.', 'success');
      } else {
        showToast(data.graphTokenError ?? 'No se pudo validar Graph.', 'error');
      }
    },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const logsQuery = useQuery({
    queryKey: ['admin', 'email-logs', page, tipoFiltro, busquedaAplicada],
    queryFn: async (): Promise<LogsPayload> => {
      const sp = new URLSearchParams({
        page: String(page),
        pageSize: '25',
      });
      if (tipoFiltro) sp.set('tipo', tipoFiltro);
      if (busquedaAplicada.trim()) sp.set('q', busquedaAplicada.trim());
      const res = await fetch(`/api/admin/email-logs?${sp}`, { credentials: 'include' });
      const json = (await res.json()) as Record<string, unknown> & {
        success?: boolean;
        data?: LogsPayload;
      };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(await apiErrorMessage(res, json));
      }
      return json.data;
    },
    enabled: tab === 'historial',
  });

  const usersQuery = useQuery({
    queryKey: ['admin', 'users-comunicados'],
    queryFn: async (): Promise<AdminUserOption[]> => {
      const res = await fetch('/api/admin/users', { credentials: 'include' });
      const json = (await res.json()) as Record<string, unknown> & {
        success?: boolean;
        data?: AdminUserOption[];
      };
      if (!res.ok || !json.success || !Array.isArray(json.data)) {
        throw new Error(await apiErrorMessage(res, json));
      }
      return json.data
        .filter((u) => u.isActive && u.email?.trim())
        .map((u) => ({
          id: String(u.id),
          email: String(u.email),
          name: String(u.name ?? u.email),
          isActive: true,
        }));
    },
    enabled: tab === 'comunicados',
  });

  const activeUsers = usersQuery.data ?? [];

  const comunicadoMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/comunicados', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audience,
          userIds: audience === 'selected' ? selectedUserIds : undefined,
          subject: comSubject.trim(),
          message: comMessage.trim(),
        }),
      });
      const json = (await res.json()) as Record<string, unknown> & {
        success?: boolean;
        data?: { message?: string; sent?: number; failed?: number };
      };
      if (!res.ok || !json.success) {
        throw new Error(await apiErrorMessage(res, json));
      }
      return json.data;
    },
    onSuccess: async (data) => {
      await swalAlertSuccess('Comunicado enviado', data?.message ?? 'Correo enviado correctamente.');
      setComSubject('');
      setComMessage('');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'email-logs'] });
      setTab('historial');
    },
    onError: async (e: Error) => {
      await swalAlertError('No se pudo enviar', e.message);
    },
  });

  const enviarComunicado = async () => {
    if (!cfg?.ready) {
      await swalAlertError('Correo no configurado', 'Complete la configuración de Microsoft Graph antes de enviar.');
      setTab('config');
      return;
    }
    if (!comSubject.trim() || comMessage.trim().length < 10) {
      await swalAlertError('Datos incompletos', 'Indique asunto y un mensaje de al menos 10 caracteres.');
      return;
    }
    if (audience === 'selected' && selectedUserIds.length === 0) {
      await swalAlertError('Destinatarios', 'Marque al menos un usuario en la lista.');
      return;
    }

    const destinoLabel =
      audience === 'all'
        ? `todos los usuarios activos (${activeUsers.length})`
        : `${selectedUserIds.length} usuario(s) seleccionado(s)`;

    const ok = await swalConfirmDanger({
      title: audience === 'all' ? '¿Enviar a todos los usuarios?' : '¿Enviar comunicado?',
      html: `Se enviará el correo a <strong>${destinoLabel}</strong>.<br/><br/>Asunto: ${comSubject.trim()}`,
      confirmButtonText: audience === 'all' ? 'Sí, enviar a todos' : 'Sí, enviar',
    });
    if (!ok) return;
    comunicadoMutation.mutate();
  };

  const totalPages = useMemo(() => {
    const t = logsQuery.data?.total ?? 0;
    const ps = logsQuery.data?.pageSize ?? 25;
    return Math.max(1, Math.ceil(t / ps));
  }, [logsQuery.data]);

  const aplicarBusqueda = useCallback(() => {
    setBusquedaAplicada(busqueda);
    setPage(1);
  }, [busqueda]);

  const cfg = configQuery.data;

  return (
    <div className="space-y-6">
      <p className={adminPageDesc}>
        Envíe comunicados, revise cómo se vieron los correos, edite colores de la plantilla y consulte la
        configuración de Microsoft 365.
      </p>

      <div className="flex flex-wrap gap-2 border-b border-admin-border pb-2">
        {(
          [
            ['comunicados', 'Comunicados'],
            ['historial', 'Historial'],
            ['plantilla', 'Formato del correo'],
            ['config', 'Configuración'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              tab === id
                ? 'bg-admin-primary text-white'
                : 'text-admin-text-secondary hover:bg-admin-muted'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'plantilla' ? <AdminEmailTemplatePanel /> : null}

      {tab === 'config' ? (
        <section className={adminCard}>
          <div className="border-b border-admin-border px-4 py-3">
            <h2 className="flex items-center gap-2 text-base font-semibold text-admin-text">
              <Mail className="h-5 w-5 text-admin-primary" aria-hidden />
              Configuración de correo (Microsoft Graph)
            </h2>
          </div>
          <div className="space-y-4 p-4 text-sm text-admin-text">
            {configQuery.isLoading ? (
              <div className="flex items-center gap-2 text-admin-text-secondary">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Cargando…
              </div>
            ) : configQuery.isError ? (
              <p className="text-red-700">{String(configQuery.error)}</p>
            ) : cfg ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <ConfigBadge ok={cfg.graphTenantConfigured} label="Tenant ID" />
                  <ConfigBadge ok={cfg.graphClientIdConfigured} label="Client ID" />
                  <ConfigBadge ok={cfg.graphClientSecretConfigured} label="Client Secret" />
                  <ConfigBadge ok={Boolean(cfg.mailFromAddress)} label="MAIL_FROM_ADDRESS" />
                </div>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className={adminLabel}>Remitente (buzón Graph)</dt>
                    <dd className="mt-0.5 font-mono text-sm">{cfg.mailFromAddress ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className={adminLabel}>Prefijo de asunto</dt>
                    <dd className="mt-0.5">{cfg.subjectPrefix}</dd>
                  </div>
                  <div>
                    <dt className={adminLabel}>URL de la aplicación</dt>
                    <dd className="mt-0.5 break-all">{cfg.appUrl ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className={adminLabel}>Transporte</dt>
                    <dd className="mt-0.5">Microsoft Graph (permiso Mail.Send de aplicación)</dd>
                  </div>
                </dl>
                {!cfg.ready && cfg.missing.length > 0 ? (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                    Faltan variables en el entorno: {cfg.missing.join(', ')}.
                  </p>
                ) : null}
                {cfg.graphTokenOk === true ? (
                  <p className="text-emerald-700">Última validación: token Graph OK.</p>
                ) : null}
                {cfg.graphTokenOk === false && cfg.graphTokenError ? (
                  <p className="text-red-700">Validación Graph: {cfg.graphTokenError}</p>
                ) : null}
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    className={adminBtnPrimary}
                    disabled={!cfg.ready || probeMutation.isPending}
                    onClick={() => probeMutation.mutate()}
                  >
                    {probeMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <RefreshCw className="h-4 w-4" aria-hidden />
                    )}
                    Validar conexión Graph
                  </button>
                </div>
                <p className="text-xs text-admin-text-secondary">
                  Los secretos no se muestran por seguridad. Configure las variables en Vercel o en el servidor.
                  Cada notificación del flujo de trámites también genera un registro en la pestaña «Correos
                  enviados».
                </p>
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      {tab === 'historial' ? (
        <section className={adminCard}>
          <div className={adminToolbar}>
            <div className={adminToolbarInner}>
              <div>
                <label htmlFor="filtro-tipo" className={adminLabel}>
                  Tipo
                </label>
                <select
                  id="filtro-tipo"
                  className={`${adminSelect} mt-1 min-w-[12rem]`}
                  value={tipoFiltro}
                  onChange={(e) => {
                    setTipoFiltro(e.target.value as '' | EmailLogTipo);
                    setPage(1);
                  }}
                >
                  {TIPOS_FILTRO.map((o) => (
                    <option key={o.value || 'all'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-[14rem] flex-1">
                <label htmlFor="buscar-correo" className={adminLabel}>
                  Buscar
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    id="buscar-correo"
                    type="search"
                    className={adminInput}
                    placeholder="Correo, asunto o nº trámite"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && aplicarBusqueda()}
                  />
                  <button type="button" className={adminBtnSecondary} onClick={aplicarBusqueda}>
                    Buscar
                  </button>
                </div>
              </div>
            </div>
            <button
              type="button"
              className={adminBtnSecondary}
              onClick={() => void logsQuery.refetch()}
              disabled={logsQuery.isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${logsQuery.isFetching ? 'animate-spin' : ''}`} aria-hidden />
              Actualizar
            </button>
          </div>

          {logsQuery.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-admin-primary" aria-hidden />
            </div>
          ) : logsQuery.isError ? (
            <div className="p-6 text-center">
              <p className="text-admin-text-secondary">
                {String(logsQuery.error)}
              </p>
              <button
                type="button"
                className={`${adminBtnSecondary} mt-4`}
                onClick={() => void logsQuery.refetch()}
              >
                Reintentar
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-admin-border text-sm">
                  <thead>
                    <tr>
                      <th className={adminTableHead}>Fecha</th>
                      <th className={adminTableHead}>Tipo</th>
                      <th className={adminTableHead}>Estado</th>
                      <th className={adminTableHead}>Destinatario</th>
                      <th className={adminTableHead}>Asunto</th>
                      <th className={adminTableHead}>Trámite</th>
                      <th className={adminTableHead}>Formato</th>
                      <th className={adminTableHead}>
                        <span className="sr-only">Ver</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-admin-border bg-admin-surface">
                    {(logsQuery.data?.items ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-admin-text-secondary">
                          No hay registros. Los correos enviados a partir de ahora aparecerán aquí.
                        </td>
                      </tr>
                    ) : (
                      logsQuery.data?.items.map((row) => (
                        <tr key={row.id} className="hover:bg-admin-muted/50">
                          <td className="whitespace-nowrap px-4 py-2 text-admin-text-secondary">
                            {formatFecha(row.creadoEn)}
                          </td>
                          <td className="px-4 py-2">{EMAIL_LOG_TIPO_LABELS[row.tipo] ?? row.tipo}</td>
                          <td className="px-4 py-2">
                            <span
                              className={
                                row.estado === 'enviado'
                                  ? 'text-emerald-700'
                                  : 'text-red-700'
                              }
                            >
                              {row.estado === 'enviado' ? 'Enviado' : 'Fallido'}
                            </span>
                          </td>
                          <td className="max-w-[10rem] truncate px-4 py-2" title={row.destinatarioEmail}>
                            {row.destinatarioEmail}
                          </td>
                          <td className="max-w-[14rem] truncate px-4 py-2" title={row.asunto}>
                            {row.asunto}
                          </td>
                          <td className="px-4 py-2">
                            {row.tramiteId && row.numeroTramite ? (
                              <Link
                                href={`/cases/${row.tramiteId}`}
                                className="text-admin-primary hover:underline"
                              >
                                {row.numeroTramite}
                              </Link>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-4 py-2">{row.usaHtml ? 'HTML' : 'Texto'}</td>
                          <td className="px-4 py-2">
                            <button
                              type="button"
                              className={adminBtnSecondary}
                              aria-label="Ver detalle"
                              onClick={() => setDetalle(row)}
                            >
                              <Eye className="h-4 w-4" aria-hidden />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-admin-border px-4 py-3 text-sm">
                <span className="text-admin-text-secondary">
                  {logsQuery.data?.total ?? 0} registro(s) — página {page} de {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={adminBtnSecondary}
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden />
                    Anterior
                  </button>
                  <button
                    type="button"
                    className={adminBtnSecondary}
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      ) : null}

      {tab === 'comunicados' ? (
        <section className={adminCard}>
          <div className="border-b border-admin-border px-4 py-3">
            <h2 className="text-base font-semibold text-admin-text">Enviar comunicado</h2>
            <p className="mt-1 text-sm text-admin-text-secondary">
              Mensaje institucional por correo. Elija un usuario o todos los usuarios activos del sistema.
            </p>
          </div>
          <div className="space-y-4 p-4">
            {cfg && !cfg.ready ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                El correo no está listo para enviar. Revise la pestaña Configuración.
              </p>
            ) : null}

            <fieldset className="space-y-2">
              <legend className={adminLabel}>Destinatarios</legend>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-admin-text">
                <input
                  type="radio"
                  name="audience"
                  checked={audience === 'selected'}
                  onChange={() => setAudience('selected')}
                />
                Uno o varios usuarios
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-admin-text">
                <input
                  type="radio"
                  name="audience"
                  checked={audience === 'all'}
                  onChange={() => setAudience('all')}
                />
                Todos los usuarios activos
                {activeUsers.length > 0 ? (
                  <span className="text-admin-text-secondary">({activeUsers.length})</span>
                ) : null}
              </label>
            </fieldset>

            {audience === 'selected' ? (
              <div className="max-w-2xl rounded-md border border-admin-border bg-admin-muted/40 p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <input
                    type="search"
                    className={`${adminInput} max-w-xs flex-1`}
                    placeholder="Buscar por nombre o correo"
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                  />
                  <button
                    type="button"
                    className={adminBtnSecondary}
                    onClick={() => setSelectedUserIds(activeUsers.map((u) => u.id))}
                  >
                    Marcar todos
                  </button>
                  <button
                    type="button"
                    className={adminBtnSecondary}
                    onClick={() => setSelectedUserIds([])}
                  >
                    Limpiar
                  </button>
                  <span className="text-xs text-admin-text-secondary">
                    {selectedUserIds.length} seleccionado(s)
                  </span>
                </div>
                {usersQuery.isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-admin-primary" aria-hidden />
                ) : (
                  <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
                    {activeUsers
                      .filter((u) => {
                        const q = userFilter.trim().toLowerCase();
                        if (!q) return true;
                        return (
                          u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
                        );
                      })
                      .map((u) => (
                        <li key={u.id}>
                          <label className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 hover:bg-admin-surface">
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={selectedUserIds.includes(u.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedUserIds((ids) => [...ids, u.id]);
                                } else {
                                  setSelectedUserIds((ids) => ids.filter((id) => id !== u.id));
                                }
                              }}
                            />
                            <span>
                              <span className="font-medium text-admin-text">{u.name}</span>
                              <span className="block text-xs text-admin-text-secondary">{u.email}</span>
                            </span>
                          </label>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            ) : null}

            <div className="max-w-2xl">
              <label htmlFor="com-subject" className={adminLabel}>
                Asunto
              </label>
              <input
                id="com-subject"
                type="text"
                className={`${adminInput} mt-1`}
                placeholder="Ej. Mantenimiento programado del sistema"
                value={comSubject}
                onChange={(e) => setComSubject(e.target.value)}
                maxLength={200}
              />
              <p className="mt-1 text-xs text-admin-text-secondary">
                Se añade automáticamente el prefijo institucional COMWARE.
              </p>
            </div>

            <div className="max-w-2xl">
              <label htmlFor="com-message" className={adminLabel}>
                Mensaje
              </label>
              <textarea
                id="com-message"
                className={`${adminInput} mt-1 min-h-[10rem] resize-y`}
                placeholder="Escriba el contenido del comunicado…"
                value={comMessage}
                onChange={(e) => setComMessage(e.target.value)}
                maxLength={8000}
              />
            </div>

            <button
              type="button"
              className={adminBtnPrimary}
              disabled={comunicadoMutation.isPending || cfg?.ready === false}
              onClick={() => void enviarComunicado()}
            >
              {comunicadoMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Send className="h-4 w-4" aria-hidden />
              )}
              Enviar comunicado
            </button>
          </div>
        </section>
      ) : null}

      {detalle ? <EmailLogDetailModal log={detalle} onClose={() => setDetalle(null)} /> : null}
      {toasts.map((t, i) => (
        <Toast
          key={t.id}
          message={t.message}
          type={t.type}
          zIndex={200 + i}
          onClose={() => hideToast(t.id)}
        />
      ))}
    </div>
  );
}
