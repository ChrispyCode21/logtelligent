import { suggestNext } from '../engine'
import { findExercise } from '../program/program'
import type { Program } from '../program/types'
import { canFinish } from '../session/sets'
import type { Session } from '../storage/db'
import { exerciseHistory } from '../storage/history'
import { discardSession, finishSession, saveSets } from '../storage/sessions'
import { ExerciseLogger } from './ExerciseLogger'

interface Props {
  session: Session
  program: Program
  sessions: Session[]
  asOf: Date
}

export function SessionView({ session, program, sessions, asOf }: Props) {
  const dayName = program.days.find((d) => d.id === session.dayId)?.name ?? 'Session'
  const exercises = session.exercises.flatMap((log) => {
    const config = findExercise(program, log.exerciseId)
    if (!config) return []
    const history = exerciseHistory(sessions, config.id)
    return [{ log, config, history, suggestion: suggestNext(config, history, asOf) }]
  })

  const logged = exercises.reduce((n, e) => n + e.log.sets.length, 0)
  const target = exercises.reduce(
    (n, e) => n + (e.suggestion.kind === 'suggestion' ? e.suggestion.sets : e.config.sets),
    0,
  )
  const finishable = canFinish(session.exercises, (id) => findExercise(program, id)?.tier)

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

  return (
    <>
      <h2 className="page-title">{dayName}</h2>
      {exercises.map(({ log, config, history, suggestion }) => (
        <ExerciseLogger
          key={config.id}
          config={config}
          sets={log.sets}
          history={history}
          suggestion={suggestion}
          onSave={(sets) => saveSets(session.id, config.id, sets)}
        />
      ))}
      <div className="actions">
        <button type="button" className="primary" disabled={!finishable} onClick={finish}>
          Finish session
        </button>
        <button type="button" className="danger" onClick={discard}>
          Discard
        </button>
      </div>
    </>
  )
}
