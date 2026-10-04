import { useState } from 'react'
import {
  availableLoads,
  evaluateSession,
  stepDown,
  stepUp,
  type ExerciseConfig,
  type ExerciseSession,
  type LoggedSet,
  type Suggestion,
} from '../engine'
import { addSet, canFinish, removeSet, rpeRequired, updateSet } from '../session/sets'
import type { Session } from '../storage/db'
import { discardSession, finishSession, saveSets } from '../storage/sessions'
import { RpePicker } from './RpePicker'

interface Form {
  weight: string
  reps: string
  rpe?: number
}

/** The next set pre-fills from the previous one (SPEC §5.2); set 1 from the suggestion. */
function prefill(sets: LoggedSet[], suggestion: Suggestion): Form {
  const last = sets.at(-1)
  if (last) return { weight: String(last.weight), reps: String(last.reps), rpe: last.rpe }
  if (suggestion.kind === 'suggestion') {
    return { weight: String(suggestion.weight), reps: String(suggestion.reps) }
  }
  return { weight: '', reps: '' }
}

function formatSet(set: LoggedSet) {
  return `${set.weight} × ${set.reps}${set.rpe !== undefined ? ` @ ${set.rpe}` : ''}`
}

interface Props {
  config: ExerciseConfig
  session: Session
  /** Finished history for this exercise. */
  history: ExerciseSession[]
  suggestion: Suggestion
}

export function SessionLogger({ config, session, history, suggestion }: Props) {
  const sets = session.exercises.find((e) => e.exerciseId === config.id)?.sets ?? []
  const [form, setForm] = useState<Form>(() => prefill(sets, suggestion))
  const [editing, setEditing] = useState<number | null>(null)

  // The working-set count is fixed by config, halved in a deload (SPEC §6.2, §6.7).
  const targetSets = suggestion.kind === 'suggestion' ? suggestion.sets : config.sets
  const formIndex = editing ?? sets.length
  // Logged sets stay editable after the last one is entered.
  const showForm = editing !== null || sets.length < targetSets
  // Validation runs once the last set is entered (SPEC §5.2, §6.6).
  const outcome = sets.length >= targetSets ? evaluateSession(config, history, sets) : undefined
  const required = rpeRequired(formIndex)
  const weight = Number(form.weight)
  const reps = Number(form.reps)
  const valid =
    form.weight !== '' &&
    weight > 0 &&
    form.reps !== '' &&
    Number.isInteger(reps) &&
    reps >= 0 &&
    (!required || form.rpe !== undefined)

  const loads = availableLoads(config)
  const stepWeight = (direction: 1 | -1) => {
    if (loads.length === 0) return
    const next = direction === 1 ? stepUp(weight, loads) : stepDown(weight, loads)
    if (next !== undefined) setForm({ ...form, weight: String(next) })
  }
  const stepReps = (delta: number) =>
    setForm({ ...form, reps: String(Math.max(0, (Number.isInteger(reps) ? reps : 0) + delta)) })

  async function save(nextSets: LoggedSet[]) {
    await saveSets(session.id, config.id, nextSets)
    setEditing(null)
    setForm(prefill(nextSets, suggestion))
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
    setForm(prefill(sets, suggestion))
  }

  async function finish() {
    const short = sets.length < targetSets
    if (short && !confirm(`Only ${sets.length} of ${targetSets} sets logged. Finish anyway?`)) return
    await finishSession(session.id)
  }

  async function discard() {
    if (confirm('Discard this session? Its logged sets will be deleted.')) {
      await discardSession(session.id)
    }
  }

  return (
    <section className="card">
      <h2>
        {config.name} <span className="muted">· {sets.length} of {targetSets} sets</span>
        {suggestion.kind === 'suggestion' && suggestion.plan === 'deload' && (
          <span className="tag">Deload</span>
        )}
      </h2>

      {sets.length > 0 && (
        <ol className="set-list">
          {sets.map((set, i) => (
            <li key={i}>
              <button
                type="button"
                className="set-row"
                aria-current={editing === i}
                onClick={() => startEdit(i)}
              >
                <span>Set {i + 1}</span>
                <span>{formatSet(set)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}

      {showForm && (
        <form className="set-form" onSubmit={submit}>
          <h3>{editing === null ? `Set ${formIndex + 1}` : `Editing set ${editing + 1}`}</h3>

          <label className="field">
            <span>
              Weight (lb){sets.length > 0 && <span className="muted"> · applies to all sets</span>}
            </span>
            <div className="stepper">
              <button type="button" aria-label="Lighter" onClick={() => stepWeight(-1)}>−</button>
              <input
                inputMode="decimal"
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
              />
              <button type="button" aria-label="Heavier" onClick={() => stepWeight(1)}>+</button>
            </div>
          </label>

          <label className="field">
            <span>Reps</span>
            <div className="stepper">
              <button type="button" aria-label="Fewer reps" onClick={() => stepReps(-1)}>−</button>
              <input
                inputMode="numeric"
                value={form.reps}
                onChange={(e) => setForm({ ...form, reps: e.target.value })}
              />
              <button type="button" aria-label="More reps" onClick={() => stepReps(1)}>+</button>
            </div>
          </label>

          <RpePicker value={form.rpe} required={required} onChange={(rpe) => setForm({ ...form, rpe })} />

          <div className="actions">
            <button type="submit" className="primary" disabled={!valid}>
              {editing === null ? 'Log set' : 'Save set'}
            </button>
            {editing !== null && (
              <>
                <button type="button" onClick={cancelEdit}>Cancel</button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => void save(removeSet(sets, editing))}
                >
                  Delete set
                </button>
              </>
            )}
          </div>
        </form>
      )}

      {editing === null && outcome?.message && (
        <p className="note warning" role="status">
          {outcome.message}
        </p>
      )}

      {editing === null && (
        <div className="actions">
          <button type="button" className="primary" disabled={!canFinish(sets)} onClick={finish}>
            Finish session
          </button>
          <button type="button" className="danger" onClick={discard}>Discard</button>
        </div>
      )}
    </section>
  )
}
