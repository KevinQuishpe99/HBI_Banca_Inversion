import type { WorkflowProgressView } from '@/types/flow.types';
import { CircuitRealtimePanel, type ReviewPresenceUser } from '@/components/flow/CircuitRealtimePanel';
import { CircuitStepsList } from '@/components/flow/CircuitStepsList';

export type { ReviewPresenceUser };

interface FlowStepperProps {
  steps: WorkflowProgressView[];
  presenceAreas?: readonly string[];
  presenceUsers?: readonly ReviewPresenceUser[];
  removableAreaCodes?: readonly string[];
  onRemoveArea?: (area: string) => void;
}

/**
 * Vista compuesta del circuito (tiempo real + lista numerada). Preferir los subcomponentes directamente en pantallas nuevas.
 */
export function FlowStepper({
  steps,
  removableAreaCodes = [],
  onRemoveArea,
  presenceAreas = [],
  presenceUsers = [],
}: FlowStepperProps) {
  return (
    <div className="py-6">
      <CircuitRealtimePanel steps={steps} presenceUsers={presenceUsers} />
      <CircuitStepsList
        steps={steps}
        presenceAreas={presenceAreas}
        presenceUsers={presenceUsers}
        removableAreaCodes={removableAreaCodes}
        onRemoveArea={onRemoveArea}
      />
    </div>
  );
}
