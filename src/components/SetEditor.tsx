import { useState, type ReactNode } from 'react'
import type { LoggedSet } from '../engine'
import { addSet, removeSet, updateSet } from '../session/sets'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { formatSet } from '../ui/format'
import { RpePicker } from './RpePicker'

interface Form {
  weight: string
  reps: string
  rpe?: number
}

/** The next set pre-fills from the previous one (SPEC §5.2); set 1 from `first`. */
function prefill(sets: LoggedSet[], first?: { weight: number; reps: number }): Form {
  const last = sets.at(-1)
  if (last) return { weight: String(last.weight), reps: String(last.reps), rpe: last.rpe }
  if (first) return { weight: String(first.weight), reps: String(first.reps) }
  return { weight: '', reps: '' }
}

interface Props {
  sets: LoggedSet[]
  targetSets: number
  /** Pre-fill for the first set, usually the suggestion. */
  first?: { weight: number; reps: number }
  rpeRequiredAt: (index: number) => boolean
  /** The next weight up or down from `weight`, if any. */
  step: (weight: number, direction: 1 | -1) => number | undefined
  /** Smallest valid weight: 0 where unloaded sets make sense, else just above 0. */
  minWeight: number
  weightLabel: ReactNode
  repsLabel: ReactNode
  /** Shown below the form while no set is being edited. */
  footer?: ReactNode
  onSave: (sets: LoggedSet[]) => Promise<void>
}

/** Logged sets (tap to edit or delete) and the form for the next set. One working weight per exercise. */
export function SetEditor({
  sets,
  targetSets,
  first,
  rpeRequiredAt,
  step,
  minWeight,
  weightLabel,
  repsLabel,
  footer,
  onSave,
}: Props) {
  const [form, setForm] = useState<Form>(() => prefill(sets, first))
  const [editing, setEditing] = useState<number | null>(null)

  const formIndex = editing ?? sets.length
  // Logged sets stay editable after the last one is entered.
  const showForm = editing !== null || sets.length < targetSets
  const required = rpeRequiredAt(formIndex)
  const weight = Number(form.weight)
  const reps = Number(form.reps)
  const valid =
    form.weight !== '' &&
    weight >= minWeight &&
    form.reps !== '' &&
    Number.isInteger(reps) &&
    reps >= 0 &&
    (!required || form.rpe !== undefined)

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
    if (!valid) return
    const set: LoggedSet = { weight, reps, rpe: form.rpe }
    void save(editing === null ? addSet(sets, set) : updateSet(sets, editing, set))
  }

  function startEdit(index: number) {
    const set = sets[index]
    setEditing(index)
    setForm({ weight: String(set.weight), reps: String(set.reps), rpe: set.rpe })
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
                <span>{formatSet(set)}</span>
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

          <RpePicker value={form.rpe} required={required} onChange={(rpe) => setForm({ ...form, rpe })} />

          <div className="actions">
            <Button type="submit" variant="primary" disabled={!valid}>
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
