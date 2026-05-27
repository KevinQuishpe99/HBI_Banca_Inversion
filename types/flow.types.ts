export type WorkflowStepStatus = 
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'APPROVED'
  | 'REJECTED'
  | 'SKIPPED';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowStep {
  id: string;
  workflowTemplateId: string;
  stepOrder: number;
  stepName: string;
  requiredArea: string;
  isRequired: boolean;
  canSkip: boolean;
  createdAt: Date;
}

export interface CaseWorkflow {
  id: string;
  caseId: string;
  workflowTemplateId: string;
  currentStepOrder: number;
  startedAt: Date;
  completedAt?: Date;
}

export interface WorkflowStepProgress {
  id: string;
  caseWorkflowId: string;
  workflowStepId: string;
  status: WorkflowStepStatus;
  assignedTo?: string;
  reviewedBy?: string;
  comments?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

export interface WorkflowProgressView {
  caseId: string;
  workflowTemplateId: string;
  workflowName: string;
  stepOrder: number;
  stepName: string;
  requiredArea: string;
  stepStatus: WorkflowStepStatus;
  assignedTo?: string;
  reviewedBy?: string;
  assignedToName?: string;
  reviewedByName?: string;
  comments?: string;
  completedAt?: Date;
}

export interface ApproveStepDTO {
  caseId: string;
  comments?: string;
}

export interface RejectStepDTO {
  caseId: string;
  comments: string;
}

export interface ReturnCaseDTO {
  caseId: string;
  comments: string;
  returnReason: string;
}
