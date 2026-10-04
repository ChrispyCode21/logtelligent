import { useState } from 'react'
import type { LoggedSet } from '../engine'
import { exerciseTimeline } from '../history/timeline'
import type { Program, ProgramExercise } from '../program/types'
import type { Session } from '../storage/db'
import { exerciseHasHistory, exerciseHistory } from '../storage/history'
import { E1rmChart } from './E1rmChart'

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

const formatSet = (set: LoggedSet) =>
  `${set.weight} × ${set.reps}${set.rpe !== undefined ? ` @ ${set.rpe}` : ''}`

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
      <section className="card">
        <h2>No exercises yet</h2>
        <p>History shows up here once your program has exercises.</p>
      </section>
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
      <label className="field">
        <span className="muted">Exercise</span>
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
      </label>

      {timeline.length === 0 ? (
        <p className="muted">No sessions logged yet.</p>
      ) : (
        <>
          {exercise.tier === 'primary' && points.length >= 2 && (
            <section className="card">
              <E1rmChart points={points} />
            </section>
          )}
          <ol className="history-list">
            {timeline.map((entry) => (
              <li key={entry.date} className="card history-row">
                <div className="history-head">
                  <strong>{formatDate(entry.date)}</strong>
                  {entry.isDeload && <span className="tag">Deload</span>}
                  {entry.e1rm !== undefined && <span className="muted">e1RM {entry.e1rm.toFixed(1)} lb</span>}
                </div>
                {entry.substitute ? (
                  <>
                    <p>
                      <span className="muted">Replaced with </span>
                      {entry.substitute.name}
                      {entry.substitute.sets.length > 0 &&
                        `: ${entry.substitute.sets.map(formatSet).join(' · ')}`}
                    </p>
                    {entry.sets.length > 0 && (
                      <p className="muted">Before replacing: {entry.sets.map(formatSet).join(' · ')}</p>
                    )}
                  </>
                ) : (
                  <p>
                    {entry.sets.map(formatSet).join(' · ')}
                    {exercise.unilateral && <span className="muted"> (per side)</span>}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  )
}
