import { availableLoads } from '../engine'
import { findExercise } from '../program/program'
import type { Program } from '../program/types'
import { sessionExercises } from '../session/context'
import { canFinish, hasAnySets, setTally, targetSets } from '../session/sets'
import { warmupText } from '../session/warmup'
import type { ExerciseLog, Session } from '../session/types'
import { discardSession, dismissWarmup, finishSession } from '../storage/sessions'
import { Button } from '../ui/Button'
import { formatDate } from '../ui/format'
import { ExerciseLogger } from './ExerciseLogger'

interface Props {
  session: Session
  program: Program
  sessions: Session[]
  /** Now, for a live session. A finished one is judged as of when it started. */
  asOf?: Date
  /** Leave the editor of a finished session (SPEC §9.2, slice 1). */
  onClose?: () => void
}

/** A live session, or a finished one being edited. */
export function SessionView({ session, program, sessions, asOf, onClose }: Props) {
  const finished = session.finishedAt !== undefined
  const dayName = program.days.find((d) => d.id === session.dayId)?.name ?? 'Session'
  const exercises = sessionExercises(session, program, sessions, asOf)

  const { logged, target } = setTally(
    exercises.map((e) => ({ log: e.log, target: targetSets(e.log, e.config.sets, e.suggestion) })),
  )
  const finishable = canFinish(session.exercises, (id) => findExercise(program, id)?.tier)

  // Warm-up ramps to the first exercise still being done as planned (SPEC §5.2).
  const first = exercises.find((e) => !e.log.skipped && !e.log.substitute)
  const warmup =
    !finished && first && first.suggestion.kind === 'suggestion'
      ? warmupText(first.config.name, first.suggestion.weight, availableLoads(first.config))
      : undefined

  async function finish() {
    // Short sessions are treated as normal once confirmed (SPEC §5.2).
    if (logged < target && !confirm(`Only ${logged} of ${target} sets logged. Finish anyway?`)) return
    await finishSession(session.id)
  }

  async function discard() {
    if (confirm('Discard this session? Its logged sets will be deleted.')) {
      await discardSession(session.id)
    }
  }

  async function deleteFinished() {
    const message = `Delete ${dayName} on ${formatDate(session.startedAt)}? The sets logged for every exercise in it will be deleted, not just this one.`
    if (!confirm(message)) return
    await discardSession(session.id)
    onClose?.()
  }

  // An emptied finished session would drop out of History but still count for the rotation, so
  // deleting its last set offers to delete it (SPEC §9.2, slice 1).
  async function afterSave(saved: ExerciseLog) {
    if (!finished) return
    const logs = session.exercises.map((l) => (l.exerciseId === saved.exerciseId ? saved : l))
    if (hasAnySets(logs)) return
    if (
      !confirm(
        `That was the last set. Delete the whole ${dayName} session on ${formatDate(session.startedAt)}?`,
      )
    )
      return
    await discardSession(session.id)
    onClose?.()
  }

  return (
    <>
      <h2 className="page-title">{finished ? `${dayName} · ${formatDate(session.startedAt)}` : dayName}</h2>
      {warmup && !session.warmupDismissed && (
        <div className="note warmup" role="note">
          <p>{warmup}</p>
          <Button aria-label="Dismiss warm-up" onClick={() => void dismissWarmup(session.id)}>
            ✕
          </Button>
        </div>
      )}
      {exercises.map(({ log, config, history, suggestion }) => (
        <ExerciseLogger
          key={config.id}
          sessionId={session.id}
          config={config}
          log={log}
          history={history}
          suggestion={suggestion}
          effortScale={program.effortScale}
          finished={finished}
          onLogSaved={(saved) => void afterSave(saved)}
        />
      ))}
      <div className="actions">
        {finished ? (
          <>
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
            <Button variant="danger" onClick={() => void deleteFinished()}>
              Delete session
            </Button>
          </>
        ) : (
          <>
            <Button variant="primary" disabled={!finishable} onClick={finish}>
              Finish session
            </Button>
            <Button variant="danger" onClick={discard}>
              Discard
            </Button>
          </>
        )}
      </div>
    </>
  )
}
