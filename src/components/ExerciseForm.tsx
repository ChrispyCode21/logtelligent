import { useState } from 'react'
import { defaultLoads, type EquipmentType } from '../engine'
import { exerciseFromBank, type BankExercise } from '../program/bank'
import { EFFORT_SCALES, nearestOption, type EffortScale } from '../program/effort'
import {
  fromForm,
  toForm,
  validateExerciseForm,
  withTier,
  type ExerciseFormFields,
} from '../program/exerciseForm'
import { formSeedPlaceholder, parseLoads, usesStack } from '../program/seeding'
import type { ProgramExercise } from '../program/types'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Field } from '../ui/Field'
import { EQUIPMENT_LABELS, TIER_LABELS } from '../ui/format'
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
  effortScale: EffortScale
  onSave: (exercise: ProgramExercise) => void
  onCancel: () => void
}

export function ExerciseForm({ initial, preset, effortScale, onSave, onCancel }: Props) {
  // A bank exercise's defaults are copied in; nothing links back to the bank (SPEC §9.1, slice 2).
  const [form, setForm] = useState(() => toForm(initial ?? (preset && exerciseFromBank(preset))))
  const [attempted, setAttempted] = useState(false)
  const set = <K extends keyof ExerciseFormFields>(key: K, value: ExerciseFormFields[K]) =>
    setForm({ ...form, [key]: value })

  const primary = form.tier === 'primary'
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
  // The bank's starting weight, while its equipment still applies.
  const bankWeight = preset && form.equipment === preset.equipment ? preset.seedPlaceholder : undefined

  return (
    <Card as="form" className="exercise-form" onSubmit={submit}>
      <h3>{initial ? `Edit ${initial.name}` : 'New exercise'}</h3>
      {preset && <p className="muted">{preset.description}</p>}

      <Field label="Name">
        <input value={form.name} onChange={(e) => set('name', e.target.value)} />
      </Field>

      <Field as="fieldset" label="Tier">
        <div className="segmented">
          {(['primary', 'accessory'] as const).map((tier) => (
            <Button
              key={tier}
              aria-pressed={form.tier === tier}
              onClick={() => setForm(withTier(form, tier))}
            >
              {TIER_LABELS[tier]}
            </Button>
          ))}
        </div>
      </Field>

      <div className="row">
        <Field label="Reps from">
          <input inputMode="numeric" value={form.min} onChange={(e) => set('min', e.target.value)} />
        </Field>
        <Field label="to">
          <input inputMode="numeric" value={form.max} onChange={(e) => set('max', e.target.value)} />
        </Field>
        <Field label="Sets">
          <input inputMode="numeric" value={form.sets} onChange={(e) => set('sets', e.target.value)} />
        </Field>
      </div>

      {primary && (
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

      <SeedFields
        tier={form.tier}
        name={form.name}
        minReps={form.min}
        unilateral={form.unilateral}
        weight={form.seedWeight}
        reps={form.seedReps}
        weightPlaceholder={formSeedPlaceholder(form.tier, form.equipment, loads, bankWeight)}
        onWeight={(w) => set('seedWeight', w)}
        onReps={(r) => set('seedReps', r)}
        className="seed"
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
          Save exercise
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </Card>
  )
}
