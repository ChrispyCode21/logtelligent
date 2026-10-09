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
import {
  allSetsLogged,
  rpeRequired,
  shownTarget,
  showsOutcome,
  substituteStep,
  targetSets,
} from '../session/sets'
import type { ExerciseLog } from '../session/types'
import { saveSets, saveSubstituteSets } from '../storage/sessions'
import { Card } from '../ui/Card'
import { formatSetCount, formatSetsWithExtras } from '../ui/format'
import { ExerciseMenu } from './ExerciseMenu'
import { SetEditor } from './SetEditor'

interface Props {
  sessionId: number
  config: ExerciseConfig
  log: ExerciseLog
  /** Finished history for this exercise. */
  history: ExerciseSession[]
  suggestion: Suggestion
  effortScale: EffortScale
  /** Editing a finished session: logged sets only, no new sets and no menu (SPEC §9.2, slice 1). */
  finished?: boolean
  /** After sets are saved, with the log as it now is. */
  onLogSaved?: (log: ExerciseLog) => void
}

export function ExerciseLogger({
  sessionId,
  config,
  log,
  history,
  suggestion,
  effortScale,
  finished = false,
  onLogSaved,
}: Props) {
  const target = targetSets(log, config.sets, suggestion)
  const substitute = log.substitute
  const sets = log.sets
  // The sets the editor logs to: the substitute's once replaced. A new set until today's are in, then extras.
  const allLogged = allSetsLogged(substitute ? substitute.sets : sets, target)
  const canAdd = !finished && !allLogged
  const canAddExtra = !finished && allLogged

  const heading = (
    <h2>
      {config.name}
      {substitute ? (
        <span className="muted"> → {substitute.name}</span>
      ) : log.skipped ? (
        <span className="muted">{finished ? ' · skipped' : ' · skipped today'}</span>
      ) : (
        <span className="muted"> · {formatSetCount(sets, shownTarget(log, finished, target))}</span>
      )}
      {!substitute && !log.skipped && suggestion.kind === 'suggestion' && suggestion.plan === 'deload' && (
        <span className="tag">Deload</span>
      )}
    </h2>
  )

  // A finished session has no menu (SPEC §9.2, slice 1).
  const header = finished ? (
    <div className="logger-head">{heading}</div>
  ) : (
    <ExerciseMenu sessionId={sessionId} config={config} log={log}>
      {heading}
    </ExerciseMenu>
  )

  if (log.skipped) {
    return <Card className="skipped">{header}</Card>
  }

  if (substitute) {
    return (
      <Card>
        {header}
        <p className="muted">Volume only: not used for {config.name} estimates or progression.</p>
        {sets.length > 0 && (
          <p className="muted">Logged before replacing: {formatSetsWithExtras(sets, effortScale)}</p>
        )}
        <SetEditor
          key="substitute"
          sets={substitute.sets}
          canAdd={canAdd}
          canAddExtra={canAddExtra}
          effortScale={effortScale}
          rpeRequiredAt={() => false}
          step={substituteStep}
          allowZeroWeight
          weightLabel="Weight (lb)"
          repsLabel={<>Reps{config.unilateral && <span className="muted"> · per side</span>}</>}
          onSave={async (next) => {
            await saveSubstituteSets(sessionId, config.id, next)
            onLogSaved?.({ ...log, substitute: { ...substitute, sets: next } })
          }}
        />
      </Card>
    )
  }

  const loads = availableLoads(config)
  // Validation runs once the last set is entered; a finished session always shows its outcome (SPEC §5.2, §6.6, §9.2).
  const outcome = showsOutcome(finished, sets, target) ? evaluateSession(config, history, sets) : undefined

  return (
    <Card>
      {header}
      <SetEditor
        key="original"
        sets={sets}
        canAdd={canAdd}
        canAddExtra={canAddExtra}
        first={suggestion.kind === 'suggestion' ? suggestion : undefined}
        effortScale={effortScale}
        rpeRequiredAt={(i) => rpeRequired(config.tier, i)}
        step={(w, dir) =>
          loads.length === 0 ? undefined : dir === 1 ? stepUp(w, loads) : stepDown(w, loads)
        }
        // Bodyweight loads are added weight, so 0 is valid there (SPEC §6.1).
        allowZeroWeight={config.equipment === 'bodyweight'}
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
        onSave={async (next) => {
          await saveSets(sessionId, config.id, next)
          onLogSaved?.({ ...log, sets: next })
        }}
      />
    </Card>
  )
}
