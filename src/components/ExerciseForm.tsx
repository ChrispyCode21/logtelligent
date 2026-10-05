import { useState } from 'react'
import { defaultLoads, type EquipmentType, type Tier } from '../engine'
import type { ProgramExercise } from '../program/types'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { RPE_SCALE } from '../ui/rpe'

const EQUIPMENT: { value: EquipmentType; label: string }[] = [
  { value: 'barbell', label: 'Barbell' },
  { value: 'dumbbell', label: 'Dumbbell' },
  { value: 'cable', label: 'Cable' },
  { value: 'machine', label: 'Machine' },
  { value: 'bodyweight', label: 'Bodyweight' },
]
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

function toForm(e?: ProgramExercise): Form {
  return {
    name: e?.name ?? '',
    tier: e?.tier ?? 'primary',
    min: String(e?.repRange.min ?? ''),
    max: String(e?.repRange.max ?? ''),
    sets: String(e?.sets ?? 3),
    equipment: e?.equipment ?? 'barbell',
    targetRpe: e?.targetRpe ?? 8,
    unilateral: e?.unilateral ?? false,
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
  onSave: (exercise: ProgramExercise) => void
  onCancel: () => void
}

export function ExerciseForm({ initial, onSave, onCancel }: Props) {
  const [form, setForm] = useState<Form>(() => toForm(initial))
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

  return (
    <Card as="form" className="exercise-form" onSubmit={submit}>
      <h3>{initial ? `Edit ${initial.name}` : 'New exercise'}</h3>

      <label className="field">
        <span>Name</span>
        <input value={form.name} onChange={(e) => set('name', e.target.value)} />
      </label>

      <fieldset className="field">
        <legend>Tier</legend>
        <div className="segmented">
          {(['primary', 'accessory'] as const).map((tier) => (
            <Button key={tier} aria-pressed={form.tier === tier} onClick={() => changeTier(tier)}>
              {tier === 'primary' ? 'Primary' : 'Accessory'}
            </Button>
          ))}
        </div>
      </fieldset>

      <div className="row">
        <label className="field">
          <span>Reps from</span>
          <input inputMode="numeric" value={form.min} onChange={(e) => set('min', e.target.value)} />
        </label>
        <label className="field">
          <span>to</span>
          <input inputMode="numeric" value={form.max} onChange={(e) => set('max', e.target.value)} />
        </label>
        <label className="field">
          <span>Sets</span>
          <input inputMode="numeric" value={form.sets} onChange={(e) => set('sets', e.target.value)} />
        </label>
      </div>

      {primary && (
        <label className="field">
          <span>Target RPE on the first set</span>
          <select value={form.targetRpe} onChange={(e) => set('targetRpe', Number(e.target.value))}>
            {RPE_SCALE.map((rpe) => (
              <option key={rpe} value={rpe}>
                {rpe}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="field">
        <span>Equipment</span>
        <select value={form.equipment} onChange={(e) => set('equipment', e.target.value as EquipmentType)}>
          {EQUIPMENT.filter((o) => !(primary && o.value === 'bodyweight')).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>
          {form.equipment === 'bodyweight' ? 'Added weights' : 'Available weights'} (lb)
          {!needsLoads && <span className="muted"> · optional, for your gym</span>}
        </span>
        <input
          value={form.loads}
          placeholder={loadsPlaceholder}
          onChange={(e) => set('loads', e.target.value)}
        />
      </label>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={form.unilateral}
          onChange={(e) => set('unilateral', e.target.checked)}
        />
        <span>One side at a time (reps are per side)</span>
      </label>

      <fieldset className="field seed">
        <legend>Starting numbers</legend>
        {primary ? (
          <>
            <p className="muted">
              Enter a weight and reps you&apos;re confident you could do: hard, but you wouldn&apos;t fail.
            </p>
            <div className="row">
              <label className="field">
                <span>Weight (lb)</span>
                <input
                  inputMode="decimal"
                  value={form.seedWeight}
                  onChange={(e) => set('seedWeight', e.target.value)}
                />
              </label>
              <label className="field">
                <span>Reps</span>
                <input
                  inputMode="numeric"
                  value={form.seedReps}
                  onChange={(e) => set('seedReps', e.target.value)}
                />
              </label>
            </div>
          </>
        ) : (
          <label className="field">
            <span className="muted">
              What&apos;s a weight you can do {form.min || 'the bottom of the range'} {repsWord} of{' '}
              {form.name.trim() || 'this exercise'} with that would be hard, but achievable?
            </span>
            <input
              inputMode="decimal"
              value={form.seedWeight}
              placeholder={SEED_PLACEHOLDER[form.equipment] || loads?.[0]?.toString() || ''}
              onChange={(e) => set('seedWeight', e.target.value)}
            />
          </label>
        )}
      </fieldset>

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
