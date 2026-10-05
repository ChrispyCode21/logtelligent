import { useState } from 'react'
import { exerciseTimeline } from '../history/timeline'
import type { Program, ProgramExercise } from '../program/types'
import type { Session } from '../session/types'
import { exerciseHasHistory, exerciseHistory } from '../history/sessions'
import { Card } from '../ui/Card'
import { Field } from '../ui/Field'
import { formatDate, formatE1rm, formatSets } from '../ui/format'
import { E1rmChart } from './E1rmChart'

interface Props {
  program: Program
  sessions: Session[]
}

export function HistoryView({ program, sessions }: Props) {
  // Active exercises grouped by day, then archived ones that have history (SPEC §5.3).
  const groups = program.days
    .filter((d) => !d.archived)
    .map((d) => ({ label: d.name, exercises: d.exercises.filter((e) => !e.archived) }))
  const archived = program.days
    .flatMap((d) => d.exercises.filter((e) => d.archived || e.archived))
    .filter((e) => exerciseHasHistory(sessions, e.id))
  if (archived.length > 0) groups.push({ label: 'Archived', exercises: archived })

  const all = groups.flatMap((g) => g.exercises)
  const [selectedId, setSelectedId] = useState<string>()
  const exercise: ProgramExercise | undefined = all.find((e) => e.id === selectedId) ?? all[0]

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
          {groups
            .filter((g) => g.exercises.length > 0)
            .map((g) => (
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
              <Card as="li" key={entry.date} className="history-row">
                <div className="history-head">
                  <strong>{formatDate(entry.date)}</strong>
                  {entry.isDeload && <span className="tag">Deload</span>}
                  {entry.e1rm !== undefined && <span className="muted">e1RM {formatE1rm(entry.e1rm)}</span>}
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
