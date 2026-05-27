'use client';

import { useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, GitBranch, Save } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { Toast } from '@/components/shared/Toast';
import { DirectLegalFlowDiagram, SupervisionChainFlowDiagram } from '@/components/admin/WorkflowFlowCharts';
import { adminBtnPrimary, adminCard, adminInput } from '@/lib/ui/admin-ui';

type MetaArea = { area: string; label: string };

type DeadlineAlertsPayload = {
  reminderDays: number;
  overdueEnabled: boolean;
  overdueRepeatDays: number;
};

type RoutingPayload = {
  supervisionChain: { creatorAreas: string[]; supervisionArea: string | null };
  directLegal: { creatorAreas: string[] };
  amountAlertThreshold?: number;
  amountAlertAreaCodes?: string[];
  deadlineAlerts?: DeadlineAlertsPayload;
};

type WorkflowFormState = {
  supAreas: string[];
  supGate: string;
  directAreas: string[];
  amountAlertThreshold: number;
  amountAlertAreaCodes: string[];
  deadlineAlerts: DeadlineAlertsPayload;
};

function SectionSaveBar({
  onSave,
  disabled,
  pending,
}: {
  onSave: () => void;
  disabled: boolean;
  pending: boolean;
}) {
  return (
    <div className="mt-6 flex justify-end border-t border-admin-border pt-4">
      <button
        type="button"
        onClick={onSave}
        disabled={disabled || pending}
        className={adminBtnPrimary}
      >
        {pending ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : <Save className="h-4 w-4 shrink-0" aria-hidden />}
        Guardar
      </button>
    </div>
  );
}

function WorkflowForm({
  routing,
  areaOptions,
  stateRef,
  onSave,
  saveDisabled,
  savePending,
}: {
  routing: RoutingPayload;
  areaOptions: MetaArea[];
  stateRef: MutableRefObject<WorkflowFormState | null>;
  onSave: () => void;
  saveDisabled: boolean;
  savePending: boolean;
}) {
  const [supAreas, setSupAreas] = useState(() => routing.supervisionChain.creatorAreas ?? []);
  const [supGate, setSupGate] = useState(() => routing.supervisionChain.supervisionArea ?? '');
  const [directAreas, setDirectAreas] = useState(() => routing.directLegal.creatorAreas ?? []);
  const [amountAlertThreshold, setAmountAlertThreshold] = useState(
    () => routing.amountAlertThreshold ?? 100000
  );
  const [amountAlertAreaCodes, setAmountAlertAreaCodes] = useState(
    () => routing.amountAlertAreaCodes ?? []
  );
  const [dlReminderDays, setDlReminderDays] = useState(
    () => routing.deadlineAlerts?.reminderDays ?? 2
  );
  const [dlOverdueEnabled, setDlOverdueEnabled] = useState(
    () => routing.deadlineAlerts?.overdueEnabled ?? true
  );
  const [dlOverdueRepeatDays, setDlOverdueRepeatDays] = useState(
    () => routing.deadlineAlerts?.overdueRepeatDays ?? 3
  );

  useLayoutEffect(() => {
    stateRef.current = {
      supAreas,
      supGate,
      directAreas,
      amountAlertThreshold,
      amountAlertAreaCodes,
      deadlineAlerts: {
        reminderDays: dlReminderDays,
        overdueEnabled: dlOverdueEnabled,
        overdueRepeatDays: dlOverdueRepeatDays,
      },
    };
  }, [supAreas, supGate, directAreas, amountAlertThreshold, amountAlertAreaCodes, dlReminderDays, dlOverdueEnabled, dlOverdueRepeatDays, stateRef]);

  const supervisionDisplayLabel = useMemo(() => {
    if (!supGate.trim()) return undefined;
    const o = areaOptions.find((a) => a.area === supGate);
    return o?.label ?? supGate;
  }, [supGate, areaOptions]);

  function toggle(list: string[], setList: (v: string[]) => void, code: string) {
    const u = code.toUpperCase();
    if (list.includes(u)) setList(list.filter((x) => x !== u));
    else setList([...list, u]);
  }

  return (
    <div className="flex flex-col gap-10">
      <div className={`${adminCard} p-5`}>
        <h2 className="text-lg font-semibold text-admin-text-strong">Flujo 1 — Supervisión y revisiones</h2>
        <div className="mt-5">
          <SupervisionChainFlowDiagram supervisionAreaLabel={supervisionDisplayLabel} />
        </div>
        <div className="mt-6 border-t border-violet-100 pt-6">
          <label className="flex items-baseline gap-2 text-sm font-semibold text-gray-900">
            <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full border-2 border-gray-800 bg-gray-100 px-1.5 text-[11px] font-bold text-gray-900">
              1
            </span>
            Orígenes (área del creador)
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {areaOptions.map((a) => (
              <label
                key={`s-${a.area}`}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-violet-200 bg-white px-2 py-1 text-xs font-medium text-gray-900"
              >
                <input
                  type="checkbox"
                  checked={supAreas.includes(a.area)}
                  onChange={() => toggle(supAreas, setSupAreas, a.area)}
                />
                {a.label}
              </label>
            ))}
          </div>
        </div>
        <div className="mt-6">
          <label className="flex items-baseline gap-2 text-sm font-semibold text-gray-900" htmlFor="sup-gate">
            <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full border-2 border-gray-800 bg-gray-100 px-1.5 text-[11px] font-bold text-gray-900">
              3
            </span>
            Supervisión (área de supervisión)
          </label>
          <select
            id="sup-gate"
            className={`${adminInput} mt-2 max-w-md`}
            value={supGate}
            onChange={(e) => setSupGate(e.target.value)}
          >
            <option value="">Seleccione…</option>
            {areaOptions.map((a) => (
              <option key={a.area} value={a.area}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        <SectionSaveBar onSave={onSave} disabled={saveDisabled} pending={savePending} />
      </div>

      <div className={`${adminCard} p-5`}>
        <h2 className="text-lg font-semibold text-gray-900">Flujo 2 — Directo a Legal</h2>
        <div className="mt-5">
          <DirectLegalFlowDiagram />
        </div>
        <div className="mt-6 border-t border-sky-100 pt-6">
          <label className="flex items-baseline gap-2 text-sm font-semibold text-gray-900">
            <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full border-2 border-gray-800 bg-gray-100 px-1.5 text-[11px] font-bold text-gray-900">
              1
            </span>
            Orígenes (área del creador)
          </label>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {areaOptions.map((a) => (
            <label
              key={`d-${a.area}`}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-sky-200 bg-white px-2 py-1 text-xs font-medium text-gray-900"
            >
              <input
                type="checkbox"
                checked={directAreas.includes(a.area)}
                onChange={() => toggle(directAreas, setDirectAreas, a.area)}
              />
              {a.label}
            </label>
          ))}
        </div>
        <SectionSaveBar onSave={onSave} disabled={saveDisabled} pending={savePending} />
      </div>

      <div className={`${adminCard} p-5`}>
        <h2 className="text-lg font-semibold text-gray-900">Alerta por monto del trámite</h2>
        <p className="mt-1 text-sm text-gray-900">
          Si el solicitante indica un monto y este es <strong>mayor o igual</strong> al valor aquí definido (USD), se
          envía notificación en la aplicación y por correo a las áreas que seleccione abajo.
        </p>
        <label className="mt-4 block text-sm font-semibold text-gray-900" htmlFor="amount-threshold">
          Umbral de alerta (USD)
        </label>
        <input
          id="amount-threshold"
          type="number"
          min={1}
          step={1}
          value={Number.isFinite(amountAlertThreshold) ? amountAlertThreshold : 100000}
          onChange={(e) => setAmountAlertThreshold(Math.max(1, parseInt(e.target.value, 10) || 1))}
          className={`${adminInput} mt-2 !w-32 max-w-32 shrink-0 text-center`}
        />
        <label className="mt-4 block text-sm font-semibold text-gray-900">
          Áreas que recibirán la alerta por monto
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {areaOptions.map((a) => (
            <label
              key={`amount-alert-${a.area}`}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-amber-200 bg-white px-2 py-1 text-xs font-medium text-gray-900"
            >
              <input
                type="checkbox"
                checked={amountAlertAreaCodes.includes(a.area)}
                onChange={() => toggle(amountAlertAreaCodes, setAmountAlertAreaCodes, a.area)}
              />
              {a.label}
            </label>
          ))}
        </div>
        <SectionSaveBar onSave={onSave} disabled={saveDisabled} pending={savePending} />
      </div>

      {/* ── Alertas por fecha límite ───────────────────────────────────────── */}
      <div className={`${adminCard} p-5`}>
        <h2 className="text-lg font-semibold text-gray-900">Alertas por fecha límite</h2>
        <p className="mt-1 text-sm text-gray-900">
          Notificaciones automáticas (correo + aplicación) a los revisores de cada trámite cuando se
          acerque o supere la <strong>fecha de entrega requerida</strong>. Solo se notifica a quienes
          tengan revisión pendiente según el flujo actual del trámite.
        </p>

        {/* 1) Recordatorio antes del vencimiento */}
        <div className="mt-6 border-t border-rose-100 pt-5">
          <label className="flex items-baseline gap-2 text-sm font-semibold text-gray-900" htmlFor="dl-reminder-days">
            <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full border-2 border-gray-800 bg-gray-100 px-1.5 text-[11px] font-bold text-gray-900">
              1
            </span>
            Recordatorio previo al vencimiento
          </label>
          <p className="mt-1 pl-8 text-xs text-gray-800">
            Enviar aviso cuando falten <strong>N días o menos</strong> para la fecha límite y el trámite
            siga sin completarse. Si el trámite se crea con una fecha ya dentro de esos N días, el aviso
            se dispara de inmediato.
          </p>
          <div className="mt-3 flex items-center gap-3 pl-8">
            <input
              id="dl-reminder-days"
              type="number"
              min={0}
              max={90}
              step={1}
              value={dlReminderDays}
              onChange={(e) => setDlReminderDays(Math.max(0, Math.min(90, parseInt(e.target.value, 10) || 0)))}
              className={`${adminInput} !w-16 shrink-0 text-center`}
            />
            <span className="text-sm font-medium text-gray-900">días antes de la fecha límite</span>
          </div>
          <p className="mt-1.5 pl-8 text-[11px] text-gray-700">
            0 = desactivado (no se envía recordatorio previo).
          </p>
        </div>

        {/* 2) Alerta post-vencimiento */}
        <div className="mt-6 border-t border-rose-100 pt-5">
          <label className="flex items-center gap-3 text-sm font-semibold text-gray-900">
            <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full border-2 border-gray-800 bg-gray-100 px-1.5 text-[11px] font-bold text-gray-900">
              2
            </span>
            Alerta de trámite vencido
            <input
              type="checkbox"
              className="ml-1 h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500"
              checked={dlOverdueEnabled}
              onChange={(e) => setDlOverdueEnabled(e.target.checked)}
            />
            <span className={`text-xs font-semibold ${dlOverdueEnabled ? 'text-gray-900' : 'text-gray-600'}`}>
              {dlOverdueEnabled ? 'Activado' : 'Desactivado'}
            </span>
          </label>
          <p className="mt-1 pl-8 text-xs text-gray-800">
            Cuando la <strong>fecha límite ya pasó</strong> y el trámite aún no está completado, se envía
            un aviso a los revisores con pendiente. Si se repite, el sistema esperará el intervalo
            indicado abajo para no saturar.
          </p>
          {dlOverdueEnabled ? (
            <div className="mt-3 flex items-center gap-3 pl-8">
              <span className="text-sm font-medium text-gray-900">Repetir cada</span>
              <input
                type="number"
                min={1}
                max={90}
                step={1}
                value={dlOverdueRepeatDays}
                onChange={(e) => setDlOverdueRepeatDays(Math.max(1, Math.min(90, parseInt(e.target.value, 10) || 1)))}
                className={`${adminInput} !w-16 shrink-0 text-center`}
              />
              <span className="text-sm font-medium text-gray-900">días mientras siga sin completar</span>
            </div>
          ) : null}
        </div>

        {/* Resumen visual */}
        <div className="mt-6 rounded-lg border border-rose-100 bg-white/80 p-4 text-xs text-gray-900">
          <p className="font-semibold text-gray-900">Resumen de reglas activas:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {dlReminderDays > 0 ? (
              <>
                <li>
                  <strong>Recordatorio:</strong> {dlReminderDays} día{dlReminderDays !== 1 ? 's' : ''} antes de la fecha
                  límite.
                </li>
                <li>
                  <strong>Urgente:</strong> cuando la fecha límite es hoy o mañana (dentro de los {dlReminderDays} días
                  configurados).
                </li>
              </>
            ) : (
              <li className="font-medium text-gray-700">Recordatorio previo desactivado.</li>
            )}
            {dlOverdueEnabled ? (
              <li>
                <strong>Vencido:</strong> aviso el mismo día y luego cada {dlOverdueRepeatDays} día
                {dlOverdueRepeatDays !== 1 ? 's' : ''}.
              </li>
            ) : (
              <li className="font-medium text-gray-700">Alerta post-vencimiento desactivada.</li>
            )}
          </ul>
        </div>
        <SectionSaveBar onSave={onSave} disabled={saveDisabled} pending={savePending} />
      </div>
    </div>
  );
}

export default function AdminWorkflowsPage() {
  const queryClient = useQueryClient();
  const { toasts, hideToast, success, error } = useToast();
  const formStateRef = useRef<WorkflowFormState | null>(null);

  const { data: metaAreas } = useQuery<MetaArea[]>({
    queryKey: ['meta-areas'],
    queryFn: async () => {
      const res = await fetch('/api/meta/areas', { credentials: 'include' });
      if (!res.ok) throw new Error('Error');
      const json = await res.json();
      return Array.isArray(json?.data) ? json.data : [];
    },
  });

  const { data: routing, isLoading, dataUpdatedAt } = useQuery<RoutingPayload>({
    queryKey: ['admin-routing-flows'],
    queryFn: async () => {
      const res = await fetch('/api/admin/routing-flows', { credentials: 'include' });
      if (!res.ok) throw new Error('Error al cargar enrutado');
      const json = await res.json();
      return json.data as RoutingPayload;
    },
  });

  const areaOptions = useMemo(
    () => (Array.isArray(metaAreas) ? metaAreas : []),
    [metaAreas]
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const snap = formStateRef.current;
      if (!snap) throw new Error('No hay datos del formulario');
      const { supAreas, supGate, directAreas, amountAlertThreshold, amountAlertAreaCodes, deadlineAlerts } = snap;
      const overlap = supAreas.filter((a) => directAreas.includes(a));
      if (overlap.length) throw new Error(`Áreas duplicadas en ambos flujos: ${overlap.join(', ')}`);
      if (supAreas.length > 0 && !supGate.trim()) {
        throw new Error('Indique el área de supervisión para el flujo con asignación');
      }
      if (amountAlertAreaCodes.length === 0) {
        throw new Error('Seleccione al menos un área para la alerta por monto');
      }
      const res = await fetch('/api/admin/routing-flows', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supervisionChain: {
            creatorAreas: supAreas.map((a) => a.toUpperCase()),
            supervisionArea: supGate.trim().toUpperCase() || undefined,
          },
          directLegal: { creatorAreas: directAreas.map((a) => a.toUpperCase()) },
          amountAlertThreshold,
          amountAlertAreaCodes: amountAlertAreaCodes.map((a) => a.toUpperCase()),
          deadlineAlerts,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al guardar');
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-routing-flows'] });
      success('Configuración guardada');
    },
    onError: (e: unknown) => error(e instanceof Error ? e.message : 'Error'),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-admin-text">
          <GitBranch className="h-7 w-7 text-admin-text-strong" />
          Flujos y enrutado
        </h1>
        <p className="mt-1 text-sm text-admin-text-secondary">
          Defina qué <strong className="text-admin-text">área del creador del trámite</strong> usa cada circuito. Sin
          filas aquí, el sistema aplica el flujo directo a Legal por defecto. Use <strong className="text-admin-text">Guardar</strong> en cada bloque para aplicar los cambios.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-admin-primary" />
        </div>
      ) : routing ? (
        <WorkflowForm
          key={dataUpdatedAt}
          routing={routing}
          areaOptions={areaOptions}
          stateRef={formStateRef}
          onSave={() => saveMutation.mutate()}
          saveDisabled={!routing}
          savePending={saveMutation.isPending}
        />
      ) : null}

      {toasts.map((t, i) => (
        <Toast key={t.id} message={t.message} type={t.type} zIndex={200 + i} onClose={() => hideToast(t.id)} />
      ))}
    </div>
  );
}
