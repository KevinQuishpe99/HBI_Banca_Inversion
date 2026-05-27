import { createCaseFormSchema, type CreateCaseInput } from '@/lib/validations/case.schema';
import { validateCaseCreationDocumentFiles } from '@/lib/validations/case-document-files';
import { ValidationError } from '@/lib/utils/errors';

export type CreateCaseFormFieldKey =
  | 'title'
  | 'advisorName'
  | 'documentFiles'
  | 'odooCode'
  | 'clientProvider'
  | 'documentType'
  | 'amountApplies'
  | 'amountValue'
  | 'requestDate'
  | 'requiredDeliveryDate'
  | 'urgencyJustification'
  | 'signatureType'
  | 'templateType'
  | 'observations'
  | 'form';

/** Etiquetas visibles del formulario (para mensajes al usuario). */
export const CREATE_CASE_FIELD_LABELS: Record<CreateCaseFormFieldKey, string> = {
  title: 'Título del trámite (Resumen)',
  advisorName: '1. Asesor comercial o responsable',
  documentFiles: '2. Agregar documentos',
  odooCode: '3. Código Odoo',
  clientProvider: '4. Cliente / Proveedor',
  documentType: '5. Tipo de documento',
  amountApplies: '6. ¿Aplica monto?',
  amountValue: 'Monto (USD)',
  requestDate: '7. Fecha de la solicitud',
  requiredDeliveryDate: '8. Fecha de entrega requerida',
  urgencyJustification: '9. Urgencia - Justificación',
  signatureType: '10. Tipo de firma',
  templateType: '11. Tipo de plantilla',
  observations: '12. Observaciones',
  form: 'Formulario',
};

export type CreateCaseFormFieldIssue = {
  field: CreateCaseFormFieldKey;
  label: string;
  message: string;
};

export function zodPathToFormField(path: string): CreateCaseFormFieldKey {
  return ZOD_PATH_TO_FIELD[path] ?? 'form';
}

const ZOD_PATH_TO_FIELD: Record<string, CreateCaseFormFieldKey> = {
  title: 'title',
  advisorName: 'advisorName',
  documentFileName: 'documentFiles',
  odooCode: 'odooCode',
  clientProvider: 'clientProvider',
  documentType: 'documentType',
  amountApplies: 'amountApplies',
  amountValue: 'amountValue',
  requestDate: 'requestDate',
  requiredDeliveryDate: 'requiredDeliveryDate',
  urgencyJustification: 'urgencyJustification',
  signatureType: 'signatureType',
  templateType: 'templateType',
  observations: 'observations',
};

/** `id` del control HTML para hacer scroll y foco. */
export const CREATE_CASE_FIELD_DOM_ID: Partial<Record<CreateCaseFormFieldKey, string>> = {
  title: 'title',
  advisorName: 'advisorName',
  documentFiles: 'documentFiles',
  odooCode: 'odooCode',
  clientProvider: 'clientProvider',
  documentType: 'documentType',
  amountApplies: 'amountApplies-section',
  amountValue: 'amountValue',
  requestDate: 'requestDate',
  requiredDeliveryDate: 'requiredDeliveryDate',
  urgencyJustification: 'urgencyJustification',
  signatureType: 'signatureType',
  templateType: 'templateType',
  observations: 'observations',
};

function pushIssue(
  issues: CreateCaseFormFieldIssue[],
  seen: Set<CreateCaseFormFieldKey>,
  field: CreateCaseFormFieldKey,
  message: string
): void {
  if (seen.has(field)) return;
  seen.add(field);
  issues.push({
    field,
    label: CREATE_CASE_FIELD_LABELS[field],
    message,
  });
}

export type ValidateCreateCaseFormParams = {
  payload: CreateCaseInput;
  documentFiles: File[];
  amountAppliesChoice: '' | 'yes' | 'no';
  catalogsLoading: boolean;
  catalogsError: string | null;
};

/**
 * Valida todo el formulario antes de confirmar envío a revisión.
 * Devuelve lista de fallos con mensaje personalizado por campo.
 */
export function validateCreateCaseFormBeforeSubmit(
  params: ValidateCreateCaseFormParams
): CreateCaseFormFieldIssue[] {
  const issues: CreateCaseFormFieldIssue[] = [];
  const seen = new Set<CreateCaseFormFieldKey>();

  if (params.catalogsLoading) {
    pushIssue(
      issues,
      seen,
      'form',
      'Los catálogos del formulario aún se están cargando. Espere un momento e intente de nuevo.'
    );
  }

  if (params.catalogsError) {
    pushIssue(
      issues,
      seen,
      'form',
      `No se pudieron cargar las opciones del formulario: ${params.catalogsError}. Recargue la página.`
    );
  }

  if (!params.documentFiles.length) {
    pushIssue(
      issues,
      seen,
      'documentFiles',
      'Debe adjuntar al menos un documento (PDF, DOC o DOCX).'
    );
  } else {
    try {
      validateCaseCreationDocumentFiles(params.documentFiles);
    } catch (err) {
      const msg =
        err instanceof ValidationError
          ? err.message
          : 'Revise el tamaño, formato y nombres de los archivos adjuntos.';
      pushIssue(issues, seen, 'documentFiles', msg);
    }
  }

  if (params.amountAppliesChoice === '') {
    pushIssue(
      issues,
      seen,
      'amountApplies',
      'Indique si aplica monto: seleccione «Sí» o «No».'
    );
  }

  const parsed = createCaseFormSchema.safeParse(params.payload);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const rawPath = issue.path[0]?.toString() ?? 'form';
      const field = zodPathToFormField(rawPath);
      pushIssue(issues, seen, field, issue.message);
    }
  }

  return issues;
}

export function issuesToFieldErrors(
  issues: CreateCaseFormFieldIssue[]
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    if (i.field !== 'form' && !out[i.field]) {
      out[i.field] = i.message;
    }
  }
  return out;
}

export function issuesToSubmitErrorLines(issues: CreateCaseFormFieldIssue[]): string[] {
  return issues.map((i) => `${i.label}: ${i.message}`);
}

export function focusFirstCreateCaseFieldIssue(issues: CreateCaseFormFieldIssue[]): void {
  const first = issues.find((i) => i.field !== 'form') ?? issues[0];
  if (!first) return;
  const domId = CREATE_CASE_FIELD_DOM_ID[first.field];
  if (!domId) return;
  const el = document.getElementById(domId);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if ('focus' in el && typeof (el as HTMLElement).focus === 'function') {
    (el as HTMLElement).focus();
  }
}
