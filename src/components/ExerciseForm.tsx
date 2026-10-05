import { useState } from 'react'
import { defaultLoads, type EquipmentType, type Tier } from '../engine'
import { EFFORT_SCALES, nearestOption, type EffortScale } from '../program/effort'
import type { BankExercise } from '../program/bank'
import type { ProgramExercise } from '../program/types'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Field } from '../ui/Field'

const EQUIPMENT: { value: EquipmentType; label: string }[] = [
  { value: 'barbell', label: 'Barbell' },
  { value: 'dumbbell', label: 'Dumbbell' },
  { value: 'cable', label: 'Cable' },
  { value: 'machine', label: 'Machine' },
  { value: 'bodyweight', label: 'Bodyweight' },
]
const TARGET_LABEL: Record<EffortScale, string> = {
  rpe: 'Target RPE on the first set',
  repsLeft: 'Target reps left on the first set',
  perceived: 'Target effort on the first set',
}
// Fixed for every exercise; not in the form (SPEC §6.1).
const MAX_RELATIVE_JUMP = 0.1
// Placeholder suggestions for an accessory seed (SPEC §5.1).
const SEED_PLACEHOLDER: Record<EquipmentType, string> = {
  barbell: '65',
  dumbbell: '15',
  cable: '',
  machine: '',
  bodyweight: '0',
}

interface Form {
  name: string
  tier: Tier
  min: string
  max: string
  sets: string
  equipment: EquipmentType
  targetRpe: number
  unilateral: boolean
  loads: string
  seedWeight: string
  seedReps: string
}

/** From an existing exercise, else a bank exercise's defaults (SPEC §9.1, slice 2), else blank. */
function toForm(e?: ProgramExercise, preset?: BankExercise): Form {
  const from = e ?? preset
  return {
    name: from?.name ?? '',
    tier: from?.tier ?? 'primary',
    min: String(from?.repRange.min ?? ''),
    max: String(from?.repRange.max ?? ''),
    sets: String(from?.sets ?? 3),
    equipment: from?.equipment ?? 'barbell',
    targetRpe: e?.targetRpe ?? 8,
    unilateral: from?.unilateral ?? false,
    loads: e?.loads?.join(', ') ?? '',
    seedWeight: e?.seed ? String(e.seed.weight) : '',
    seedReps: e?.seed ? String(e.seed.reps) : '',
  }
}

const isWholeNumber = (s: string, min: number) => s !== '' && Number.isInteger(Number(s)) && Number(s) >= min

function parseLoads(text: string): number[] | undefined {
  const parts = text.split(/[\s,]+/).filter(Boolean)
  if (parts.length === 0) return undefined
  return parts.map(Number)
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
  const [form, setForm] = useState<Form>(() => toForm(initial, preset))
  const [attempted, setAttempted] = useState(false)
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm({ ...form, [key]: value })

  const primary = form.tier === 'primary'
  const loads = parseLoads(form.loads)
  const needsLoads = form.equipment === 'cable' || form.equipment === 'machine'
  const hasSeed = form.seedWeight !== '' || (primary && form.seedReps !== '')

  const errors: string[] = []
  if (!form.name.trim()) errors.push('Name is required.')
  if (!isWholeNumber(form.min, 1) || !isWholeNumber(form.max, 1) || Number(form.max) < Number(form.min)) {
    errors.push('Rep range needs whole numbers, with the top at least the bottom.')
  }
  if (!isWholeNumber(form.sets, 1)) errors.push('Sets must be at least 1.')
  if (loads?.some((l) => !Number.isFinite(l) || l < 0))
    errors.push('Loads must be numbers, e.g. 99, 110, 121.')
  if (needsLoads && !loads) errors.push('Enter the stack weights for cable and machine exercises.')
  if (hasSeed) {
    const weight = Number(form.seedWeight)
    if (form.seedWeight === '' || !Number.isFinite(weight) || weight < 0) {
      errors.push('Starting weight must be a number.')
    }
    if (primary && !isWholeNumber(form.seedReps, 1)) errors.push('Starting reps must be at least 1.')
  }

  function changeTier(tier: Tier) {
    // Bodyweight is accessory-only (SPEC §6.1).
    const equipment = tier === 'primary' && form.equipment === 'bodyweight' ? 'barbell' : form.equipment
    setForm({ ...form, tier, equipment })
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setAttempted(true)
    if (errors.length > 0) return
    const min = Number(form.min)
    onSave({
      ...initial,
      id: initial?.id ?? crypto.randomUUID(),
      name: form.name.trim(),
      tier: form.tier,
      repRange: { min, max: Number(form.max) },
      targetRpe: form.targetRpe,
      sets: Number(form.sets),
      equipment: form.equipment,
      loads,
      maxRelativeJump: MAX_RELATIVE_JUMP,
      unilateral: form.unilateral,
      // Accessory seeds are a weight at the bottom of the range (SPEC §5.1).
      seed: hasSeed
        ? { weight: Number(form.seedWeight), reps: primary ? Number(form.seedReps) : min }
        : undefined,
    })
  }

  const defaults = defaultLoads(form.equipment)
  const loadsPlaceholder = defaults.length
    ? `Default: ${defaults.slice(0, 6).join(', ')}…`
    : 'e.g. 88, 99, 110, 121, 132'
  const repsWord = form.unilateral ? 'reps (per side)' : 'reps'
  // The bank's starting-weight hint, while its equipment still applies.
  const presetSeed =
    preset && form.equipment === preset.equipment ? String(preset.seedPlaceholder) : undefined

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
            <Button key={tier} aria-pressed={form.tier === tier} onClick={() => changeTier(tier)}>
              {tier === 'primary' ? 'Primary' : 'Accessory'}
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
          {EQUIPMENT.filter((o) => !(primary && o.value === 'bodyweight')).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label={
          <>
            {form.equipment === 'bodyweight' ? 'Added weights' : 'Available weights'} (lb)
            {!needsLoads && <span className="muted"> · optional, for your gym</span>}
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

      <Field
        as="fieldset"
        label="Starting numbers"
        hint={
          primary && "Enter a weight and reps you're confident you could do: hard, but you wouldn't fail."
        }
        className="seed"
      >
        {primary ? (
          <div className="row">
            <Field label="Weight (lb)">
              <input
                inputMode="decimal"
                value={form.seedWeight}
                placeholder={presetSeed}
                onChange={(e) => set('seedWeight', e.target.value)}
              />
            </Field>
            <Field label="Reps">
              <input
                inputMode="numeric"
                value={form.seedReps}
                onChange={(e) => set('seedReps', e.target.value)}
              />
            </Field>
          </div>
        ) : (
          <Field
            label={
              <span className="muted">
                What&apos;s a weight you can do {form.min || 'the bottom of the range'} {repsWord} of{' '}
                {form.name.trim() || 'this exercise'} with that would be hard, but achievable?
              </span>
            }
          >
            <input
              inputMode="decimal"
              value={form.seedWeight}
              placeholder={presetSeed ?? (SEED_PLACEHOLDER[form.equipment] || loads?.[0]?.toString() || '')}
              onChange={(e) => set('seedWeight', e.target.value)}
            />
          </Field>
        )}
      </Field>

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
