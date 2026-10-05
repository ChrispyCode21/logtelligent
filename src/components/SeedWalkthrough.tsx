import { useState } from 'react'
import { findBankExercise } from '../program/bank'
import { activeDays, missingSeeds, updateExercise } from '../program/program'
import { needsStack, parseLoads, seedPrefill, STACK_PRESETS, type StackPresetId } from '../program/seeding'
import type { Program, ProgramExercise } from '../program/types'
import { updateProgram } from '../storage/program'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Field } from '../ui/Field'

type StackChoice = StackPresetId | 'custom'

/** A stack pick: a preset, or 'custom' with the list typed for it. */
interface StackPick {
  choice: StackChoice
  custom: string
}

interface Props {
  program: Program
  /** Leave the walkthrough: "Finish later", or after the last exercise. */
  onClose: () => void
}

/**
 * Step through the exercises still missing starting numbers, one per screen (SPEC §9.1, slice 3).
 * Each Next saves that exercise, so the current step is always the first one still missing; leaving
 * and coming back resumes there.
 */
export function SeedWalkthrough({ program, onClose }: Props) {
  // The last stack picked (with its typed list, for 'custom') is offered first on the next
  // cable/machine exercise.
  const [lastStack, setLastStack] = useState<StackPick>({ choice: '5', custom: '' })
  const days = activeDays(program)
  const all = days.flatMap((d) => d.exercises)
  const missing = missingSeeds(program)
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
  onSave: (exercise: ProgramExercise, stack?: StackPick) => Promise<void>
  onLater: () => void
}

function SeedStep({ exercise, dayName, progress, last, initialStack, onSave, onLater }: StepProps) {
  const askStack = needsStack(exercise)
  const [stack, setStack] = useState<StackChoice>(initialStack.choice)
  const [customStack, setCustomStack] = useState(initialStack.custom)
  // Undefined until typed in, so the pre-fill can follow the chosen stack.
  const [weight, setWeight] = useState<string>()
  const [reps, setReps] = useState<string>()
  const [attempted, setAttempted] = useState(false)

  const primary = exercise.tier === 'primary'
  const loads = !askStack
    ? exercise.loads
    : stack === 'custom'
      ? parseLoads(customStack)
      : [...STACK_PRESETS.find((p) => p.id === stack)!.loads]
  const prefill = seedPrefill(exercise, askStack ? loads : undefined)
  const weightText = weight ?? prefill.weight
  const repsText = reps ?? prefill.reps
  const bank = findBankExercise(exercise.name)
  const { min, max } = exercise.repRange
  const repsWord = exercise.unilateral ? 'reps (per side)' : 'reps'

  const errors: string[] = []
  if (askStack && (!loads || loads.some((l) => !Number.isFinite(l) || l < 0))) {
    errors.push('Enter the stack weights, e.g. 10, 20, 30.')
  }
  const seedWeight = Number(weightText)
  if (weightText === '' || !Number.isFinite(seedWeight) || seedWeight < 0)
    errors.push('Starting weight must be a number.')
  const seedReps = Number(repsText)
  if (primary && !(Number.isInteger(seedReps) && seedReps >= 1))
    errors.push('Starting reps must be at least 1.')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setAttempted(true)
    if (errors.length > 0) return
    void onSave(
      {
        ...exercise,
        loads: askStack ? loads : exercise.loads,
        // Accessory seeds are a weight at the bottom of the range (SPEC §5.1).
        seed: { weight: seedWeight, reps: primary ? seedReps : min },
      },
      askStack ? { choice: stack, custom: customStack } : undefined,
    )
  }

  return (
    <Card as="form" className="walkthrough" onSubmit={submit}>
      <p className="muted">
        Starting numbers · {progress} · {dayName}
      </p>
      <h2>{exercise.name}</h2>
      {bank && <p className="muted">{bank.description}</p>}
      <p className="muted">
        {primary ? 'Primary' : 'Accessory'} · {exercise.sets} × {min}–{max}
        {exercise.unilateral && ' per side'} · {exercise.equipment}
      </p>

      {askStack && (
        <Field as="fieldset" label="Weight stack" hint="The weights on this machine at your gym.">
          <div className="segmented three">
            {STACK_PRESETS.map((p) => (
              <Button key={p.id} aria-pressed={stack === p.id} onClick={() => setStack(p.id)}>
                {p.label}
              </Button>
            ))}
            <Button aria-pressed={stack === 'custom'} onClick={() => setStack('custom')}>
              Other
            </Button>
          </div>
          {stack === 'custom' && (
            <input
              aria-label="Stack weights (lb)"
              value={customStack}
              placeholder="e.g. 12.5, 25, 37.5, 50"
              onChange={(e) => setCustomStack(e.target.value)}
            />
          )}
        </Field>
      )}

      {primary ? (
        <Field
          as="fieldset"
          label="Starting numbers"
          hint="A weight and reps you're confident you could do: hard, but you wouldn't fail."
        >
          <div className="row">
            <Field label="Weight (lb)">
              <input inputMode="decimal" value={weightText} onChange={(e) => setWeight(e.target.value)} />
            </Field>
            <Field label="Reps">
              <input inputMode="numeric" value={repsText} onChange={(e) => setReps(e.target.value)} />
            </Field>
          </div>
        </Field>
      ) : (
        <Field
          label={
            <span className="muted">
              What&apos;s a weight you can do {min} {repsWord} of {exercise.name} with that would be hard, but
              achievable?
            </span>
          }
        >
          <input inputMode="decimal" value={weightText} onChange={(e) => setWeight(e.target.value)} />
        </Field>
      )}

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
