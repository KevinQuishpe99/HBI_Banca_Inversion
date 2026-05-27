'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { CircuitRealtimePanel } from '@/components/flow/CircuitRealtimePanel';
import { CircuitStepsList } from '@/components/flow/CircuitStepsList';
import { CaseFilesPanel } from '@/components/files/CaseFilesPanel';
import { CaseDocumentsInfo } from '@/components/cases/CaseDocumentsInfo';
import { ApprovalActions } from '@/components/flow/ApprovalActions';
import { SubmitCaseButton } from '@/components/cases/SubmitCaseButton';
import {
  SupervisionApprovalActionsBridge,
  SupervisionReviewPanel,
  useSupervisionReview,
} from '@/components/cases/SupervisionReviewPanel';
import { CaseInformation } from '@/components/cases/CaseInformation';
import { formatCaseNumber } from '@/lib/utils/format';
import type { CaseWithCreator } from '@/types/case.types';
import type { User } from 'next-auth';
import type { WorkflowProgressView } from '@/types/flow.types';
import { areaLabels } from '@/components/admin/user-management/labels';
import { useQuery } from '@tanstack/react-query';
import { useCaseRealtime } from '@/hooks/useCaseRealtime';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { AuditLogWithUser, CommentWithUser } from '@/types/history.types';
import {
  auditIsFileReplacement,
  auditIsResubmitEvent,
  fileUploadAuditIdsConsolidatedIntoResubmit,
  parseAuditNewValueRecord,
} from '@/lib/history/audit-helpers';

type Tab = 'info' | 'review' | 'files';

type FlowRow =
  | { kind: 'audit'; at: number; audit: AuditLogWithUser }
  | { kind: 'comment'; at: number; comment: CommentWithUser };

type FlowDisplayRow = { kind: 'single'; row: FlowRow } | { kind: 'merged_uploads'; audits: AuditLogWithUser[] };

const GENERAL_HISTORY_KEY = '__general__';

/**
 * En auditoría/comentarios `userArea` viene de `usuarios.area_id` (número).
 * Lo unificamos al identificador de área (`area` en meta = id como string) para agrupar y mostrar etiquetas.
 */
function historySectionKeyForUserArea(
  raw: string | number | null | undefined,
  areaConfig: Array<{ id: number; area: string; label: string }>
): string {
  if (raw == null || raw === '') return GENERAL_HISTORY_KEY;
  const s = String(raw).trim();
  if (!s) return GENERAL_HISTORY_KEY;
  const n = Number(s);
  if (Number.isFinite(n) && String(n) === s) {
    const byId = areaConfig.find((a) => a.id === n);
    if (byId) return byId.area;
  }
  return s;
}

/** Comentario generado al devolver: mismo texto inicial que el audit RETURNED emparejado (evita mostrar solo «Comentario…»). */
function commentIsDevolucionAlExpediente(comment: CommentWithUser, history: AuditLogWithUser[]): boolean {
  const ct = new Date(comment.createdAt as unknown as string).getTime();
  for (const h of history) {
    if (h.action !== 'RETURNED' || h.comments == null) continue;
    const ht = new Date(h.createdAt as unknown as string).getTime();
    if (Number.isNaN(ht) || Number.isNaN(ct)) continue;
    if (Math.abs(ct - ht) > 8000) continue;
    if (comment.content.trim().startsWith(String(h.comments).trim())) return true;
  }
  return false;
}

/** Extrae nombre de archivo del JSON en audit.new_value (subidas y reemplazos). */
function parseFileNameFromAudit(audit: AuditLogWithUser): string | null {
  const obj = parseAuditNewValueRecord(audit);
  const fn = obj?.fileName;
  return fn != null ? String(fn).trim() || null : null;
}

/** Agrupa subidas consecutivas del mismo usuario en pocos segundos (p. ej. varios archivos en una tanda). */
function mergeConsecutiveFileUploads(rows: FlowRow[]): FlowDisplayRow[] {
  const out: FlowDisplayRow[] = [];
  let i = 0;
  while (i < rows.length) {
    const cur = rows[i];
    if (cur.kind === 'audit' && cur.audit.action === 'FILE_UPLOADED') {
      const batch: AuditLogWithUser[] = [cur.audit];
      const isReplacement = auditIsFileReplacement(cur.audit);
      let j = i + 1;
      while (j < rows.length) {
        const next = rows[j];
        if (next.kind !== 'audit' || next.audit.action !== 'FILE_UPLOADED') break;
        if (next.audit.usuarioId !== batch[0].usuarioId) break;
        if (auditIsFileReplacement(next.audit) !== isReplacement) break;
        const prevT = new Date(batch[batch.length - 1].createdAt as unknown as string).getTime();
        const nextT = new Date(next.audit.createdAt as unknown as string).getTime();
        if (Number.isNaN(prevT) || Number.isNaN(nextT) || nextT - prevT > 15000) break;
        batch.push(next.audit);
        j++;
      }
      if (batch.length === 1) {
        out.push({ kind: 'single', row: cur });
        i++;
      } else {
        out.push({ kind: 'merged_uploads', audits: batch });
        i = j;
      }
    } else {
      out.push({ kind: 'single', row: cur });
      i++;
    }
  }
  return out;
}

type SectionTheme = {
  header: string;
  headingText: string;
  badge: string;
  line: string;
  dot: string;
  card: string;
  cardMuted: string;
  commentCard: string;
  commentMuted: string;
};

const SECTION_THEME: Record<string, SectionTheme> = {
  [GENERAL_HISTORY_KEY]: {
    header: 'border-l-4 border-slate-500 bg-gradient-to-r from-slate-50 to-slate-100/80',
    headingText: 'text-slate-900',
    badge: 'bg-slate-600 text-white',
    line: 'border-slate-300',
    dot: 'bg-slate-600',
    card: 'border-slate-200 bg-white',
    cardMuted: 'text-slate-600',
    commentCard: 'border-sky-200 bg-sky-50/90',
    commentMuted: 'text-sky-900/80',
  },
  COMERCIAL: {
    header: 'border-l-4 border-amber-500 bg-gradient-to-r from-amber-50 to-amber-100/70',
    headingText: 'text-amber-950',
    badge: 'bg-amber-600 text-white',
    line: 'border-amber-300',
    dot: 'bg-amber-600',
    card: 'border-amber-200/90 bg-white',
    cardMuted: 'text-amber-900/80',
    commentCard: 'border-amber-200 bg-amber-50/90',
    commentMuted: 'text-amber-950/90',
  },
  TECNICA: {
    header: 'border-l-4 border-blue-600 bg-gradient-to-r from-blue-50 to-blue-100/70',
    headingText: 'text-blue-950',
    badge: 'bg-blue-600 text-white',
    line: 'border-blue-300',
    dot: 'bg-blue-600',
    card: 'border-blue-200/90 bg-white',
    cardMuted: 'text-blue-900/80',
    commentCard: 'border-blue-200 bg-blue-50/90',
    commentMuted: 'text-blue-950/90',
  },
  FINANCIERA: {
    header: 'border-l-4 border-emerald-600 bg-gradient-to-r from-emerald-50 to-emerald-100/70',
    headingText: 'text-emerald-950',
    badge: 'bg-emerald-600 text-white',
    line: 'border-emerald-300',
    dot: 'bg-emerald-600',
    card: 'border-emerald-200/90 bg-white',
    cardMuted: 'text-emerald-900/80',
    commentCard: 'border-emerald-200 bg-emerald-50/90',
    commentMuted: 'text-emerald-950/90',
  },
  LEGAL: {
    header: 'border-l-4 border-violet-600 bg-gradient-to-r from-violet-50 to-violet-100/70',
    headingText: 'text-violet-950',
    badge: 'bg-violet-600 text-white',
    line: 'border-violet-300',
    dot: 'bg-violet-600',
    card: 'border-violet-200/90 bg-white',
    cardMuted: 'text-violet-900/80',
    commentCard: 'border-violet-200 bg-violet-50/90',
    commentMuted: 'text-violet-950/90',
  },
  DIRECTOR_GENERAL: {
    header: 'border-l-4 border-rose-600 bg-gradient-to-r from-rose-50 to-rose-100/70',
    headingText: 'text-rose-950',
    badge: 'bg-rose-600 text-white',
    line: 'border-rose-300',
    dot: 'bg-rose-600',
    card: 'border-rose-200/90 bg-white',
    cardMuted: 'text-rose-900/80',
    commentCard: 'border-rose-200 bg-rose-50/90',
    commentMuted: 'text-rose-950/90',
  },
};

const FALLBACK_THEMES: SectionTheme[] = [
  SECTION_THEME.TECNICA,
  SECTION_THEME.FINANCIERA,
  SECTION_THEME.COMERCIAL,
  SECTION_THEME.LEGAL,
];

function getSectionTheme(sectionKey: string, sectionIndex: number): SectionTheme {
  return SECTION_THEME[sectionKey] ?? FALLBACK_THEMES[sectionIndex % FALLBACK_THEMES.length]!;
}

function UploadHistoryCard({ audits, theme }: { audits: AuditLogWithUser[]; theme: SectionTheme }) {
  const first = audits[0]!;
  const dateStr = format(new Date(first.createdAt as unknown as string), "d MMM yyyy, HH:mm", { locale: es });
  const names = audits.map(parseFileNameFromAudit).filter((n): n is string => !!n);
  const isReplacement = audits.length > 0 && audits.every(auditIsFileReplacement);
  const title =
    isReplacement && audits.length > 1
      ? 'Archivos actualizados'
      : isReplacement
        ? 'Archivo actualizado'
        : audits.length > 1
          ? 'Archivos subidos'
          : 'Archivo subido';
  const listIntro = isReplacement
    ? 'Documentos sustituidos por una nueva versión:'
    : 'Documentos incluidos en esta acción:';
  const emptyMsg = isReplacement
    ? 'Se registró la actualización; el nombre del archivo no está disponible en este registro.'
    : 'Se registró la subida; el nombre del archivo no está disponible en este registro.';
  return (
    <div className={`rounded-lg border px-3 py-2 shadow-sm ${theme.card}`}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-sm font-semibold text-gray-900">{title}</span>
        <span className={`text-xs ${theme.cardMuted}`}>{dateStr}</span>
      </div>
      {first.userName ? <p className={`mt-0.5 text-xs ${theme.cardMuted}`}>Por: {first.userName}</p> : null}
      <p className="mt-2 text-xs text-gray-600">{listIntro}</p>
      {names.length > 0 ? (
        <ol className="mt-1.5 list-decimal space-y-0.5 pl-5 text-sm text-gray-800">
          {names.map((n, i) => (
            <li key={`${n}-${i}`}>{n}</li>
          ))}
        </ol>
      ) : (
        <p className="mt-1.5 text-xs text-gray-500">{emptyMsg}</p>
      )}
    </div>
  );
}

type Props = {
  caseId: string;
  caseData: CaseWithCreator;
  user: (Pick<NonNullable<User>, 'id' | 'role'> & {
    area?: string | null;
    areaId?: number;
    canSign?: boolean;
    isSigningArea?: boolean;
    isFinalStepArea?: boolean;
    isAreaSupervisor?: boolean;
    puedeCompletarTramite?: boolean;
  }) | undefined;
  canApprove: boolean;
  canReturn: boolean;
  canUploadFiles: boolean;
  canDeleteNonInitialFiles: boolean;
  canCommentFile: boolean;
  canSubmit: boolean;
  workflow: WorkflowProgressView[] | undefined;
  workflowLoading: boolean;
  onApprovalSuccess: () => void;
  onSubmitSuccess: () => void;
};

export function CaseDetailView({
  caseId,
  caseData,
  user,
  canApprove,
  canReturn,
  canUploadFiles,
  canDeleteNonInitialFiles,
  canCommentFile,
  canSubmit,
  workflow,
  workflowLoading,
  onApprovalSuccess,
  onSubmitSuccess,
}: Props) {
  const showApprovalBar =
    canApprove && (caseData.status === 'SUBMITTED' || caseData.status === 'IN_REVIEW');

  const { connected: realtimeConnected } = useCaseRealtime(caseId);
  const supervisionReview = useSupervisionReview();
  const showSupervisorMergedCircuit = supervisionReview?.kind === 'supervisor';
  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [areaConfig, setAreaConfig] = useState<
    Array<{
      id: number;
      area: string;
      label: string;
      isSelectable: boolean;
      isMandatory: boolean;
      sortOrder?: number;
    }>
  >([]);
  const isSignerDownloader = useMemo(
    () =>
      !!user &&
      user.role === 'AREA_USER' &&
      !!user.canSign &&
      (!!user.isSigningArea || !!user.isFinalStepArea || !!user.puedeCompletarTramite),
    [user]
  );

  const canDownloadFiles = useMemo(
    () =>
      !!user &&
      (user.role === 'ADMIN' ||
        isSignerDownloader ||
        (user.role === 'AREA_USER' &&
          user.isAreaSupervisor === true &&
          (!!user.isSigningArea || !!user.isFinalStepArea || !!user.puedeCompletarTramite))),
    [user, isSignerDownloader]
  );

  const canDownloadSignedFiles = useMemo(
    () =>
      !!user &&
      !!caseData &&
      (user.role === 'ADMIN' || user.id === caseData.createdBy || isSignerDownloader),
    [user, caseData, isSignerDownloader]
  );

  /** Supervisor del área de supervisión (Flujo 1): puede asignar áreas aunque session.areaId no coincida con id. */
  const isSupervisionGateSupervisor = useMemo(() => {
    if (!user || user.role !== 'AREA_USER' || !user.isAreaSupervisor || !caseData) return false;
    if (caseData.routingFlow !== 'SUPERVISION_CHAIN') return false;
    const sid = caseData.supervisionAreaId;
    if (sid == null) return false;
    return user.areaId != null && user.areaId === sid;
  }, [user, caseData]);

  const awaitingSupervisionAssignment =
    !caseData.supervisionCompleted &&
    caseData.status === 'SUBMITTED' &&
    caseData.routingFlow === 'SUPERVISION_CHAIN' &&
    (isSupervisionGateSupervisor || user?.role === 'ADMIN');

  useEffect(() => {
    // Necesario para: labels del stepper, áreas obligatorias, selector de agregar área.
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/meta/areas');
        const json = await res.json();
        if (cancelled) return;
        const list = Array.isArray(json?.data) ? json.data : [];
        setAreaConfig(list);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Presencia en tiempo real solo cuando el usuario está en la pestaña "Proceso de revisión".
    if (
      activeTab !== 'review' ||
      caseData.status !== 'IN_REVIEW' ||
      user?.role !== 'AREA_USER' ||
      !user?.area
    ) {
      return;
    }
    const ping = () => {
      void fetch(`/api/cases/${caseId}/review-presence`, { method: 'POST' }).catch(() => {});
    };
    ping();
    const t = setInterval(ping, 20_000);
    return () => {
      clearInterval(t);
      void fetch(`/api/cases/${caseId}/review-presence`, { method: 'DELETE' }).catch(() => {});
    };
  }, [activeTab, caseData.status, caseId, user?.role, user?.area]);

  const effectiveSelectedReviewAreas = useMemo(() => {
    const ids = caseData.reviewAreaIds ?? [];
    return ids
      .map((id) => areaConfig.find((a) => a.id === id)?.area)
      .filter((code): code is string => !!code);
  }, [caseData.reviewAreaIds, areaConfig]);

  const mandatoryAreas = useMemo(
    () => areaConfig.filter((a) => a.isMandatory).map((a) => a.area),
    [areaConfig]
  );

  const displayAreas = useMemo(() => {
    const set = new Set<string>();
    for (const a of effectiveSelectedReviewAreas) set.add(a);
    for (const a of mandatoryAreas) set.add(a);
    return Array.from(set);
  }, [effectiveSelectedReviewAreas, mandatoryAreas]);

  const displaySteps = useMemo((): WorkflowProgressView[] => {
    const base = Array.isArray(workflow) ? workflow : [];
    /** Fase de supervisión: el circuito completo (supervisión + medias + cierre) solo lo arma el servidor. */
    const supervisionAwaitingAssignment =
      caseData.routingFlow === 'SUPERVISION_CHAIN' &&
      !caseData.supervisionCompleted &&
      caseData.status === 'SUBMITTED';
    if (supervisionAwaitingAssignment) {
      /** No mezclar solo `tramite_areas_revision` + obligatorias: perderíamos el paso de supervisión (p. ej. si /api/flow/next falló antes). */
      return base;
    }
    if (!displayAreas.length) return base;
    const byArea = new Map<string, WorkflowProgressView>();
    for (const s of base) byArea.set(s.requiredArea, s);
    const sortedAreas = [...displayAreas].sort((a, b) => {
      const aRow = areaConfig.find((x) => x.area === a);
      const bRow = areaConfig.find((x) => x.area === b);
      const ao = typeof aRow?.sortOrder === 'number' ? aRow.sortOrder : 999;
      const bo = typeof bRow?.sortOrder === 'number' ? bRow.sortOrder : 999;
      return ao - bo;
    });
    const out: WorkflowProgressView[] = [];
    let i = 1;
    for (const area of sortedAreas) {
      const existing = byArea.get(area);
      if (existing) {
        out.push(existing);
        continue;
      }
      const label = areaConfig.find((x) => x.area === area)?.label || areaLabels[area] || area;
      out.push({
        caseId,
        workflowTemplateId: '',
        workflowName: 'Revisión por áreas',
        stepOrder: i++,
        stepName: `Revisión ${label}`,
        requiredArea: area,
        stepStatus: 'PENDING',
      });
    }
    return out.length ? out : base;
  }, [workflow, displayAreas, areaConfig, caseId, caseData.routingFlow, caseData.supervisionCompleted, caseData.status]);

  const { data: presencePayload } = useQuery({
    queryKey: ['case-review-presence', caseId, activeTab],
    queryFn: async () => {
      const res = await fetch(`/api/cases/${caseId}/review-presence`);
      if (!res.ok) return { areas: [] as string[], presence: [] as { area: string; displayName: string }[] };
      const json = await res.json();
      const d = json?.data;
      const areas = (d?.areas ?? []) as string[];
      const presence = (d?.presence ?? []) as { area: string; displayName: string }[];
      return { areas, presence };
    },
    enabled: !!caseId && activeTab === 'review',
    refetchInterval: activeTab === 'review' ? (realtimeConnected ? 20_000 : 4_000) : false,
  });
  const presenceAreas = presencePayload?.areas ?? [];
  const presenceUsers = presencePayload?.presence ?? [];

  const tabs = useMemo(() => {
    const base: [Tab, string][] = [
      ['info', 'Información del trámite'],
      ['review', 'Proceso de revisión'],
      ['files', 'Archivos del trámite'],
    ];
    return base;
  }, []);

  const { data: caseHistoryPayload, isLoading: caseHistoryLoading } = useQuery({
    queryKey: ['case-history', caseId],
    queryFn: async () => {
      const res = await fetch(`/api/cases/${caseId}/history`);
      if (!res.ok) throw new Error('Error al cargar historial');
      const json = await res.json();
      return json.data as { history: AuditLogWithUser[]; comments: CommentWithUser[] };
    },
    enabled: activeTab === 'review',
  });

  const reviewFlowTimeline = useMemo(() => {
    const hist = caseHistoryPayload?.history ?? [];
    const comm = caseHistoryPayload?.comments ?? [];
    /** Evitar duplicar: el comentario largo ya incluye el motivo; ocultamos la fila de auditoría RETURNED emparejada. */
    const skipAuditIds = new Set<string>();
    for (const h of hist) {
      if (h.action !== 'RETURNED' || h.comments == null) continue;
      const ht = new Date(h.createdAt as unknown as string).getTime();
      for (const c of comm) {
        if (Number.isNaN(ht)) break;
        const ct = new Date(c.createdAt as unknown as string).getTime();
        if (Math.abs(ct - ht) > 8000) continue;
        if (c.content.trim().startsWith(String(h.comments).trim())) {
          skipAuditIds.add(h.id);
          break;
        }
      }
    }
    const skipFileUploadConsolidated = fileUploadAuditIdsConsolidatedIntoResubmit(hist);
    type Row =
      | { kind: 'audit'; at: number; audit: AuditLogWithUser }
      | { kind: 'comment'; at: number; comment: CommentWithUser };
    const rows: Row[] = [];
    for (const h of hist) {
      if (skipAuditIds.has(h.id)) continue;
      if (skipFileUploadConsolidated.has(h.id)) continue;
      // Ruido técnico: el flujo ya se ve en el stepper y en otras acciones (aprobación, envío, etc.)
      if (h.action === 'STATUS_CHANGED') continue;
      rows.push({ kind: 'audit', at: new Date(h.createdAt as unknown as string).getTime(), audit: h });
    }
    for (const c of comm) {
      rows.push({ kind: 'comment', at: new Date(c.createdAt as unknown as string).getTime(), comment: c });
    }
    rows.sort((a, b) => a.at - b.at);
    return rows;
  }, [caseHistoryPayload]);

  const groupedHistorySections = useMemo(() => {
    type Row =
      | { kind: 'audit'; at: number; audit: AuditLogWithUser }
      | { kind: 'comment'; at: number; comment: CommentWithUser };
    const rows = reviewFlowTimeline as Row[];
    const map = new Map<string, Row[]>();
    for (const row of rows) {
      const raw =
        row.kind === 'audit' ? row.audit.userArea ?? null : row.comment.userArea ?? null;
      const key = historySectionKeyForUserArea(raw, areaConfig);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    const orderedKeys: string[] = [];
    if (map.has(GENERAL_HISTORY_KEY)) orderedKeys.push(GENERAL_HISTORY_KEY);
    for (const a of displayAreas) {
      if (map.has(a) && !orderedKeys.includes(a)) orderedKeys.push(a);
    }
    const rest = [...map.keys()]
      .filter((k) => !orderedKeys.includes(k))
      .sort((a, b) => a.localeCompare(b, 'es'));
    orderedKeys.push(...rest);
    return orderedKeys
      .filter((k) => (map.get(k)?.length ?? 0) > 0)
      .map((key) => ({
        key,
        label:
          key === GENERAL_HISTORY_KEY
            ? 'Solicitud y trámite'
            : areaConfig.find((x) => x.area === key)?.label || areaLabels[key as keyof typeof areaLabels] || key,
        rows: map.get(key)! as FlowRow[],
      }));
  }, [reviewFlowTimeline, displayAreas, areaConfig]);

  const groupedHistorySectionsDisplay = useMemo(
    () =>
      groupedHistorySections.map((section) => ({
        ...section,
        displayRows: mergeConsecutiveFileUploads(section.rows),
      })),
    [groupedHistorySections]
  );

  const auditActionLabel = (action: string) => {
    const map: Record<string, string> = {
      CREATED: 'Trámite creado',
      SUBMITTED: 'Trámite enviado',
      RESUBMITTED: 'Trámite reenviado para revisión',
      APPROVED: 'Aprobación de paso',
      REJECTED: 'Devuelto',
      RETURNED: 'Devolución para corrección',
      UPDATED: 'Actualización',
      FILE_UPLOADED: 'Archivos subidos',
      FILE_DELETED: 'Archivo eliminado',
      COMMENT_ADDED: 'Comentario',
      STATUS_CHANGED: 'Cambio de estado',
      ASSIGNED: 'Asignación',
      COMPLETED: 'Trámite completado',
      CANCELLED: 'Trámite cerrado',
    };
    return map[action] ?? action;
  };

  const auditTitleForRow = (audit: AuditLogWithUser) =>
    auditIsResubmitEvent(audit) ? 'Trámite reenviado para revisión' : auditActionLabel(audit.action);

  return (
    <div className="space-y-4 sm:space-y-6">
      <header>
        <Link
          href="/cases"
          className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a trámites
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2 sm:gap-3">
              <h2 className="break-words text-xl font-bold text-gray-900 sm:text-2xl">{caseData.title}</h2>
              <StatusBadge status={caseData.status} />
            </div>
            <p className="text-sm text-gray-600 sm:text-base">{formatCaseNumber(caseData.caseNumber)}</p>
            {caseData.description ? (
              <p className="mt-2 text-sm text-gray-700 sm:text-base">{caseData.description}</p>
            ) : null}

            {user?.role === 'AREA_USER' ? (
              <div className="mt-3">
                {canApprove ? (
                  <div className="inline-flex max-w-xl items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-800">
                    <span className="h-2 w-2 flex-shrink-0 rounded-full bg-green-500" />
                    Turno de su área para revisar
                  </div>
                ) : awaitingSupervisionAssignment ? (
                  <div className="inline-flex max-w-xl items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-medium text-violet-900">
                    <span className="h-2 w-2 flex-shrink-0 rounded-full bg-violet-500" />
                    Defina las áreas de revisión del trámite
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600">
                    <span className="h-2 w-2 rounded-full bg-gray-400" />
                    Solo lectura - No asignado a su área
                  </div>
                )}
              </div>
            ) : user?.role === 'ADMIN' && awaitingSupervisionAssignment ? (
              <div className="mt-3">
                <div className="inline-flex max-w-xl items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-medium text-violet-900">
                  <span className="h-2 w-2 flex-shrink-0 rounded-full bg-violet-500" />
                  Defina las áreas de revisión del trámite (administrador: use la pestaña «Proceso de revisión»)
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {canSubmit ? <SubmitCaseButton caseId={caseId} onSuccess={onSubmitSuccess} /> : null}

      <SupervisionApprovalActionsBridge />

      {showApprovalBar ? (
        <ApprovalActions
          caseId={caseId}
          canApprove={canApprove}
          canReturn={canReturn}
          userArea={user?.area}
          userRole={user?.role}
          isSigningArea={user?.isSigningArea}
          isFinalStepArea={user?.isFinalStepArea}
          puedeCompletarTramite={user?.puedeCompletarTramite}
          onSuccess={onApprovalSuccess}
        />
      ) : null}

      <div className="overflow-x-auto border-b border-gray-200">
        <nav className="-mb-px flex min-w-max space-x-4 px-1 sm:space-x-8">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`whitespace-nowrap border-b-2 px-1 py-3 text-xs font-medium sm:py-4 sm:text-sm ${
                activeTab === id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      <div className="rounded-lg bg-white p-4 shadow sm:p-6">
        {activeTab === 'info' ? (
          <div className="space-y-6">
            <CaseInformation caseData={caseData} />
          </div>
        ) : null}

        {activeTab === 'review' ? (
          <div>
            <h3 className="mb-6 text-xl font-bold text-gray-900">Proceso de revisión</h3>

            <SupervisionReviewPanel
              flowSteps={displaySteps}
              presenceAreas={presenceAreas}
              presenceUsers={presenceUsers}
              supervisionSupervisorName={caseData.supervisionSupervisorName}
            />

            {workflowLoading && !showSupervisorMergedCircuit ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : !showSupervisorMergedCircuit && displaySteps && displaySteps.length > 0 ? (
              <>
                <CircuitRealtimePanel steps={displaySteps} presenceUsers={presenceUsers} />
                <CircuitStepsList
                  steps={displaySteps}
                  presenceAreas={presenceAreas}
                  presenceUsers={presenceUsers}
                />
              </>
            ) : !showSupervisorMergedCircuit && !workflowLoading ? (
              <p className="py-8 text-center text-gray-500">No hay pasos de revisión por áreas.</p>
            ) : null}

            <div className="mt-10 border-t border-gray-200 pt-8">
              <h4 className="text-lg font-semibold text-gray-900">Historial del flujo</h4>
              <p className="mt-1 text-sm text-gray-600">
                El color indica el área. Varias subidas seguidas del mismo usuario se muestran como una sola acción
                «Archivos subidos».
              </p>
              {caseHistoryLoading ? (
                <div className="mt-4 flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              ) : groupedHistorySectionsDisplay.length === 0 ? (
                <p className="mt-4 text-sm text-gray-500">Aún no hay registros en el historial.</p>
              ) : (
                <div className="mt-6 space-y-10">
                  {groupedHistorySectionsDisplay.map((section, sectionIndex) => {
                    const theme = getSectionTheme(section.key, sectionIndex);
                    const safeId = String(section.key).replace(/[^a-zA-Z0-9_-]/g, '_');
                    return (
                      <section key={section.key} aria-labelledby={`history-area-${safeId}`}>
                        <h5
                          id={`history-area-${safeId}`}
                          className={`mb-3 flex flex-wrap items-center gap-2 rounded-r-lg border border-gray-200/80 px-3 py-2.5 text-base font-semibold shadow-sm ${theme.header} ${theme.headingText}`}
                        >
                          <span
                            className={`flex h-7 min-w-[1.75rem] items-center justify-center rounded-full text-xs font-bold ${theme.badge}`}
                          >
                            {sectionIndex + 1}
                          </span>
                          <span>{section.label}</span>
                        </h5>
                        <ol className={`space-y-4 border-l-2 pl-4 ${theme.line}`}>
                          {section.displayRows.map((display, idx) => {
                            if (display.kind === 'merged_uploads') {
                              const first = display.audits[0]!;
                              return (
                                <li key={`${section.key}-mu-${first.id}`} className="relative">
                                  <span
                                    className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white ring-1 ring-white/80 ${theme.dot}`}
                                  />
                                  <UploadHistoryCard audits={display.audits} theme={theme} />
                                </li>
                              );
                            }
                            const row = display.row;
                            const dateStr =
                              row.kind === 'audit'
                                ? format(new Date(row.audit.createdAt as unknown as string), "d MMM yyyy, HH:mm", {
                                    locale: es,
                                  })
                                : format(new Date(row.comment.createdAt as unknown as string), "d MMM yyyy, HH:mm", {
                                    locale: es,
                                  });
                            if (row.kind === 'audit' && row.audit.action === 'FILE_UPLOADED') {
                              return (
                                <li key={`${section.key}-u-${row.audit.id}`} className="relative">
                                  <span
                                    className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white ring-1 ring-white/80 ${theme.dot}`}
                                  />
                                  <UploadHistoryCard audits={[row.audit]} theme={theme} />
                                </li>
                              );
                            }
                            return (
                              <li
                                key={
                                  row.kind === 'audit'
                                    ? `a-${section.key}-${row.audit.id}`
                                    : `c-${section.key}-${row.comment.id}-${idx}`
                                }
                                className="relative"
                              >
                                <span
                                  className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white ring-1 ring-white/80 ${theme.dot}`}
                                />
                                {row.kind === 'audit' ? (
                                  <div
                                    className={`rounded-lg border px-3 py-2 shadow-sm ${theme.card} ${
                                      row.audit.action === 'RETURNED'
                                        ? 'border-amber-300 bg-amber-50/80 ring-1 ring-amber-200/60'
                                        : auditIsResubmitEvent(row.audit)
                                          ? 'border-sky-300 bg-sky-50/80 ring-1 ring-sky-200/60'
                                          : ''
                                    }`}
                                  >
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                      {row.audit.action === 'RETURNED' ? (
                                        <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-950">
                                          Devuelto
                                        </span>
                                      ) : null}
                                      {auditIsResubmitEvent(row.audit) ? (
                                        <span className="rounded-full bg-sky-200 px-2 py-0.5 text-xs font-semibold text-sky-950">
                                          Reenviado
                                        </span>
                                      ) : null}
                                      <span className="text-sm font-semibold text-gray-900">
                                        {auditTitleForRow(row.audit)}
                                      </span>
                                      <span className={`text-xs ${theme.cardMuted}`}>{dateStr}</span>
                                    </div>
                                    {row.audit.userName ? (
                                      <p className={`mt-0.5 text-xs ${theme.cardMuted}`}>Por: {row.audit.userName}</p>
                                    ) : null}
                                    {row.audit.comments ? (
                                      <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{row.audit.comments}</p>
                                    ) : null}
                                  </div>
                                ) : (
                                  (() => {
                                    const histFull = caseHistoryPayload?.history ?? [];
                                    const esDevolucion = commentIsDevolucionAlExpediente(row.comment, histFull);
                                    return (
                                      <div
                                        className={`rounded-lg border px-3 py-2 shadow-sm ${theme.commentCard} ${
                                          esDevolucion
                                            ? 'border-amber-300 bg-amber-50/80 ring-1 ring-amber-200/60'
                                            : ''
                                        }`}
                                      >
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                          {esDevolucion ? (
                                            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-950">
                                              Devuelto
                                            </span>
                                          ) : null}
                                          <span className="text-sm font-semibold text-gray-900">
                                            {esDevolucion
                                              ? 'Devolución para corrección'
                                              : 'Comentario en el expediente'}
                                          </span>
                                          <span className={`text-xs ${theme.commentMuted}`}>{dateStr}</span>
                                        </div>
                                        <p className={`mt-0.5 text-xs ${theme.commentMuted}`}>
                                          {row.comment.userName}
                                          {row.comment.userArea ? (
                                            <span className="text-gray-600">
                                              {' '}
                                              · {areaLabels[row.comment.userArea as keyof typeof areaLabels] ?? row.comment.userArea}
                                            </span>
                                          ) : null}
                                        </p>
                                        <p className={`mt-2 whitespace-pre-wrap text-sm ${theme.commentMuted}`}>
                                          {row.comment.content}
                                        </p>
                                      </div>
                                    );
                                  })()
                                )}
                              </li>
                            );
                          })}
                        </ol>
                      </section>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {activeTab === 'files' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-xl font-bold text-gray-900">Archivos del trámite</h3>
              <div className="text-sm text-gray-500">({caseData.fileCount})</div>
            </div>
            <CaseDocumentsInfo caseData={caseData} />
            <CaseFilesPanel
              caseId={caseId}
              canUpload={canUploadFiles}
              caseStatus={caseData.status}
              canReplaceReturnedFiles={
                !!user &&
                user.id === caseData.createdBy &&
                caseData.status === 'RETURNED'
              }
              canDeleteNonInitialFiles={canDeleteNonInitialFiles}
              canDeleteSignedAsDirector={
                !!user &&
                user.role === 'AREA_USER' &&
                (!!user.isFinalStepArea || !!user.puedeCompletarTramite)
              }
              canDeleteSignedAsLegal={
                !!user &&
                user.role === 'AREA_USER' &&
                !!user.isSigningArea &&
                !!user.canSign
              }
              canCommentFile={canCommentFile}
              canMarkForSigning={
                !!user &&
                caseData.status === 'IN_REVIEW' &&
                canApprove &&
                (user.role === 'ADMIN' ||
                  (user.role === 'AREA_USER' &&
                    !!user.canSign &&
                    (!!user.isSigningArea ||
                      !!user.isFinalStepArea ||
                      !!user.puedeCompletarTramite)))
              }
              canUploadSignedAsLegal={
                !!user &&
                (user.role === 'ADMIN' ||
                  (user.role === 'AREA_USER' && !!user.isSigningArea && !!user.canSign)) &&
                (caseData.status === 'IN_REVIEW' || caseData.status === 'APPROVED')
              }
              canUploadSignedAsDirector={
                !!user &&
                (user.role === 'ADMIN' ||
                  (user.role === 'AREA_USER' &&
                    !!user.canSign &&
                    (!!user.isFinalStepArea || !!user.puedeCompletarTramite))) &&
                (caseData.status === 'IN_REVIEW' || caseData.status === 'APPROVED')
              }
              canViewSignedFiles={
                !!user &&
                (user.role === 'ADMIN' ||
                  user.role !== 'AREA_USER' ||
                  (!!user.isSigningArea && !!user.canSign) ||
                  ((!!user.isFinalStepArea || !!user.puedeCompletarTramite) && !!user.canSign))
              }
              canDownloadFiles={canDownloadFiles}
              canDownloadSignedFiles={canDownloadSignedFiles}
              useAnnotationLock={
                !!user && user.role === 'AREA_USER' && user.areaId != null && canCommentFile
              }
            />
          </div>
        ) : null}

      </div>
    </div>
  );
}
