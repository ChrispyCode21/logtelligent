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
  /** "+ Add set" for an extra set is offered (SPEC §5.2). */
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

/** What the form is doing. */
type Mode =
  | { kind: 'new' }
  | { kind: 'edit'; index: number }
  // Logging an extra set (SPEC §5.2).
  | { kind: 'extra' }
  // Deleting set 1 when set 2 has no effort: the form shows set 2, which needs one (SPEC §5.4).
  | { kind: 'replaceFirst' }

const NEW: Mode = { kind: 'new' }

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
  const [modeState, setMode] = useState<Mode>(NEW)
  // A save re-renders with the new sets before the mode resets, so a deleted last set can leave the
  // index past the end for one render.
  const mode: Mode = modeState.kind === 'edit' && modeState.index >= sets.length ? NEW : modeState

  const countedCount = countedSets(sets).length
  const editing = mode.kind === 'edit' ? mode.index : null
  const extraMode = mode.kind === 'extra' || (editing !== null && !!sets[editing].extra)
  const formIndex = mode.kind === 'replaceFirst' ? 0 : (editing ?? countedCount)
  // Logged sets stay editable after the last one is entered.
  const showForm = mode.kind !== 'new' || canAdd
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

  async function save(nextSets: LoggedSet[]) {
    await onSave(nextSets)
    setMode(NEW)
    setForm(prefill(nextSets, first))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (parsed) void save(withSubmitted(parsed))
  }

  function withSubmitted(set: LoggedSet): LoggedSet[] {
    switch (mode.kind) {
      case 'new':
        return addSet(sets, set)
      case 'edit':
        return updateSet(sets, mode.index, set)
      case 'extra':
        return addExtra(sets, set)
      case 'replaceFirst':
        return removeFirstSet(sets, set)
    }
  }

  function deleteSet(index: number) {
    if (!removalNeedsEffort(sets, index, rpeRequiredAt)) {
      void save(removeSet(sets, index))
      return
    }
    setMode({ kind: 'replaceFirst' })
    setForm(formFromSet(sets[1]))
  }

  function startEdit(index: number) {
    setMode({ kind: 'edit', index })
    setForm(formFromSet(sets[index]))
  }

  function startExtra() {
    setMode({ kind: 'extra' })
    setForm(prefillExtra(sets))
  }

  function cancel() {
    setMode(NEW)
    setForm(prefill(sets, first))
  }

  function formText(): { heading: string; submitLabel: string } {
    switch (mode.kind) {
      case 'new':
        return { heading: `Set ${countedCount + 1}`, submitLabel: 'Log set' }
      case 'edit':
        return { heading: `Editing ${setLabel(mode.index).toLowerCase()}`, submitLabel: 'Save set' }
      case 'extra':
        return { heading: 'Extra set', submitLabel: 'Log extra set' }
      case 'replaceFirst':
        return { heading: 'Set 2 becomes set 1: add its effort', submitLabel: 'Delete set 1' }
    }
  }
  const { heading, submitLabel } = formText()

  return (
    <>
      {sets.length > 0 && (
        <ol className="set-list">
          {sets.map((set, i) => (
            <li key={i}>
              <Button
                className="set-row"
                aria-current={mode.kind === 'replaceFirst' ? i === 1 : editing === i}
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

          {/* Effort is asked only where it's used: a primary lift's first set (SPEC §6.3). */}
          {required && (
            <EffortPicker
              scale={effortScale}
              value={form.rpe}
              onChange={(rpe) => setForm({ ...form, rpe })}
            />
          )}

          <div className="actions">
            <Button type="submit" variant="primary" disabled={!parsed}>
              {submitLabel}
            </Button>
            {mode.kind !== 'new' && <Button onClick={cancel}>Cancel</Button>}
            {editing !== null && (
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

      {mode.kind === 'new' && footer}
    </>
  )
}
