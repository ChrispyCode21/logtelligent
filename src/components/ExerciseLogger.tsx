import { useState } from 'react'
import {
  availableLoads,
  evaluateSession,
  stepDown,
  stepUp,
  type ExerciseConfig,
  type ExerciseSession,
  type Suggestion,
} from '../engine'
import type { EffortScale } from '../program/effort'
import { rpeRequired } from '../session/sets'
import type { ExerciseLog } from '../storage/db'
import {
  replaceExercise,
  restoreExercise,
  saveSets,
  saveSubstituteSets,
  skipExercise,
  undoReplace,
} from '../storage/sessions'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Field } from '../ui/Field'
import { formatSets } from '../ui/format'
import { SetEditor } from './SetEditor'

const VOLUME_ONLY_NOTICE = 'This will be tracked as volume only and not used for estimates.'
const SUBSTITUTE_STEP = 5

interface Props {
  sessionId: number
  config: ExerciseConfig
  log: ExerciseLog
  /** Finished history for this exercise. */
  history: ExerciseSession[]
  suggestion: Suggestion
  effortScale: EffortScale
}

export function ExerciseLogger({ sessionId, config, log, history, suggestion, effortScale }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [replacing, setReplacing] = useState(false)
  const [substituteName, setSubstituteName] = useState('')

  // The working-set count is fixed by config, halved in a deload (SPEC §6.2, §6.7).
  const targetSets = suggestion.kind === 'suggestion' ? suggestion.sets : config.sets
  const substitute = log.substitute
  const sets = log.sets

  function closeMenu() {
    setMenuOpen(false)
    setReplacing(false)
  }

  async function confirmReplace(e: React.FormEvent) {
    e.preventDefault()
    const name = substituteName.trim()
    if (!name) return
    await replaceExercise(sessionId, config.id, name)
    setSubstituteName('')
    closeMenu()
  }

  async function undo() {
    const count = substitute?.sets.length ?? 0
    const message = `Undo the replace? The ${count} set${count === 1 ? '' : 's'} logged for ${substitute?.name} will be discarded.`
    if (count === 0 || confirm(message)) await undoReplace(sessionId, config.id)
    closeMenu()
  }

  async function skip() {
    const count = sets.length + (substitute?.sets.length ?? 0)
    const message = `Skip ${config.name} today? The ${count} set${count === 1 ? '' : 's'} logged for it will be discarded.`
    if (count === 0 || confirm(message)) await skipExercise(sessionId, config.id)
    closeMenu()
  }

  async function restore() {
    await restoreExercise(sessionId, config.id)
    closeMenu()
  }

  const header = (
    <div className="logger-head">
      <h2>
        {config.name}
        {substitute ? (
          <span className="muted"> → {substitute.name}</span>
        ) : log.skipped ? (
          <span className="muted"> · skipped today</span>
        ) : (
          <span className="muted">
            {' '}
            · {sets.length} of {targetSets} sets
          </span>
        )}
        {!substitute && !log.skipped && suggestion.kind === 'suggestion' && suggestion.plan === 'deload' && (
          <span className="tag">Deload</span>
        )}
      </h2>
      <Button
        className="menu-button"
        aria-label={`Options for ${config.name}`}
        aria-expanded={menuOpen}
        onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
      >
        ⋯
      </Button>
    </div>
  )

  // Exercise menu (SPEC §5.2): replace or skip; undo either until the session is finished.
  const menu = menuOpen && (
    <div className="exercise-menu">
      {replacing ? (
        <form className="replace-form" onSubmit={confirmReplace}>
          <p className="note">{VOLUME_ONLY_NOTICE}</p>
          <Field label={<>Replace {config.name} with</>}>
            <input
              autoFocus
              value={substituteName}
              placeholder="e.g. Machine chest press"
              onChange={(e) => setSubstituteName(e.target.value)}
            />
          </Field>
          <div className="actions">
            <Button type="submit" variant="primary" disabled={!substituteName.trim()}>
              Replace
            </Button>
            <Button onClick={closeMenu}>Cancel</Button>
          </div>
        </form>
      ) : (
        <div className="actions">
          {log.skipped ? (
            <Button onClick={() => void restore()}>Restore</Button>
          ) : (
            <>
              {substitute ? (
                <Button onClick={() => void undo()}>Undo replace</Button>
              ) : (
                <Button onClick={() => setReplacing(true)}>Replace…</Button>
              )}
              <Button variant="danger" onClick={() => void skip()}>
                Skip today
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  )

  if (log.skipped) {
    return (
      <Card className="skipped">
        {header}
        {menu}
      </Card>
    )
  }

  if (substitute) {
    return (
      <Card>
        {header}
        {menu}
        <p className="muted">Volume only: not used for {config.name} estimates or progression.</p>
        {sets.length > 0 && <p className="muted">Logged before replacing: {formatSets(sets, effortScale)}</p>}
        <SetEditor
          key="substitute"
          sets={substitute.sets}
          targetSets={config.sets}
          effortScale={effortScale}
          rpeRequiredAt={() => false}
          step={(w, dir) => Math.max(0, (Number.isFinite(w) ? w : 0) + dir * SUBSTITUTE_STEP)}
          minWeight={0}
          weightLabel="Weight (lb)"
          repsLabel={<>Reps{config.unilateral && <span className="muted"> · per side</span>}</>}
          onSave={(next) => saveSubstituteSets(sessionId, config.id, next)}
        />
      </Card>
    )
  }

  const loads = availableLoads(config)
  // Validation runs once the last set is entered (SPEC §5.2, §6.6).
  const outcome = sets.length >= targetSets ? evaluateSession(config, history, sets) : undefined

  return (
    <Card>
      {header}
      {menu}
      <SetEditor
        key="original"
        sets={sets}
        targetSets={targetSets}
        first={suggestion.kind === 'suggestion' ? suggestion : undefined}
        effortScale={effortScale}
        rpeRequiredAt={(i) => rpeRequired(config.tier, i)}
        step={(w, dir) =>
          loads.length === 0 ? undefined : dir === 1 ? stepUp(w, loads) : stepDown(w, loads)
        }
        // Bodyweight loads are added weight, so 0 is valid there (SPEC §6.1).
        minWeight={config.equipment === 'bodyweight' ? 0 : Number.MIN_VALUE}
        weightLabel={
          <>
            {config.equipment === 'bodyweight' ? 'Added weight (lb)' : 'Weight (lb)'}
            {config.equipment === 'dumbbell' && <span className="muted"> · per hand</span>}
          </>
        }
        repsLabel={<>Reps{config.unilateral && <span className="muted"> · per side</span>}</>}
        footer={
          outcome?.message && (
            <p className="note warning" role="status">
              {outcome.message}
            </p>
          )
        }
        onSave={(next) => saveSets(sessionId, config.id, next)}
      />
    </Card>
  )
}
