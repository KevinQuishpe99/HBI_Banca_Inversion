'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { ApprovalActions } from '@/components/flow/ApprovalActions';
import { CircuitRealtimePanel } from '@/components/flow/CircuitRealtimePanel';
import { CircuitStepRow } from '@/components/flow/CircuitStepsList';
import { swalAlertError, swalAlertSuccess } from '@/lib/ui/swal';
import { useAreaMeta } from '@/hooks/useAreaLabelByCode';
import type { CaseWithCreator } from '@/types/case.types';
import type { WorkflowProgressView } from '@/types/flow.types';

type UserLite = {
  role: string;
  area?: string | null;
  areaId?: number;
  isAreaSupervisor?: boolean;
  isSigningArea?: boolean;
  isFinalStepArea?: boolean;
};

type AreaMeta = {
  id: number;
  area: string;
  label: string;
  sortOrder: number;
  isSelectable: boolean;
  isMandatory: boolean;
  /** Áreas de cierre del circuito (`es_paso_final` en BD). No se quitan desde la asignación. */
  isFinalStep: boolean;
  supervisorName: string | null;
};

type SupervisorFormContext = {
  kind: 'supervisor';
  caseId: string;
  user: UserLite | undefined;
  onSuccess: () => void;
  selected: string[];
  pick: string;
  setPick: (v: string) => void;
  finalizing: boolean;
  supervisionAreaCode: string | undefined;
  labelFor: (code: string) => string;
  toAddOptions: AreaMeta[];
  /** Meta de áreas (orden, colas fijas). */
  allAreasMeta: AreaMeta[];
  tailFixedCodes: string[];
  mayPersist: boolean;
  addPicked: () => void;
  removeAt: (code: string) => void;
  onSave: () => Promise<void>;
  saving: boolean;
  onFinalize: () => Promise<void>;
};

type SupervisionReviewContextValue =
  | null
  | { kind: 'gate' }
  | SupervisorFormContext;

const SupervisionReviewContext = createContext<SupervisionReviewContextValue>(null);

type ProviderProps = {
  caseId: string;
  caseData: CaseWithCreator;
  user: UserLite | undefined;
  onSuccess: () => void;
  children: ReactNode;
};

export function SupervisionReviewProvider({ caseId, caseData, user, onSuccess, children }: ProviderProps) {
  const [allAreasMeta, setAllAreasMeta] = useState<AreaMeta[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [pick, setPick] = useState('');
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const pending =
    caseData.routingFlow === 'SUPERVISION_CHAIN' &&
    !caseData.supervisionCompleted &&
    caseData.status === 'SUBMITTED';
  const supId = caseData.supervisionAreaId;
  /** Valor `area` en meta (id numérico como string) del área de supervisión; excluir del selector de «añadir». */
  const supervisionAreaCode = useMemo(
    () => (supId != null ? allAreasMeta.find((a) => a.id === supId)?.area : undefined),
    [allAreasMeta, supId]
  );

  /** Supervisor titular del área de supervisión del trámite, o administrador del sistema. */
  const canManageSupervisionAssignment = useMemo(() => {
    if (supId == null) return false;
    if (user?.role === 'ADMIN') return true;
    return (
      user?.role === 'AREA_USER' &&
      user.isAreaSupervisor === true &&
      user.areaId === supId
    );
  }, [user, supId]);

  const reviewKey = useMemo(
    () => (caseData.reviewAreaIds ?? []).slice().sort((a, b) => a - b).join(','),
    [caseData.reviewAreaIds]
  );

  const prevReviewKey = useRef<string | undefined>(undefined);

  useEffect(() => {
    prevReviewKey.current = undefined;
  }, [caseId]);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const res = await fetch('/api/meta/areas');
        const json = await res.json();
        if (c) return;
        const list = Array.isArray(json?.data) ? json.data : [];
        setAllAreasMeta(
          list.map(
            (a: {
              id: number;
              area: string;
              label: string;
              sortOrder?: number;
              isSelectable?: boolean;
              isMandatory?: boolean;
              isFinalStep?: boolean;
              supervisorName?: string | null;
            }) => {
              const sn = a.supervisorName != null ? String(a.supervisorName).trim() : '';
              return {
                id: a.id,
                area: a.area,
                label: a.label || a.area,
                sortOrder: typeof a.sortOrder === 'number' ? a.sortOrder : 999,
                isSelectable: Boolean(a.isSelectable),
                isMandatory: Boolean(a.isMandatory),
                isFinalStep: Boolean(a.isFinalStep),
                supervisorName: sn || null,
              };
            }
          )
        );
      } catch {
        // ignorar
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  useEffect(() => {
    if (allAreasMeta.length === 0) return;
    if (prevReviewKey.current !== undefined && prevReviewKey.current === reviewKey) return;
    prevReviewKey.current = reviewKey;

    const ids = caseData.reviewAreaIds ?? [];
    if (ids.length === 0) {
      setSelected([]);
      return;
    }
    const rows = ids
      .map((id) => allAreasMeta.find((a) => a.id === id))
      .filter((x): x is AreaMeta => !!x)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    setSelected(rows.map((r) => r.area));
  }, [reviewKey, allAreasMeta, caseData.reviewAreaIds]);

  const labelFor = useCallback(
    (code: string) => allAreasMeta.find((a) => a.area === code)?.label ?? code,
    [allAreasMeta]
  );

  const tailFixedCodes = useMemo(
    () =>
      allAreasMeta
        .filter((m) => m.isFinalStep)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((m) => m.area),
    [allAreasMeta]
  );

  const toAddOptions = allAreasMeta.filter(
    (a) =>
      !selected.includes(a.area) &&
      a.isSelectable &&
      (!supervisionAreaCode || a.area !== supervisionAreaCode) &&
      !tailFixedCodes.includes(a.area)
  );

  const mayPersist = selected.length > 0 || !!supervisionAreaCode;

  const addPicked = useCallback(() => {
    const code = pick.trim();
    if (!code || selected.includes(code)) return;
    setSelected((prev) => [...prev, code]);
    setPick('');
  }, [pick, selected]);

  const removeAt = useCallback(
    (code: string) => {
      if (supervisionAreaCode && code === supervisionAreaCode) return;
      if (tailFixedCodes.includes(code)) return;
      setSelected((prev) => prev.filter((x) => x !== code));
    },
    [supervisionAreaCode, tailFixedCodes]
  );

  const onSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/supervision-review-areas`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewAreas: selected }),
      });
      const json = await res.json().catch(() => ({} as { error?: string }));
      if (!res.ok) throw new Error(json?.error || 'No se pudo guardar');
      onSuccess();
      await swalAlertSuccess(
        'Circuito guardado',
        'Las áreas de revisión se guardaron correctamente. Puede seguir editando.'
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo guardar el circuito.';
      await swalAlertError('No se pudo guardar', msg);
    } finally {
      setSaving(false);
    }
  }, [caseId, selected, onSuccess]);

  const onFinalize = useCallback(async () => {
    setFinalizing(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/supervision-review-areas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewAreas: selected }),
      });
      const json = await res.json().catch(() => ({} as { error?: string }));
      if (!res.ok) throw new Error(json?.error || 'No se pudo enviar a revisión');
      onSuccess();
      await swalAlertSuccess(
        'Enviado a revisión',
        'El circuito quedó definido y el trámite sigue el flujo de revisión por áreas.'
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo completar la acción.';
      await swalAlertError('No se pudo aprobar', msg);
    } finally {
      setFinalizing(false);
    }
  }, [caseId, selected, onSuccess]);

  const value = useMemo((): SupervisionReviewContextValue => {
    if (!pending) return null;
    if (!canManageSupervisionAssignment) return { kind: 'gate' };
    return {
      kind: 'supervisor',
      caseId,
      user,
      onSuccess,
      selected,
      pick,
      setPick,
      finalizing,
      supervisionAreaCode,
      labelFor,
      toAddOptions,
      allAreasMeta,
      tailFixedCodes,
      mayPersist,
      addPicked,
      removeAt,
      onSave,
      saving,
      onFinalize,
    };
  }, [
    pending,
    canManageSupervisionAssignment,
    caseId,
    user,
    onSuccess,
    selected,
    pick,
    saving,
    finalizing,
    supervisionAreaCode,
    labelFor,
    toAddOptions,
    allAreasMeta,
    tailFixedCodes,
    mayPersist,
    addPicked,
    removeAt,
    onSave,
    onFinalize,
  ]);

  return (
    <SupervisionReviewContext.Provider value={value}>{children}</SupervisionReviewContext.Provider>
  );
}

export function useSupervisionReview(): SupervisionReviewContextValue {
  return useContext(SupervisionReviewContext);
}

/** Conecta el contexto de supervisión con el mismo `ApprovalActions` que el resto de áreas. */
export function SupervisionApprovalActionsBridge() {
  const v = useSupervisionReview();
  if (!v || v.kind !== 'supervisor') return null;
  return (
    <ApprovalActions
      caseId={v.caseId}
      canApprove
      canReturn
      userRole={v.user?.role}
      isSigningArea={v.user?.isSigningArea}
      isFinalStepArea={v.user?.isFinalStepArea}
      onSuccess={v.onSuccess}
      supervisionAssignmentMode
      onSupervisionApprove={v.onFinalize}
      supervisionApproveDisabled={!v.mayPersist}
      supervisionApproveLoading={v.finalizing}
    />
  );
}

const selectClass =
  'mt-0 block w-full max-w-md rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30';

type SupervisionReviewPanelProps = {
  flowSteps?: WorkflowProgressView[];
  presenceAreas?: readonly string[];
  presenceUsers?: readonly { area: string; displayName: string }[];
  /** Supervisor titular del área de supervisión (desde configuración). */
  supervisionSupervisorName?: string | null;
};

export function SupervisionReviewPanel({
  flowSteps = [],
  presenceAreas = [],
  presenceUsers = [],
  supervisionSupervisorName = null,
}: SupervisionReviewPanelProps) {
  const { areaLabelByCode, areaSupervisorByCode } = useAreaMeta();
  const v = useSupervisionReview();
  const supervisionAreaCodeForSuffix = v?.kind === 'supervisor' ? v.supervisionAreaCode : undefined;

  const supervisorSuffixForArea = useCallback(
    (code: string) => {
      const fromApi = areaSupervisorByCode[code] != null ? String(areaSupervisorByCode[code]).trim() : '';
      if (fromApi) return fromApi;
      if (
        supervisionAreaCodeForSuffix &&
        code === supervisionAreaCodeForSuffix &&
        supervisionSupervisorName?.trim()
      ) {
        return supervisionSupervisorName.trim();
      }
      return null;
    },
    [areaSupervisorByCode, supervisionAreaCodeForSuffix, supervisionSupervisorName]
  );

  /** Debe ejecutarse siempre (antes de returns): si no, React detecta distinto número de hooks entre gate / supervisor / null. */
  const orderedRows = useMemo(() => {
    if (!v || v.kind !== 'supervisor') {
      return [] as { code: string; kind: 'supervision' | 'middle' | 'tail' }[];
    }
    const { selected, supervisionAreaCode, tailFixedCodes, allAreasMeta } = v;
    const mid = selected
      .filter((c) => c !== supervisionAreaCode && !tailFixedCodes.includes(c))
      .sort((a, b) => {
        const ma = allAreasMeta.find((x) => x.area === a);
        const mb = allAreasMeta.find((x) => x.area === b);
        return (ma?.sortOrder ?? 999) - (mb?.sortOrder ?? 999);
      });
    const out: { code: string; kind: 'supervision' | 'middle' | 'tail' }[] = [];
    if (supervisionAreaCode) out.push({ code: supervisionAreaCode, kind: 'supervision' });
    for (const c of mid) out.push({ code: c, kind: 'middle' });
    for (const t of tailFixedCodes) out.push({ code: t, kind: 'tail' });
    return out;
  }, [v]);

  const supervisorCircuitSteps = useMemo((): WorkflowProgressView[] => {
    if (!v || v.kind !== 'supervisor') return [];
    const { caseId, labelFor } = v;
    return orderedRows.map((row, idx) => {
      const label = labelFor(row.code);
      const existing = flowSteps.find((s) => s.requiredArea === row.code);
      if (existing) {
        return { ...existing, stepOrder: idx + 1, stepName: existing.stepName || `Revisión ${label}` };
      }
      return {
        caseId,
        workflowTemplateId: '',
        workflowName: '',
        stepOrder: idx + 1,
        stepName: label,
        requiredArea: row.code,
        stepStatus: 'PENDING',
      };
    });
  }, [v, orderedRows, flowSteps]);

  if (!v) return null;

  if (v.kind === 'gate') {
    return (
      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
        <p className="font-medium">Pendiente de supervisión</p>
        {supervisionSupervisorName ? (
          <p className="mt-1 text-amber-950/95">
            Supervisor titular: <strong>{supervisionSupervisorName}</strong>
          </p>
        ) : (
          <p className="mt-1 text-amber-900/85">No hay supervisor titular registrado para el área de supervisión.</p>
        )}
        <p className="mt-1 text-amber-900/90">
          Esa persona debe asignar las áreas que revisarán este trámite antes de que continúe el flujo.
        </p>
      </div>
    );
  }

  const {
    selected,
    pick,
    setPick,
    labelFor,
    toAddOptions,
    addPicked,
    removeAt,
    onSave,
    saving,
    mayPersist,
    finalizing,
  } = v;

  const saveBusy = saving || finalizing;

  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow sm:p-6">
      <h3 className="text-base font-semibold sm:text-lg text-gray-900">Áreas para la revisión del trámite</h3>
      {!supervisionSupervisorName ? (
        <p className="mt-1 text-sm text-amber-800">
          Aviso: no hay supervisor titular registrado para el área de supervisión (revise la configuración de usuarios).
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <label htmlFor="supervision-add-area" className="sr-only">
            Área a añadir
          </label>
          <select
            id="supervision-add-area"
            className={selectClass}
            value={pick}
            onChange={(e) => setPick(e.target.value)}
          >
            <option value="">Elegir área para añadir…</option>
            {toAddOptions.map((a) => (
              <option key={a.area} value={a.area}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={!pick || selected.includes(pick)}
          onClick={addPicked}
          className="inline-flex min-h-[2.5rem] flex-1 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-initial"
        >
          <Plus className="h-4 w-4 shrink-0" />
          Añadir
        </button>
        <button
          type="button"
          disabled={saveBusy || !mayPersist}
          onClick={() => void onSave()}
          className="inline-flex min-h-[2.5rem] flex-1 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-initial"
        >
          {saving ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Save className="h-4 w-4 shrink-0" />}
          Guardar
        </button>
      </div>

      <CircuitRealtimePanel steps={flowSteps} presenceUsers={presenceUsers} />

      <div className="mt-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">Orden de revisión</p>
        {orderedRows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-600">
            Cargando configuración de áreas…
          </p>
        ) : (
          <ol className="space-y-2">
            {orderedRows.map((row, idx) => {
              const step = supervisorCircuitSteps[idx];
              if (!step) return null;
              const badge =
                row.kind === 'supervision' ? (
                  <span className="rounded bg-slate-100 px-1.5 py-px text-[10px] font-medium uppercase text-slate-600">
                    Supervisión
                  </span>
                ) : row.kind === 'tail' ? (
                  <span className="rounded bg-slate-100 px-1.5 py-px text-[10px] font-medium uppercase text-slate-600">
                    Cierre
                  </span>
                ) : null;
              const trailing =
                row.kind === 'middle' ? (
                  <button
                    type="button"
                    onClick={() => removeAt(row.code)}
                    className="rounded p-1 text-red-600 hover:bg-red-50"
                    title={`Quitar ${labelFor(row.code)}`}
                    aria-label={`Quitar ${labelFor(row.code)}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  badge
                );
              return (
                <CircuitStepRow
                  key={`${row.kind}-${row.code}`}
                  step={step}
                  indexNumber={idx + 1}
                  areaLabelByCode={areaLabelByCode}
                  presenceAreas={presenceAreas}
                  presenceUsers={presenceUsers}
                  trailingSlot={trailing}
                  titleSuffix={supervisorSuffixForArea(row.code)}
                  indexBadgeVariant={
                    row.kind === 'supervision'
                      ? 'supervisionFixed'
                      : row.kind === 'tail'
                        ? 'fixedClosing'
                        : 'default'
                  }
                />
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
