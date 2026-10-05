import { EFFORT_SCALE_IDS, EFFORT_SCALES, type EffortScale } from '../program/effort'
import { updateProgram } from '../storage/program'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

/**
 * The program's effort scale (SPEC §9.1, slice 1). Switching is safe at any time, even mid-session:
 * effort is stored as RPE whatever the scale, so only the labels change.
 */
export function EffortScaleCard({ value }: { value: EffortScale }) {
  return (
    <Card>
      <h2>Effort scale</h2>
      <p className="muted">
        How you rate each set. It estimates your 1-rep maxes, which set your suggested weights.
      </p>
      <div className="segmented three" role="group" aria-label="Effort scale">
        {EFFORT_SCALE_IDS.map((scale) => (
          <Button
            key={scale}
            aria-pressed={value === scale}
            onClick={() => void updateProgram((p) => ({ ...p, effortScale: scale }))}
          >
            {EFFORT_SCALES[scale].name}
          </Button>
        ))}
      </div>
      <p className="muted">{EFFORT_SCALES[value].description}</p>
    </Card>
  )
}
