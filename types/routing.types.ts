/** Flujo 1: supervisión asigna áreas → revisiones → Legal. Flujo 2: directo a Legal. */
export type RoutingFlowKind = 'SUPERVISION_CHAIN' | 'DIRECT_LEGAL';

export interface RoutingPolicyRow {
  creatorAreaId: number;
  flowKind: RoutingFlowKind;
  supervisionAreaId: number | null;
}

export interface RoutingPolicyResolved {
  flowKind: RoutingFlowKind;
  supervisionAreaId: number | null;
}
