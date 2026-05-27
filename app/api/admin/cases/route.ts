import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/get-session';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { CaseService } from '@/services/case.service';
import type { CaseStatus } from '@/types/case.types';

const caseStatuses: [CaseStatus, ...CaseStatus[]] = [
  'SUBMITTED',
  'IN_REVIEW',
  'APPROVED',
  'RETURNED',
  'COMPLETED',
];

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().max(200).optional().default(''),
  status: z.enum(caseStatuses).optional(),
});

/**
 * GET /api/admin/cases — listado paginado de trámites (solo ADMIN).
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole('ADMIN');
    const { searchParams } = new URL(request.url);
    const raw = Object.fromEntries(searchParams.entries());
    const parsed = querySchema.parse({
      page: raw.page,
      limit: raw.limit,
      q: raw.q,
      status: raw.status,
    });

    const data = await CaseService.listCasesForAdmin({
      page: parsed.page,
      limit: parsed.limit,
      q: parsed.q.trim() || undefined,
      status: parsed.status,
    });

    return successResponse(data);
  } catch (error) {
    return errorResponse(error);
  }
}
