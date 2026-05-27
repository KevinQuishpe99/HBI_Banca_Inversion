export type CaseStatus =
  | 'SUBMITTED'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'RETURNED'
  | 'COMPLETED';

export type DocumentType = string;
export type SignatureType = string;
export type TemplateType = string;

export interface CaseReturnHistoryEntry {
  areaId: number;
  reason: string;
  allowFileUpdate: boolean;
  at: string;
}

export interface Case {
  id: string;
  caseNumber: string;
  title: string;
  description?: string;
  status: CaseStatus;
  createdBy: string;
  currentAreaId?: number;
  dueDate?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  advisorName?: string;
  documentFileName?: string;
  odooCode?: string;
  clientProvider?: string;
  documentType?: DocumentType;
  sharepointUrl?: string;
  requestDate?: Date;
  requiredDeliveryDate?: Date;
  urgencyJustification?: string;
  signatureType?: SignatureType;
  templateType?: TemplateType;
  observations?: string;
  returnAllowFileUpdate?: boolean;
  lastReturnReason?: string;
  lastReturnAreaId?: number | null;
  returnHistory?: CaseReturnHistoryEntry[];
  creatorAreaId?: number | null;
  routingFlow?: 'SUPERVISION_CHAIN' | 'DIRECT_LEGAL' | null;
  supervisionAreaId?: number | null;
  /** Nombre del supervisor titular del área de supervisión (`configuracion_areas.supervisor_id`). */
  supervisionSupervisorName?: string | null;
  supervisionCompleted?: boolean;
  amountApplies?: boolean;
  amountValue?: number | null;
}

export interface CaseWithCreator extends Case {
  creatorName: string;
  creatorEmail: string;
  fileCount: number;
  commentCount: number;
  /** IDs de áreas en tramite_areas_revision (enriquecido en CaseService) */
  reviewAreaIds?: number[];
  /** IDs de áreas en tramite_areas_aprobadas (enriquecido en CaseService) */
  approvedReviewAreaIds?: number[];
  /** Áreas que ya aprobaron (tramite_areas_aprobadas), en orden de configuración */
  reviewedByAreaLabels?: string[];
  /**
   * Áreas que participan en la revisión (tar + obligatorias). Vacío si aún falta asignación por supervisión.
   * Usado para permisos de comentarios (p. ej. Comercial sin ser solo el supervisor).
   */
  commentEligibleAreaIds?: number[];
}

/** Respuesta de GET /api/admin/cases (listado paginado para administración). */
export type AdminCasesListResponse = {
  items: CaseWithCreator[];
  total: number;
  page: number;
  limit: number;
};

export interface CreateCaseDTO {
  title: string;
  description?: string;
  dueDate?: Date;
  /** IDs de áreas seleccionadas para revisión (se insertan en tramite_areas_revision) */
  reviewAreaIds?: number[];
  advisorName?: string;
  documentFileName?: string;
  odooCode?: string;
  clientProvider?: string;
  documentType?: DocumentType;
  sharepointUrl?: string;
  requestDate?: Date;
  requiredDeliveryDate?: Date;
  urgencyJustification?: string;
  signatureType?: SignatureType;
  templateType?: TemplateType;
  observations?: string;
  amountApplies?: boolean;
  amountValue?: number | null;
}

export interface UpdateCaseDTO {
  title?: string;
  description?: string;
  status?: CaseStatus;
  dueDate?: Date;
  advisorName?: string;
  documentFileName?: string;
  odooCode?: string;
  clientProvider?: string;
  documentType?: DocumentType;
  sharepointUrl?: string;
  requestDate?: Date;
  requiredDeliveryDate?: Date;
  urgencyJustification?: string;
  signatureType?: SignatureType;
  templateType?: TemplateType;
  observations?: string;
}
