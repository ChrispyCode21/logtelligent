import { useState } from 'react'
import { defaultLoads, type EquipmentType } from '../engine'
import { withLiftGym } from '../history/lifts'
import { exerciseFromBank, type BankExercise } from '../program/bank'
import { EFFORT_SCALES, nearestOption, type EffortScale } from '../program/effort'
import {
  formSeedHasReps,
  fromForm,
  toForm,
  validateExerciseForm,
  withScheme,
  withTier,
  type ExerciseFormFields,
} from '../program/exerciseForm'
import { formSeedPlaceholder, parseLoads, usesStack } from '../program/seeding'
import type { ProgramExercise } from '../program/types'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Field } from '../ui/Field'
import { SegmentedControl } from '../ui/SegmentedControl'
import { EQUIPMENT_LABELS, SCHEME_LABELS, TIER_LABELS } from '../ui/format'
import { SeedFields } from './SeedFields'

const EQUIPMENT = Object.entries(EQUIPMENT_LABELS) as [EquipmentType, string][]
const TARGET_LABEL: Record<EffortScale, string> = {
  rpe: 'Target RPE on the first set',
  repsLeft: 'Target reps left on the first set',
  perceived: 'Target effort on the first set',
}
interface Props {
  initial?: ProgramExercise
  /** A new exercise from the bank: its defaults prefill the form. */
  preset?: BankExercise
  /** A bank exercise joining a lift with history: where its gym setup and starting weight come from (SPEC §6.9). */
  lift?: { exercise: ProgramExercise; weight?: number }
  /** Whether a lift of this name already has an e1RM: a primary's starting numbers are then optional (SPEC §6.9). */
  liftHasE1rm?: (name: string) => boolean
  /** The exercise has a finished session, so its scheme is fixed (SPEC §6.1). */
  schemeLocked?: boolean
  effortScale: EffortScale
  onSave: (exercise: ProgramExercise) => void
  onCancel: () => void
}

export function ExerciseForm({
  initial,
  preset,
  lift,
  liftHasE1rm,
  schemeLocked,
  effortScale,
  onSave,
  onCancel,
}: Props) {
  // A bank exercise's defaults are copied in; nothing links back to the bank (SPEC §5.1).
  // Joining a lift with history, it takes your gym's setup from it (SPEC §6.9).
  const [form, setForm] = useState(() =>
    toForm(initial ?? (preset && withLiftGym(exerciseFromBank(preset), lift?.exercise))),
  )
  const [attempted, setAttempted] = useState(false)
  const set = <K extends keyof ExerciseFormFields>(key: K, value: ExerciseFormFields[K]) =>
    setForm({ ...form, [key]: value })

  const primary = form.tier === 'primary'
  const linear = form.scheme === 'linear'
  // A primary on a lift with an e1RM needs no starting numbers; a Linear one starts from it (SPEC §6.9).
  const fromLiftE1rm = primary && !!form.name.trim() && !!liftHasE1rm?.(form.name)
  const loads = parseLoads(form.loads)
  const errors = validateExerciseForm(form)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setAttempted(true)
    if (errors.length === 0) onSave(fromForm(form, initial))
  }

  const defaults = defaultLoads(form.equipment)
  const loadsPlaceholder = defaults.length
    ? `Default: ${defaults.slice(0, 6).join(', ')}…`
    : 'e.g. 88, 99, 110, 121, 132'
  // The lift's latest weight while its equipment still applies (SPEC §6.9), else the bank's.
  const startingWeight =
    lift && form.equipment === lift.exercise.equipment
      ? lift.weight
      : preset && form.equipment === preset.equipment
        ? preset.seedPlaceholder
        : undefined

  return (
    <Card as="form" className="exercise-form" onSubmit={submit}>
      <h3>{initial ? `Edit ${initial.name}` : 'New exercise'}</h3>
      {preset && <p className="muted">{preset.description}</p>}

      <Field label="Name">
        <input value={form.name} onChange={(e) => set('name', e.target.value)} />
      </Field>

      <Field as="fieldset" label="Tier">
        <SegmentedControl
          options={(['primary', 'accessory'] as const).map((tier) => ({
            value: tier,
            label: TIER_LABELS[tier],
          }))}
          value={form.tier}
          onChange={(tier) => setForm(withTier(form, tier))}
        />
      </Field>

      {schemeLocked ? (
        <Field
          as="fieldset"
          label="Progression"
          hint="Fixed once it's been logged. To change it, add the exercise again."
        >
          <p>{SCHEME_LABELS[form.scheme]}</p>
        </Field>
      ) : (
        <Field as="fieldset" label="Progression">
          <SegmentedControl
            options={(['adaptive', 'linear'] as const).map((scheme) => ({
              value: scheme,
              label: SCHEME_LABELS[scheme],
            }))}
            value={form.scheme}
            onChange={(scheme) => setForm(withScheme(form, scheme))}
          />
        </Field>
      )}

      {linear && (
        <Field label={`${form.equipment === 'bodyweight' ? 'Added weight' : 'Increase'} each session (lb)`}>
          <input
            inputMode="decimal"
            value={form.increment}
            onChange={(e) => set('increment', e.target.value)}
          />
        </Field>
      )}

      <div className="row">
        {linear ? (
          <Field label="Reps">
            <input inputMode="numeric" value={form.reps} onChange={(e) => set('reps', e.target.value)} />
          </Field>
        ) : (
          <>
            <Field label="Reps from">
              <input inputMode="numeric" value={form.min} onChange={(e) => set('min', e.target.value)} />
            </Field>
            <Field label="to">
              <input inputMode="numeric" value={form.max} onChange={(e) => set('max', e.target.value)} />
            </Field>
          </>
        )}
        <Field label="Sets">
          <input inputMode="numeric" value={form.sets} onChange={(e) => set('sets', e.target.value)} />
        </Field>
      </div>

      {/* Linear has no effort target; a stored one is kept for switching back (SPEC §6.1). */}
      {primary && !linear && (
        <Field label={TARGET_LABEL[effortScale]}>
          <select
            // A stored target between this scale's options shows as the nearest; it only changes
            // if a new one is picked.
            value={nearestOption(effortScale, form.targetRpe).rpe}
            onChange={(e) => set('targetRpe', Number(e.target.value))}
          >
            {EFFORT_SCALES[effortScale].options.map(({ rpe, label }) => (
              <option key={rpe} value={rpe}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label="Equipment">
        <select value={form.equipment} onChange={(e) => set('equipment', e.target.value as EquipmentType)}>
          {/* Bodyweight is accessory-only (SPEC §6.1). */}
          {EQUIPMENT.filter(([value]) => !(primary && value === 'bodyweight')).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label={
          <>
            {form.equipment === 'bodyweight' ? 'Added weights' : 'Available weights'} (lb)
            {!usesStack(form.equipment) && <span className="muted"> · optional, for your gym</span>}
          </>
        }
      >
        <input
          value={form.loads}
          placeholder={loadsPlaceholder}
          onChange={(e) => set('loads', e.target.value)}
        />
      </Field>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={form.unilateral}
          onChange={(e) => set('unilateral', e.target.checked)}
        />
        <span>One side at a time (reps are per side)</span>
      </label>

      {fromLiftE1rm && !linear && (
        <p className="muted">Optional: {form.name.trim()} already has an estimated 1RM from your history.</p>
      )}
      {fromLiftE1rm && linear ? (
        <p className="muted">
          The first weight comes from {form.name.trim()}&apos;s estimated 1RM, so no starting weight is
          needed.
        </p>
      ) : (
        <SeedFields
          tier={form.tier}
          withReps={formSeedHasReps(form)}
          name={form.name}
          minReps={linear ? form.reps : form.min}
          unilateral={form.unilateral}
          weight={form.seedWeight}
          reps={form.seedReps}
          weightPlaceholder={formSeedPlaceholder(form.tier, form.equipment, loads, startingWeight)}
          onWeight={(w) => set('seedWeight', w)}
          onReps={(r) => set('seedReps', r)}
          className="seed"
        />
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
          Save exercise
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </Card>
  )
}
