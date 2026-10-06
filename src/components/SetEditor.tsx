import { useState, type ReactNode } from 'react'
import { countedSets, type LoggedSet } from '../engine'
import type { EffortScale } from '../program/effort'
import { formFromSet, parseSetForm, prefill, prefillExtra, type SetForm } from '../session/setForm'
import { addExtra, addSet, removalNeedsEffort, removeFirstSet, removeSet, updateSet } from '../session/sets'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { formatSet } from '../ui/format'
import { EffortPicker } from './EffortPicker'

interface Props {
  sets: LoggedSet[]
  /** A new prescribed set can be logged; the caller decides when the exercise's sets are all in. */
  canAdd: boolean
  /** "+ Add set" for an extra set is offered (SPEC §9.2, slice 2). */
  canAddExtra: boolean
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

/**
 * Logged sets (tap to edit or delete) and the form for the next set. One working weight across the
 * prescribed sets; extra sets come after them with their own weight and no effort.
 */
export function SetEditor({
  sets,
  canAdd,
  canAddExtra,
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
  const [addingExtra, setAddingExtra] = useState(false)
  // Deleting set 1 when set 2 has no effort: the form shows set 2, which needs one (SPEC §9.2, slice 1).
  const [replacingFirst, setReplacingFirst] = useState(false)

  const countedCount = countedSets(sets).length
  const extraMode = addingExtra || (editing !== null && !!sets[editing].extra)
  const formIndex = replacingFirst ? 0 : (editing ?? countedCount)
  // Logged sets stay editable after the last one is entered.
  const showForm = editing !== null || addingExtra || canAdd
  const required = !extraMode && rpeRequiredAt(formIndex)
  const parsed = parseSetForm(form, { allowZeroWeight, rpeRequired: required })
  const weight = Number(form.weight)
  const reps = Number(form.reps)
  const hasExtras = countedCount < sets.length

  /** "Set 2", or "Extra 1" for the first extra (extras come after the prescribed sets). */
  const setLabel = (i: number) => (sets[i].extra ? `Extra ${i - countedCount + 1}` : `Set ${i + 1}`)

  const stepWeight = (direction: 1 | -1) => {
    const next = step(weight, direction)
    if (next !== undefined) setForm({ ...form, weight: String(next) })
  }
  const stepReps = (delta: number) =>
    setForm({ ...form, reps: String(Math.max(0, (Number.isInteger(reps) ? reps : 0) + delta)) })

  function reset() {
    setEditing(null)
    setAddingExtra(false)
    setReplacingFirst(false)
  }

  async function save(nextSets: LoggedSet[]) {
    await onSave(nextSets)
    reset()
    setForm(prefill(nextSets, first))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!parsed) return
    if (replacingFirst) void save(removeFirstSet(sets, parsed))
    else if (addingExtra) void save(addExtra(sets, parsed))
    else void save(editing === null ? addSet(sets, parsed) : updateSet(sets, editing, parsed))
  }

  function deleteSet(index: number) {
    if (!removalNeedsEffort(sets, index, rpeRequiredAt)) {
      void save(removeSet(sets, index))
      return
    }
    setReplacingFirst(true)
    setForm(formFromSet(sets[1]))
  }

  function startEdit(index: number) {
    reset()
    setEditing(index)
    setForm(formFromSet(sets[index]))
  }

  function startExtra() {
    reset()
    setAddingExtra(true)
    setForm(prefillExtra(sets))
  }

  function cancel() {
    reset()
    setForm(prefill(sets, first))
  }

  const heading = replacingFirst
    ? 'Set 2 becomes set 1: add its effort'
    : addingExtra
      ? 'Extra set'
      : editing === null
        ? `Set ${formIndex + 1}`
        : `Editing ${setLabel(editing).toLowerCase()}`

  return (
    <>
      {sets.length > 0 && (
        <ol className="set-list">
          {sets.map((set, i) => (
            <li key={i}>
              <Button
                className="set-row"
                aria-current={replacingFirst ? i === 1 : editing === i}
                onClick={() => startEdit(i)}
              >
                <span>{setLabel(i)}</span>
                <span>{formatSet(set, effortScale)}</span>
              </Button>
            </li>
          ))}
        </ol>
      )}

      {showForm && (
        <form className="set-form" onSubmit={submit}>
          <h3>{heading}</h3>

          <Field
            label={
              <>
                {weightLabel}
                {!extraMode && countedCount > 0 && (
                  <span className="muted"> · applies to all sets{hasExtras && ' but extras'}</span>
                )}
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

          {/* Effort isn't asked on extra sets (SPEC §9.2, slice 2). */}
          {!extraMode && (
            <EffortPicker
              scale={effortScale}
              value={form.rpe}
              required={required}
              onChange={(rpe) => setForm({ ...form, rpe })}
            />
          )}

          <div className="actions">
            <Button type="submit" variant="primary" disabled={!parsed}>
              {replacingFirst
                ? 'Delete set 1'
                : addingExtra
                  ? 'Log extra set'
                  : editing === null
                    ? 'Log set'
                    : 'Save set'}
            </Button>
            {(editing !== null || addingExtra) && <Button onClick={cancel}>Cancel</Button>}
            {editing !== null && !replacingFirst && (
              <Button variant="danger" onClick={() => deleteSet(editing)}>
                Delete set
              </Button>
            )}
          </div>
        </form>
      )}

      {canAddExtra && !showForm && (
        <div className="actions">
          <Button onClick={startExtra}>+ Add set</Button>
        </div>
      )}

      {editing === null && !addingExtra && footer}
    </>
  )
}
