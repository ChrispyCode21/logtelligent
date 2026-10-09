import { EFFORT_SCALE_IDS, EFFORT_SCALES, type EffortScale } from '../program/effort'
import { updateProgram } from '../storage/program'
import { Card } from '../ui/Card'
import { SegmentedControl } from '../ui/SegmentedControl'

/**
 * The program's effort scale (SPEC §5.6). Switching is safe at any time, even mid-session:
 * effort is stored as RPE whatever the scale, so only the labels change.
 */
export function EffortScaleCard({ value }: { value: EffortScale }) {
  return (
    <Card>
      <h2>Effort scale</h2>
      <p className="muted">
        How you rate a primary lift's first set. It estimates your 1-rep maxes, which set your suggested
        weights.
      </p>
      <SegmentedControl
        className="segmented three"
        role="group"
        aria-label="Effort scale"
        options={EFFORT_SCALE_IDS.map((scale) => ({ value: scale, label: EFFORT_SCALES[scale].name }))}
        value={value}
        onChange={(scale) => void updateProgram((p) => ({ ...p, effortScale: scale }))}
      />
      <div className="scale-descriptions">
        {EFFORT_SCALE_IDS.map((scale) => (
          <p key={scale} className="muted" aria-hidden={scale !== value}>
            {EFFORT_SCALES[scale].description}
          </p>
        ))}
      </div>
    </Card>
  )
}
