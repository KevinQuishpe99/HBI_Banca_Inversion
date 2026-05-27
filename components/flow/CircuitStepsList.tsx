'use client';

import type { ReactNode } from 'react';
import { CheckCircle, Circle, XCircle, Clock, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { WorkflowProgressView } from '@/types/flow.types';
import { useAreaMeta } from '@/hooks/useAreaLabelByCode';

export type ReviewPresenceUser = {
  area: string;
  displayName: string;
};

/**
 * Nombre visible del paso: meta por id; si no, `stepName` del servidor (nombre de área, a veces con sufijo "— …").
 * Evita mostrar solo el id numérico en pantalla.
 */
export function displayStepLabel(step: WorkflowProgressView, areaLabelByCode: Record<string, string>): string {
  const code = String(step.requiredArea);
  const fromMeta = areaLabelByCode[code];
  if (fromMeta && fromMeta.trim()) return fromMeta;

  const raw = (step.stepName || '').trim();
  if (raw) {
    const head = raw.split(/\s*[—–-]\s*/)[0].trim();
    if (head && !/^\d+$/.test(head)) return head;
    if (!/^\d+$/.test(raw)) return raw;
  }

  return code;
}

function indexBadgeClass(variant: 'default' | 'fixedClosing' | 'supervisionFixed'): string {
  void variant;
  return 'border-amber-500 bg-amber-100 text-amber-950 shadow-sm ring-1 ring-amber-300/70';
}

function normalizeStatus(status: string | undefined): string {
  return (status && String(status).trim().toUpperCase()) || 'PENDING';
}

function getStepIcon(status: string, isLiveReview: boolean) {
  const cls = 'h-4 w-4 shrink-0';
  if (isLiveReview) {
    return <Clock className={`${cls} animate-pulse text-blue-500`} />;
  }
  switch (status) {
    case 'APPROVED':
      return <CheckCircle className={`${cls} text-green-500`} />;
    case 'REJECTED':
      return <XCircle className={`${cls} text-orange-500`} />;
    case 'IN_PROGRESS':
      return <Clock className={`${cls} animate-pulse text-blue-500`} />;
    case 'SKIPPED':
      return <Circle className={`${cls} text-gray-300`} />;
    case 'PENDING':
    default:
      return <Circle className={`${cls} text-gray-300`} />;
  }
}

function getStepColor(status: string, isLiveReview: boolean) {
  if (isLiveReview) {
    return 'border-blue-500 bg-blue-50';
  }
  switch (status) {
    case 'APPROVED':
      return 'border-green-500 bg-green-50';
    case 'REJECTED':
      return 'border-orange-500 bg-orange-50';
    case 'IN_PROGRESS':
      return 'border-blue-500 bg-blue-50';
    case 'SKIPPED':
      return 'border-gray-200 bg-gray-50 opacity-70';
    case 'PENDING':
    default:
      return 'border-gray-300 bg-gray-50';
  }
}

export type CircuitStepRowProps = {
  step: WorkflowProgressView;
  indexNumber: number;
  areaLabelByCode: Record<string, string>;
  presenceAreas: readonly string[];
  presenceUsers: readonly ReviewPresenceUser[];
  removableAreaCodes?: readonly string[];
  onRemoveArea?: (area: string) => void;
  /** Acciones extra a la derecha del título (p. ej. Quitar en asignación de supervisión). */
  trailingSlot?: ReactNode;
  /** Texto corto junto al nombre del área (p. ej. supervisor). */
  titleSuffix?: string | null;
  /** Número del paso: estilo distinto para pasos fijos (supervisión o cierre Legal/DG). */
  indexBadgeVariant?: 'default' | 'fixedClosing' | 'supervisionFixed';
};

export function CircuitStepRow({
  step,
  indexNumber,
  areaLabelByCode,
  presenceAreas,
  presenceUsers,
  removableAreaCodes = [],
  onRemoveArea,
  trailingSlot,
  titleSuffix = null,
  indexBadgeVariant = 'default',
}: CircuitStepRowProps) {
  const status = normalizeStatus(step.stepStatus as string);
  const areaCode = String(step.requiredArea);
  const areaName = displayStepLabel(step, areaLabelByCode);
  const areaPresence = presenceAreas.includes(areaCode);
  const onlineHere = presenceUsers.filter((p) => p.area === areaCode).map((p) => p.displayName);
  const hasRealtimePresence = presenceAreas.length > 0 || presenceUsers.length > 0;
  /**
   * Si hay presencia en tiempo real, priorizamos esa señal para no pintar dos áreas "activas".
   * Fallback: cuando no hay presencia, usamos IN_PROGRESS del workflow.
   */
  const isLiveReview = hasRealtimePresence ? areaPresence : status === 'IN_PROGRESS';
  /** Cuando hay presencia, una fila IN_PROGRESS sin presencia se visualiza como pendiente para evitar doble resaltado. */
  const visualStatus = hasRealtimePresence && !areaPresence && status === 'IN_PROGRESS' ? 'PENDING' : status;

  const metaLine = (() => {
    if (status === 'APPROVED' || status === 'REJECTED') {
      const bits: string[] = [status === 'APPROVED' ? 'Aprobado' : 'Devuelto'];
      if (step.completedAt) {
        bits.push(format(new Date(step.completedAt), "d MMM yyyy, HH:mm", { locale: es }));
      }
      if (step.reviewedByName) bits.push(step.reviewedByName);
      return bits.join(' · ');
    }
    if (status === 'IN_PROGRESS' && !hasRealtimePresence) return 'Turno actual — esta área revisa ahora.';
    if (status === 'SKIPPED') return 'No aplica en este trámite.';
    if (areaPresence) {
      return onlineHere.length > 0
        ? `Conectados: ${onlineHere.join(', ')}`
        : 'Actividad en esta área';
    }
    if (status === 'PENDING') return 'Pendiente de revisión';
    if (step.reviewedByName) return `Registrado: ${step.reviewedByName}`;
    return '';
  })();

  return (
    <li className="flex min-w-0 gap-2">
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold leading-none ${indexBadgeClass(indexBadgeVariant)}`}
        title={
          indexBadgeVariant === 'fixedClosing'
            ? 'Paso fijo de cierre del circuito'
            : indexBadgeVariant === 'supervisionFixed'
              ? 'Área de supervisión (fija en el circuito)'
              : undefined
        }
        aria-hidden
      >
        {indexNumber}
      </span>
      <div
        className={`min-w-0 flex-1 rounded-md border-l-2 py-1.5 pl-2.5 pr-2 ${getStepColor(visualStatus, isLiveReview)}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {getStepIcon(visualStatus, isLiveReview)}
            <div className="min-w-0 truncate text-sm text-gray-900">
              <span className="font-medium">{areaName}</span>
              {titleSuffix ? <span className="text-gray-600"> · {titleSuffix}</span> : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {onRemoveArea && removableAreaCodes.includes(areaCode) ? (
              <button
                type="button"
                onClick={() => onRemoveArea(areaCode)}
                className="rounded p-1 text-gray-500 hover:bg-white/80 hover:text-red-600"
                title="Quitar área del borrador (pulse Guardar en la barra de áreas para aplicar)"
                aria-label="Quitar área del borrador"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
            {trailingSlot}
          </div>
        </div>
        {metaLine ? <p className="mt-0.5 pl-5 text-[11px] leading-snug text-gray-600">{metaLine}</p> : null}
      </div>
    </li>
  );
}

type ListProps = {
  steps: WorkflowProgressView[];
  presenceAreas?: readonly string[];
  presenceUsers?: readonly ReviewPresenceUser[];
  removableAreaCodes?: readonly string[];
  onRemoveArea?: (area: string) => void;
};

/**
 * Lista numerada vertical del circuito (sustituye los recuadros horizontales del stepper).
 */
export function CircuitStepsList({
  steps,
  presenceAreas = [],
  presenceUsers = [],
  removableAreaCodes = [],
  onRemoveArea,
}: ListProps) {
  const { areaLabelByCode } = useAreaMeta();

  if (steps.length === 0) return null;

  return (
    <nav aria-label="Revisión del trámite por áreas" className="py-2">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">Orden de revisión</p>
      <ol className="space-y-2">
        {steps.map((step, idx) => {
          return (
            <CircuitStepRow
              key={`${step.stepOrder}-${step.requiredArea}-${idx}`}
              step={step}
              indexNumber={idx + 1}
              areaLabelByCode={areaLabelByCode}
              presenceAreas={presenceAreas}
              presenceUsers={presenceUsers}
              removableAreaCodes={removableAreaCodes}
              onRemoveArea={onRemoveArea}
              titleSuffix={null}
              indexBadgeVariant={
                idx === 0 || idx >= Math.max(steps.length - 2, 0) ? 'fixedClosing' : 'default'
              }
            />
          );
        })}
      </ol>
    </nav>
  );
}
