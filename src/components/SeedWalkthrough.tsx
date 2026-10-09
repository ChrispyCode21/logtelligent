import { useState } from 'react'
import { findBankExercise } from '../program/bank'
import { latestInLift, needsStartingNumbers } from '../history/lifts'
import { activeDays, activeExercises, updateExercise } from '../program/program'
import {
  needsStack,
  seedPrefill,
  stackLoads,
  STACK_PRESETS,
  toSeed,
  validateSeedStep,
  type StackPick,
} from '../program/seeding'
import type { Program, ProgramExercise } from '../program/types'
import type { Session } from '../session/types'
import { updateProgram } from '../storage/program'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Field } from '../ui/Field'
import { SegmentedControl } from '../ui/SegmentedControl'
import { formatPrescription } from '../ui/format'
import { SeedFields } from './SeedFields'

interface Props {
  program: Program
  sessions: Session[]
  /** Leave the walkthrough: "Finish later", or after the last exercise. */
  onClose: () => void
}

/**
 * Step through the exercises still missing starting numbers, one per screen (SPEC §9.1, slice 3).
 * Each Next saves that exercise, so the current step is always the first one still missing; leaving
 * and coming back resumes there.
 */
export function SeedWalkthrough({ program, sessions, onClose }: Props) {
  // The last stack picked (with its typed list, for 'custom') is offered first on the next
  // cable/machine exercise.
  const [lastStack, setLastStack] = useState<StackPick>({ choice: '5', custom: '' })
  const days = activeDays(program)
  const all = activeExercises(program)
  const missing = needsStartingNumbers(program, sessions)
  const exercise = missing[0]
  if (!exercise) return null
  const day = days.find((d) => d.exercises.some((e) => e.id === exercise.id))!

  async function save(updated: ProgramExercise, stack?: StackPick) {
    if (stack) setLastStack(stack)
    await updateProgram((p) => updateExercise(p, updated))
    if (missing.length === 1) onClose()
  }

  return (
    <SeedStep
      key={exercise.id}
      exercise={exercise}
      dayName={day.name}
      progress={`${all.length - missing.length + 1} of ${all.length}`}
      last={missing.length === 1}
      initialStack={lastStack}
      liftWeight={latestInLift(program, sessions, exercise.name)?.weight}
      onSave={save}
      onLater={onClose}
    />
  )
}

interface StepProps {
  exercise: ProgramExercise
  dayName: string
  progress: string
  last: boolean
  initialStack: StackPick
  /** The lift's latest weight, pre-filled before the bank's (SPEC §9.4 slice 2). */
  liftWeight?: number
  onSave: (exercise: ProgramExercise, stack?: StackPick) => Promise<void>
  onLater: () => void
}

function SeedStep({
  exercise,
  dayName,
  progress,
  last,
  initialStack,
  liftWeight,
  onSave,
  onLater,
}: StepProps) {
  const askStack = needsStack(exercise)
  const [stack, setStack] = useState<StackPick>(initialStack)
  // Undefined until typed in, so the pre-fill can follow the chosen stack.
  const [weight, setWeight] = useState<string>()
  const [reps, setReps] = useState<string>()
  const [attempted, setAttempted] = useState(false)

  const loads = askStack ? stackLoads(stack) : exercise.loads
  const prefill = seedPrefill(exercise, askStack ? loads : undefined, liftWeight)
  const seed = { weight: weight ?? prefill.weight, reps: reps ?? prefill.reps }
  const bank = findBankExercise(exercise.name)
  const { min } = exercise.repRange

  const errors = validateSeedStep(seed, exercise.tier, askStack, loads)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setAttempted(true)
    if (errors.length > 0) return
    void onSave(
      { ...exercise, loads, seed: toSeed(seed, exercise.tier, exercise.repRange) },
      askStack ? stack : undefined,
    )
  }

  return (
    <Card as="form" className="walkthrough" onSubmit={submit}>
      <p className="muted">
        Starting numbers · {progress} · {dayName}
      </p>
      <h2>{exercise.name}</h2>
      {bank && <p className="muted">{bank.description}</p>}
      <p className="muted">{formatPrescription(exercise)}</p>

      {askStack && (
        <Field as="fieldset" label="Weight stack" hint="The weights on this machine at your gym.">
          <SegmentedControl
            className="segmented three"
            options={[
              ...STACK_PRESETS.map((p) => ({ value: p.id, label: p.label })),
              { value: 'custom' as const, label: 'Other' },
            ]}
            value={stack.choice}
            onChange={(choice) => setStack({ ...stack, choice })}
          />
          {stack.choice === 'custom' && (
            <input
              aria-label="Stack weights (lb)"
              value={stack.custom}
              placeholder="e.g. 12.5, 25, 37.5, 50"
              onChange={(e) => setStack({ ...stack, custom: e.target.value })}
            />
          )}
        </Field>
      )}

      <SeedFields
        tier={exercise.tier}
        name={exercise.name}
        minReps={String(min)}
        unilateral={exercise.unilateral}
        weight={seed.weight}
        reps={seed.reps}
        onWeight={setWeight}
        onReps={setReps}
      />

      {attempted && errors.length > 0 && (
        <ul className="errors" role="alert">
          {errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      )}

      <div className="actions">
        <Button type="submit" variant="primary">
          {last ? 'Done' : 'Next'}
        </Button>
        <Button onClick={onLater}>Finish later</Button>
      </div>
    </Card>
  )
}
