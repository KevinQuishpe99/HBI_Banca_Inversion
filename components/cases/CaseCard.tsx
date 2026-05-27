import Link from 'next/link';
import { CaseWithCreator } from '@/types/case.types';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { CaseReviewedByLine } from '@/components/cases/CaseReviewedByLine';
import { format } from 'date-fns';
import { FileText, MessageSquare, Calendar } from 'lucide-react';
import { formatCaseNumber } from '@/lib/utils/format';

interface CaseCardProps {
  case: CaseWithCreator;
}

export function CaseCard({ case: caseData }: CaseCardProps) {
  return (
    <Link href={`/cases/${caseData.id}`} className="block h-full min-h-0">
      <div className="flex h-full flex-col rounded-lg border border-gray-200 bg-white p-4 shadow transition-shadow hover:shadow-lg sm:p-6">
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-h-[2.75rem] flex-1 text-base font-semibold leading-snug text-gray-900 line-clamp-2 sm:min-h-[3.25rem] sm:text-lg">
              {caseData.title}
            </h3>
            <StatusBadge status={caseData.status} size="sm" />
          </div>
          <p className="text-xs text-gray-600 sm:text-sm">{formatCaseNumber(caseData.caseNumber)}</p>
          {caseData.description ? (
            <p className="text-xs text-gray-700 line-clamp-2 sm:text-sm">{caseData.description}</p>
          ) : null}
          <CaseReviewedByLine reviewedByAreaLabels={caseData.reviewedByAreaLabels} status={caseData.status} />
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-3 text-xs text-gray-500 sm:gap-4 sm:text-sm">
          <div className="flex items-center gap-1">
            <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>{caseData.fileCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>{caseData.commentCount}</span>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 border-t border-gray-100 pt-4 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 truncate">
            <span className="font-medium">Creado por:</span> {caseData.creatorName}
          </div>
          <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
            <Calendar className="h-3 w-3" />
            {format(new Date(caseData.createdAt), "d 'de' MMM, yyyy")}
          </div>
        </div>
      </div>
    </Link>
  );
}
