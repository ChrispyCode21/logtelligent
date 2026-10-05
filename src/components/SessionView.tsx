import { availableLoads, suggestNext } from '../engine'
import { findExercise } from '../program/program'
import type { Program } from '../program/types'
import { canFinish, loggedSets } from '../session/sets'
import { warmupText } from '../session/warmup'
import type { Session } from '../storage/db'
import { exerciseHistory } from '../storage/history'
import { discardSession, dismissWarmup, finishSession } from '../storage/sessions'
import { Button } from '../ui/Button'
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

  // Skipped exercises don't count toward the total; substitutes count their own sets.
  const counted = exercises.filter((e) => !e.log.skipped)
  const logged = counted.reduce((n, e) => n + loggedSets(e.log).length, 0)
  const target = counted.reduce(
    (n, e) =>
      n + (e.suggestion.kind === 'suggestion' && !e.log.substitute ? e.suggestion.sets : e.config.sets),
    0,
  )
  const finishable = canFinish(session.exercises, (id) => findExercise(program, id)?.tier)

  // Warm-up ramps to the first exercise still being done as planned (SPEC §5.2).
  const first = exercises.find((e) => !e.log.skipped && !e.log.substitute)
  const warmup =
    first && first.suggestion.kind === 'suggestion'
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

  return (
    <>
      <h2 className="page-title">{dayName}</h2>
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
        />
      ))}
      <div className="actions">
        <Button variant="primary" disabled={!finishable} onClick={finish}>
          Finish session
        </Button>
        <Button variant="danger" onClick={discard}>
          Discard
        </Button>
      </div>
    </>
  )
}
