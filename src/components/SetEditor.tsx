import { useState, type ReactNode } from 'react'
import type { LoggedSet } from '../engine'
import type { EffortScale } from '../program/effort'
import { formFromSet, parseSetForm, prefill, type SetForm } from '../session/setForm'
import { addSet, removeSet, updateSet } from '../session/sets'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { formatSet } from '../ui/format'
import { EffortPicker } from './EffortPicker'

interface Props {
  sets: LoggedSet[]
  /** A new set can be logged; the caller decides when the exercise's sets are all in. */
  canAdd: boolean
  /** Pre-fill for the first set, usually the suggestion. */
  first?: { weight: number; reps: number }
  effortScale: EffortScale
  rpeRequiredAt: (index: number) => boolean
  /** The next weight up or down from `weight`, if any. */
  step: (weight: number, direction: 1 | -1) => number | undefined
  allowZeroWeight: boolean
  weightLabel: ReactNode
  repsLabel: ReactNode
  /** Shown below the form while no set is being edited. */
  footer?: ReactNode
  onSave: (sets: LoggedSet[]) => Promise<void>
}

/** Logged sets (tap to edit or delete) and the form for the next set. One working weight per exercise. */
export function SetEditor({
  sets,
  canAdd,
  first,
  effortScale,
  rpeRequiredAt,
  step,
  allowZeroWeight,
  weightLabel,
  repsLabel,
  footer,
  onSave,
}: Props) {
  const [form, setForm] = useState<SetForm>(() => prefill(sets, first))
  const [editing, setEditing] = useState<number | null>(null)

  const formIndex = editing ?? sets.length
  // Logged sets stay editable after the last one is entered.
  const showForm = editing !== null || canAdd
  const required = rpeRequiredAt(formIndex)
  const parsed = parseSetForm(form, { allowZeroWeight, rpeRequired: required })
  const weight = Number(form.weight)
  const reps = Number(form.reps)

  const stepWeight = (direction: 1 | -1) => {
    const next = step(weight, direction)
    if (next !== undefined) setForm({ ...form, weight: String(next) })
  }
  const stepReps = (delta: number) =>
    setForm({ ...form, reps: String(Math.max(0, (Number.isInteger(reps) ? reps : 0) + delta)) })

  async function save(nextSets: LoggedSet[]) {
    await onSave(nextSets)
    setEditing(null)
    setForm(prefill(nextSets, first))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!parsed) return
    void save(editing === null ? addSet(sets, parsed) : updateSet(sets, editing, parsed))
  }

  function startEdit(index: number) {
    setEditing(index)
    setForm(formFromSet(sets[index]))
  }

  function cancelEdit() {
    setEditing(null)
    setForm(prefill(sets, first))
  }

  return (
    <>
      {sets.length > 0 && (
        <ol className="set-list">
          {sets.map((set, i) => (
            <li key={i}>
              <Button className="set-row" aria-current={editing === i} onClick={() => startEdit(i)}>
                <span>Set {i + 1}</span>
                <span>{formatSet(set, effortScale)}</span>
              </Button>
            </li>
          ))}
        </ol>
      )}

      {showForm && (
        <form className="set-form" onSubmit={submit}>
          <h3>{editing === null ? `Set ${formIndex + 1}` : `Editing set ${editing + 1}`}</h3>

          <Field
            label={
              <>
                {weightLabel}
                {sets.length > 0 && <span className="muted"> · applies to all sets</span>}
              </>
            }
          >
            <div className="stepper">
              <Button aria-label="Lighter" onClick={() => stepWeight(-1)}>
                −
              </Button>
              <input
                inputMode="decimal"
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
              />
              <Button aria-label="Heavier" onClick={() => stepWeight(1)}>
                +
              </Button>
            </div>
          </Field>

          <Field label={repsLabel}>
            <div className="stepper">
              <Button aria-label="Fewer reps" onClick={() => stepReps(-1)}>
                −
              </Button>
              <input
                inputMode="numeric"
                value={form.reps}
                onChange={(e) => setForm({ ...form, reps: e.target.value })}
              />
              <Button aria-label="More reps" onClick={() => stepReps(1)}>
                +
              </Button>
            </div>
          </Field>

          <EffortPicker
            scale={effortScale}
            value={form.rpe}
            required={required}
            onChange={(rpe) => setForm({ ...form, rpe })}
          />

          <div className="actions">
            <Button type="submit" variant="primary" disabled={!parsed}>
              {editing === null ? 'Log set' : 'Save set'}
            </Button>
            {editing !== null && (
              <>
                <Button onClick={cancelEdit}>Cancel</Button>
                <Button variant="danger" onClick={() => void save(removeSet(sets, editing))}>
                  Delete set
                </Button>
              </>
            )}
          </div>
        </form>
      )}

      {editing === null && footer}
    </>
  )
}
