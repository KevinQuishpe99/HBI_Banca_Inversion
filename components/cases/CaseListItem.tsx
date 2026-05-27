'use client';

import Link from 'next/link';
import { CaseStatus, CaseWithCreator } from '@/types/case.types';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { CaseReviewedByLine } from '@/components/cases/CaseReviewedByLine';
import { formatCaseNumber } from '@/lib/utils/format';
import { format } from 'date-fns';
import { Calendar, FileText, MessageSquare } from 'lucide-react';

type Props = {
  case: CaseWithCreator;
  /** Enlace opcional (p. ej. query seguimiento desde /tracking) */
  href?: string;
  className?: string;
};

/** Tres grupos visuales: Pendiente (enviado / en revisión / aprobado en flujo), Devuelto, Completado */
function caseListAccentByStatus(status: CaseStatus): string {
  switch (status) {
    case 'COMPLETED':
      return 'border-l-4 border-l-emerald-500 bg-emerald-50/40 hover:bg-emerald-50/70';
    case 'RETURNED':
      return 'border-l-4 border-l-amber-500 bg-amber-50/40 hover:bg-amber-50/75';
    case 'SUBMITTED':
    case 'IN_REVIEW':
    case 'APPROVED':
      return 'border-l-4 border-l-yellow-500 bg-yellow-50/60 hover:bg-yellow-50/90';
    default:
      return 'border-l-4 border-l-gray-300 bg-white hover:bg-gray-50';
  }
}

export function CaseListItem({ case: c, href, className }: Props) {
  const to = href ?? `/cases/${c.id}`;
  const linkClass = [
    'block rounded-lg border border-gray-200 px-4 py-3 transition-colors',
    caseListAccentByStatus(c.status),
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Link href={to} className={linkClass}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h3 className="truncate text-sm font-semibold text-gray-900">{c.title}</h3>
            <span className="hidden sm:inline text-xs text-gray-500">{formatCaseNumber(c.caseNumber)}</span>
          </div>
          {c.description ? (
            <p className="mt-1 line-clamp-1 text-xs text-gray-600">{c.description}</p>
          ) : null}
          <CaseReviewedByLine reviewedByAreaLabels={c.reviewedByAreaLabels} status={c.status} />
        </div>
        <StatusBadge status={c.status} size="sm" />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
        <span className="sm:hidden">{formatCaseNumber(c.caseNumber)}</span>
        <span className="truncate">
          <span className="font-medium">Creado por:</span> {c.creatorName}
        </span>
        <span className="flex items-center gap-1 whitespace-nowrap">
          <Calendar className="h-3 w-3" />
          {format(new Date(c.createdAt), "d 'de' MMM, yyyy")}
        </span>
        <span className="flex items-center gap-1 whitespace-nowrap">
          <FileText className="h-3 w-3" />
          {c.fileCount}
        </span>
        <span className="flex items-center gap-1 whitespace-nowrap">
          <MessageSquare className="h-3 w-3" />
          {c.commentCount}
        </span>
      </div>
    </Link>
  );
}

