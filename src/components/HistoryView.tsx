import { useState } from 'react'
import { exerciseTimeline } from '../history/timeline'
import type { Program, ProgramExercise } from '../program/types'
import type { Session } from '../session/types'
import { historyGroups } from '../history/picker'
import { exerciseHistory } from '../history/sessions'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Field } from '../ui/Field'
import { formatDate, formatE1rm, formatSets } from '../ui/format'
import { E1rmChart } from './E1rmChart'
import { SessionView } from './SessionView'

interface Props {
  program: Program
  sessions: Session[]
  asOf: Date
}

export function HistoryView({ program, sessions, asOf }: Props) {
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
        session={editing}
        program={program}
        sessions={sessions}
        asOf={asOf}
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

  const timeline = exerciseTimeline(exercise, exerciseHistory(sessions, exercise.id))
  const points = timeline
    .filter((t) => t.e1rm !== undefined)
    .map((t) => ({ date: t.date, value: t.e1rm! }))
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
          {exercise.tier === 'primary' && points.length >= 2 && (
            <Card>
              <E1rmChart points={points} />
            </Card>
          )}
          <ol className="history-list">
            {timeline.map((entry) => (
              <Card as="li" key={entry.sessionId} className="history-row">
                <div className="history-head">
                  <strong>{formatDate(entry.date)}</strong>
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
                      {entry.substitute.sets.length > 0 &&
                        `: ${formatSets(entry.substitute.sets, program.effortScale)}`}
                    </p>
                    {entry.sets.length > 0 && (
                      <p className="muted">Before replacing: {formatSets(entry.sets, program.effortScale)}</p>
                    )}
                  </>
                ) : (
                  <p>
                    {formatSets(entry.sets, program.effortScale)}
                    {exercise.unilateral && <span className="muted"> (per side)</span>}
                  </p>
                )}
              </Card>
            ))}
          </ol>
        </>
      )}
    </>
  )
}
