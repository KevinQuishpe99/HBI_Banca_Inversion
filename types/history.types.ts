export type ActionType = 
  | 'CREATED'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'RETURNED'
  | 'UPDATED'
  | 'FILE_UPLOADED'
  | 'FILE_DELETED'
  | 'COMMENT_ADDED'
  | 'STATUS_CHANGED'
  | 'ASSIGNED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'RESUBMITTED';

export interface AuditLog {
  id: string;
  tramiteId?: string;
  usuarioId?: string;
  action: ActionType;
  entityType?: string;
  entityId?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  comments?: string;
  createdAt: Date;
}

export interface AuditLogWithUser extends AuditLog {
  userName?: string;
  userEmail?: string;
  userArea?: string | null;
}

export interface Comment {
  id: string;
  tramiteId: string;
  usuarioId: string;
  content: string;
  isInternal: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommentWithUser extends Comment {
  userName: string;
  userRole: string;
  userArea?: string | null;
}
