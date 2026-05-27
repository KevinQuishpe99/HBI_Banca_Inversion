import { NextRequest } from 'next/server';
import { CaseService } from '@/services/case.service';
import { createCaseFormSchema } from '@/lib/validations/case.schema';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { requireAuth } from '@/lib/auth/get-session';
import { ValidationError } from '@/lib/utils/errors';
import { query } from '@/lib/db';
import type { CreateCaseDTO } from '@/types/case.types';
import { NotificationService } from '@/services/notification.service';
import { getAmountAlertThreshold } from '@/services/app-settings.service';
import { evaluateDeadlineAlertsForCase } from '@/services/deadline-alerts.service';
import { ForbiddenError } from '@/lib/utils/errors';
import { hasSupervisorPuedeCrearTramiteColumn } from '@/lib/db/configuracion-areas-columns';
import {
  validateCaseCreationDocumentFiles,
  joinDocumentFileNamesForTramite,
} from '@/lib/validations/case-document-files';
import { truncateFileName } from '@/lib/validations/file.schema';
import { mapUnknownErrorToAppError } from '@/lib/utils/map-operational-error';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * GET /api/cases
 * Obtiene todos los trámites (filtrados según el rol del usuario)
 * Query params:
 * - assignedOnly=true: Solo trámites asignados al área del usuario (para dashboard)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const assignedOnly = searchParams.get('assignedOnly') === 'true';
    
    const cases = await CaseService.getAllCases(
      session.user.id,
      session.user.role,
      session.user.areaId,
      assignedOnly
    );
    
    return successResponse(cases);
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * POST /api/cases
 * Crea un nuevo trámite con múltiples archivos adjuntos
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    if (session.user.role === 'AREA_USER' && session.user.areaId != null) {
      const hasCol = await hasSupervisorPuedeCrearTramiteColumn();
      const perm = await query<{
        supervisor_id: string | null;
        supervisor_puede_crear_tramite: boolean;
      }>(
        `SELECT supervisor_id,
                ${
                  hasCol
                    ? 'supervisor_puede_crear_tramite'
                    : 'TRUE AS supervisor_puede_crear_tramite'
                }
         FROM configuracion_areas WHERE id = $1 LIMIT 1`,
        [session.user.areaId]
      );
      const row = perm.rows[0];
      if (
        row?.supervisor_id != null &&
        row.supervisor_id === session.user.id &&
        row.supervisor_puede_crear_tramite !== true
      ) {
        throw new ForbiddenError(
          'Su área no permite que el supervisor cree nuevos trámites. Consulte con un administrador.'
        );
      }
    }

    const formData = await request.formData();
    
    const title = formData.get('title') as string;
    const description = formData.get('description') as string | null;
    const advisorName = formData.get('advisorName') as string | null;
    const documentFileName = formData.get('documentFileName') as string | null;
    const documentFiles = formData.getAll('documentFiles') as File[];
    const odooCode = formData.get('odooCode') as string | null;
    const clientProvider = formData.get('clientProvider') as string | null;
    const documentType = formData.get('documentType') as string;
    const sharepointUrl = formData.get('sharepointUrl') as string | null;
    const requestDate = formData.get('requestDate') as string | null;
    const requiredDeliveryDate = formData.get('requiredDeliveryDate') as string | null;
    const urgencyJustification = formData.get('urgencyJustification') as string | null;
    const signatureType = formData.get('signatureType') as string;
    const templateType = formData.get('templateType') as string;
    const observations = formData.get('observations') as string | null;
    const amountApplies = (formData.get('amountApplies') as string | null) === 'true';
    const amountValueRaw = formData.get('amountValue') as string | null;
    let amountValue: number | undefined;
    if (amountApplies && amountValueRaw != null && String(amountValueRaw).trim() !== '') {
      const n = parseFloat(String(amountValueRaw).replace(',', '.').replace(/\s/g, ''));
      if (!Number.isNaN(n)) amountValue = n;
    }

    if (!title || title.length < 3) {
      throw new ValidationError('El título es requerido y debe tener al menos 3 caracteres');
    }

    validateCaseCreationDocumentFiles(documentFiles);

    const joinedFileNames = joinDocumentFileNamesForTramite(
      documentFiles.map((f) => f.name)
    );

    const caseData = {
      title,
      description: description || undefined,
      reviewAreas: [],
      advisorName: advisorName || undefined,
      documentFileName: joinedFileNames || documentFileName || undefined,
      odooCode: odooCode || undefined,
      clientProvider: clientProvider || undefined,
      documentType: documentType || undefined,
      sharepointUrl: sharepointUrl || undefined,
      requestDate: requestDate || undefined,
      requiredDeliveryDate: requiredDeliveryDate || undefined,
      urgencyJustification: urgencyJustification || undefined,
      signatureType: signatureType || undefined,
      templateType: templateType || undefined,
      observations: observations || undefined,
      amountApplies,
      amountValue: amountApplies ? amountValue : undefined,
    };

    const validated = createCaseFormSchema.parse(caseData);

    if (validated.documentType) {
      const ok = await query(`SELECT 1 FROM configuracion_tipos_documento WHERE activo = true AND codigo = $1`, [
        validated.documentType,
      ]);
      if (ok.rows.length === 0) throw new ValidationError('Tipo de documento inválido');
    }
    if (validated.signatureType) {
      const ok = await query(`SELECT 1 FROM configuracion_tipos_firma WHERE activo = true AND codigo = $1`, [
        validated.signatureType,
      ]);
      if (ok.rows.length === 0) throw new ValidationError('Tipo de firma inválido');
    }
    if (validated.templateType) {
      const ok = await query(`SELECT 1 FROM configuracion_tipos_plantilla WHERE activo = true AND codigo = $1`, [
        validated.templateType,
      ]);
      if (ok.rows.length === 0) throw new ValidationError('Tipo de plantilla inválido');
    }

    const newCase = await CaseService.createCase(validated as CreateCaseDTO, session.user.id);

    const { FileService } = await import('@/services/file.service');

    async function runInBatches<T>(items: T[], batchSize: number, fn: (item: T, idx: number) => Promise<void>) {
      for (let i = 0; i < items.length; i += batchSize) {
        const slice = items.slice(i, i + batchSize);
        await Promise.all(slice.map((it, j) => fn(it, i + j)));
      }
    }

    const BATCH_SIZE = 2;
    await runInBatches(documentFiles, BATCH_SIZE, async (file, i) => {
      const safeName = truncateFileName(file.name);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        await FileService.uploadFile(
          {
            caseId: newCase.id,
            fileName: safeName,
            fileType: 'DOCUMENT',
            description:
              i === 0
                ? 'Documento principal de la solicitud'
                : `Documento adicional ${i} de la solicitud`,
            isCreationUpload: true,
          },
          session.user.id,
          buffer
        );
      } catch (uploadErr) {
        console.error(
          `[cases/POST] fallo subida archivo tramite=${newCase.id} archivo="${safeName}"`,
          uploadErr
        );
        const mapped = mapUnknownErrorToAppError(uploadErr);
        if (mapped) throw mapped;
        throw new ValidationError(
          `No se pudo guardar el archivo "${safeName}". Verifique tamaño y formato (PDF, DOC, DOCX). Si el trámite ${newCase.caseNumber} apareció en el listado sin todos los documentos, contacte al administrador.`
        );
      }
    });

    const rf = (newCase as { routingFlow?: string | null }).routingFlow;
    if (rf !== 'SUPERVISION_CHAIN') {
      try {
        await CaseService.submitCase(newCase.id);
      } catch (submitErr) {
        console.error(`[cases/POST] submitCase tramite=${newCase.id}`, submitErr);
        throw new ValidationError(
          `El trámite ${newCase.caseNumber} se creó pero no pudo enviarse a revisión. Contacte al administrador para activarlo.`
        );
      }
    }

    let updatedCase;
    try {
      updatedCase = await CaseService.getCaseById(newCase.id);
    } catch (readErr) {
      console.error(`[cases/POST] getCaseById tramite=${newCase.id}`, readErr);
      return successResponse(newCase, 201);
    }
    const finalCase = updatedCase ?? newCase;

    if (validated.amountApplies && validated.amountValue != null && validated.amountValue > 0) {
      const threshold = await getAmountAlertThreshold();
      if (validated.amountValue >= threshold) {
        const cr = await query<{ n: string }>(
          `SELECT trim(COALESCE(nombre,'') || ' ' || COALESCE(apellido,'')) AS n FROM usuarios WHERE id = $1`,
          [session.user.id]
        );
        const creatorName = cr.rows[0]?.n?.trim() || session.user.email || 'Usuario';
        await NotificationService.notifyHighAmountStakeholders(
          finalCase.id,
          finalCase.caseNumber,
          finalCase.title,
          validated.amountValue,
          threshold,
          creatorName
        );
      }
    }

    evaluateDeadlineAlertsForCase(finalCase.id).catch((e) =>
      console.error('[cases/POST] deadline-alerts', e)
    );

    return successResponse(finalCase, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
