import { useState } from 'react'
import { countedSets, type LoggedSet } from '../engine'
import { liftTimeline } from '../history/timeline'
import type { Program, ProgramExercise } from '../program/types'
import type { Session } from '../session/types'
import { historyGroups } from '../history/picker'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Field } from '../ui/Field'
import { formatCountedSets, formatDate, formatE1rm, formatExtras, formatSetsWithExtras } from '../ui/format'
import { E1rmChart } from './E1rmChart'
import { SessionView } from './SessionView'

interface Props {
  program: Program
  sessions: Session[]
}

export function HistoryView({ program, sessions }: Props) {
  const groups = historyGroups(program, sessions)
  const all = groups.flatMap((g) => g.exercises)
  const [selectedId, setSelectedId] = useState<string>()
  const [editingId, setEditingId] = useState<number>()
  const exercise: ProgramExercise | undefined = all.find((e) => e.id === selectedId) ?? all[0]

  // Editing a finished session opens it whole (SPEC §9.2, slice 1). Once it's deleted, the list is back.
  const editing = sessions.find((s) => s.id === editingId)
  if (editing) {
    return (
      <SessionView
        key={editing.id}
        session={editing}
        program={program}
        sessions={sessions}
        onClose={() => setEditingId(undefined)}
      />
    )
  }

  if (!exercise) {
    return (
      <Card>
        <h2>No exercises yet</h2>
        <p>History shows up here once your program has exercises.</p>
      </Card>
    )
  }

  // Every session of the lift, on any day (SPEC §5.3, §9.4 slice 2).
  const timeline = liftTimeline(program, sessions, exercise.name)
  const points = timeline
    .filter((t) => t.e1rm !== undefined)
    .map((t) => ({ date: t.date, value: t.e1rm!, highReps: t.highReps }))
    .reverse()

  return (
    <>
      <h2 className="page-title">History</h2>
      <Field label={<span className="muted">Exercise</span>}>
        <select value={exercise.id} onChange={(e) => setSelectedId(e.target.value)}>
          {groups.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.exercises.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>

      {timeline.length === 0 ? (
        <p className="muted">No sessions logged yet.</p>
      ) : (
        <>
          {points.length >= 2 && (
            <Card>
              <E1rmChart points={points} />
            </Card>
          )}
          <ol className="history-list">
            {timeline.map((entry) => (
              <Card as="li" key={`${entry.sessionId}-${entry.exerciseId}`} className="history-row">
                <div className="history-head">
                  <strong>{formatDate(entry.date)}</strong>
                  {entry.dayName && <span className="muted">{entry.dayName}</span>}
                  {entry.isDeload && <span className="tag">Deload</span>}
                  {entry.e1rm !== undefined && <span className="muted">e1RM {formatE1rm(entry.e1rm)}</span>}
                  <Button
                    className="history-edit"
                    aria-label={`Edit the session on ${formatDate(entry.date)}`}
                    onClick={() => setEditingId(entry.sessionId)}
                  >
                    Edit
                  </Button>
                </div>
                {entry.substitute ? (
                  <>
                    <p>
                      <span className="muted">Replaced with </span>
                      {entry.substitute.name}
                      {countedSets(entry.substitute.sets).length > 0 &&
                        `: ${formatCountedSets(entry.substitute.sets, program.effortScale)}`}
                    </p>
                    <ExtraLine sets={entry.substitute.sets} />
                    {entry.sets.length > 0 && (
                      <p className="muted">
                        Before replacing: {formatSetsWithExtras(entry.sets, program.effortScale)}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    {countedSets(entry.sets).length > 0 && (
                      <p>
                        {formatCountedSets(entry.sets, program.effortScale)}
                        {entry.unilateral && <span className="muted"> (per side)</span>}
                      </p>
                    )}
                    <ExtraLine sets={entry.sets} />
                  </>
                )}
                {entry.note && <p className="muted">Note: {entry.note}</p>}
              </Card>
            ))}
          </ol>
        </>
      )}
    </>
  )
}

/** Extra sets on their own line (SPEC §9.2, slice 2). */
function ExtraLine({ sets }: { sets: LoggedSet[] }) {
  const extras = formatExtras(sets)
  return extras ? <p className="muted">{extras}</p> : null
}
