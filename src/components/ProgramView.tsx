import { useState } from 'react'
import {
  activeDays,
  addDay,
  addExercise,
  moveDay,
  moveExercise,
  removeDay,
  removeExercise,
  renameDay,
  updateExercise,
} from '../program/program'
import type { BankExercise } from '../program/bank'
import type { Program, ProgramExercise } from '../program/types'
import type { Session } from '../session/types'
import { latestInLift, needsStartingNumbers } from '../history/lifts'
import { dayHasHistory, emptyOpenSessions, exerciseHasHistory } from '../history/sessions'
import { updateProgram } from '../storage/program'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Field } from '../ui/Field'
import { formatPrescription } from '../ui/format'
import { BackupCard } from './BackupCard'
import { EffortScaleCard } from './EffortScaleCard'
import { ExerciseForm } from './ExerciseForm'
import { ExercisePicker } from './ExercisePicker'
import { TemplateCard } from './TemplateCard'

interface Editing {
  dayId: string
  /** Undefined when adding a new exercise. */
  exerciseId?: string
  /** Adding: what was picked from the bank, or 'custom'. Undefined while the picker is open. */
  preset?: BankExercise | 'custom'
}

function removalMessage(name: string, hasHistory: boolean) {
  return hasHistory
    ? `Remove ${name}? It has logged sessions, so it will be archived and its history kept.`
    : `Delete ${name}?`
}

interface RowActionsProps {
  name: string
  first: boolean
  last: boolean
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
}

/** Move up, move down and remove, for a day or an exercise. */
function RowActions({ name, first, last, onMove, onRemove }: RowActionsProps) {
  return (
    <div className="icon-buttons">
      <Button aria-label={`Move ${name} up`} disabled={first} onClick={() => onMove(-1)}>
        ↑
      </Button>
      <Button aria-label={`Move ${name} down`} disabled={last} onClick={() => onMove(1)}>
        ↓
      </Button>
      <Button variant="danger" aria-label={`Remove ${name}`} onClick={onRemove}>
        ✕
      </Button>
    </div>
  )
}

interface Props {
  program: Program
  sessions: Session[]
  onTemplateApplied: () => void
}

export function ProgramView({ program, sessions, onTemplateApplied }: Props) {
  const [editing, setEditing] = useState<Editing | null>(null)
  const [newDayName, setNewDayName] = useState('')
  const days = activeDays(program)
  const unseeded = new Set(needsStartingNumbers(program, sessions).map((e) => e.id))

  const save = (edit: (p: Program) => Program) => void updateProgram(edit)

  function submitDay(e: React.FormEvent) {
    e.preventDefault()
    const name = newDayName.trim()
    if (!name) return
    save((p) => addDay(p, { id: crypto.randomUUID(), name, exercises: [] }))
    setNewDayName('')
  }

  function saveExercise(edit: (p: Program) => Program) {
    save(edit)
    setEditing(null)
  }

  function removeDayConfirmed(dayId: string, name: string) {
    const hasHistory = dayHasHistory(sessions, dayId)
    // An open session on this day with nothing logged goes with it (SPEC §9.4 slice 0).
    const discard = emptyOpenSessions(sessions, [dayId])
    const message =
      removalMessage(name, hasHistory) +
      (discard.length > 0 ? ' Its open session has nothing logged yet, so it will be discarded too.' : '')
    if (confirm(message)) {
      void updateProgram(
        (p) => removeDay(p, dayId, hasHistory),
        discard.map((s) => s.id),
      )
    }
  }

  function removeExerciseConfirmed(exercise: ProgramExercise) {
    const hasHistory = exerciseHasHistory(sessions, exercise.id)
    if (confirm(removalMessage(exercise.name, hasHistory))) {
      save((p) => removeExercise(p, exercise.id, hasHistory))
    }
  }

  return (
    <>
      <h2 className="page-title">Program</h2>
      <EffortScaleCard value={program.effortScale} />
      {days.length === 0 && (
        <TemplateCard program={program} sessions={sessions} onApplied={onTemplateApplied} />
      )}
      <p className="muted">Training days run in this order, then repeat.</p>

      {days.map((day, dayIndex) => (
        <Card key={day.id} className="day">
          <div className="day-title">
            <input
              key={day.name}
              className="day-name"
              aria-label="Day name"
              defaultValue={day.name}
              onBlur={(e) => {
                const name = e.target.value.trim()
                if (name && name !== day.name) save((p) => renameDay(p, day.id, name))
              }}
            />
            <RowActions
              name={day.name}
              first={dayIndex === 0}
              last={dayIndex === days.length - 1}
              onMove={(direction) => save((p) => moveDay(p, day.id, direction))}
              onRemove={() => removeDayConfirmed(day.id, day.name)}
            />
          </div>

          <ol className="exercise-list">
            {day.exercises.map((exercise, i) =>
              editing?.dayId === day.id && editing.exerciseId === exercise.id ? (
                <li key={exercise.id}>
                  <ExerciseForm
                    initial={exercise}
                    effortScale={program.effortScale}
                    onSave={(e) => saveExercise((p) => updateExercise(p, e))}
                    onCancel={() => setEditing(null)}
                  />
                </li>
              ) : (
                <li key={exercise.id} className="exercise-row">
                  <Button
                    className="list-button exercise-summary"
                    onClick={() => setEditing({ dayId: day.id, exerciseId: exercise.id })}
                  >
                    <strong>{exercise.name}</strong>
                    <span className="muted">{formatPrescription(exercise, program.effortScale)}</span>
                    {unseeded.has(exercise.id) && (
                      <span className="warning-text">Needs starting numbers</span>
                    )}
                  </Button>
                  <RowActions
                    name={exercise.name}
                    first={i === 0}
                    last={i === day.exercises.length - 1}
                    onMove={(direction) => save((p) => moveExercise(p, day.id, exercise.id, direction))}
                    onRemove={() => removeExerciseConfirmed(exercise)}
                  />
                </li>
              ),
            )}
          </ol>

          {editing?.dayId === day.id && editing.exerciseId === undefined ? (
            editing.preset === undefined ? (
              <ExercisePicker
                onPick={(preset) => setEditing({ dayId: day.id, preset })}
                onCustom={() => setEditing({ dayId: day.id, preset: 'custom' })}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <ExerciseForm
                key={editing.preset === 'custom' ? 'custom' : editing.preset.id}
                preset={editing.preset === 'custom' ? undefined : editing.preset}
                lift={
                  editing.preset === 'custom'
                    ? undefined
                    : latestInLift(program, sessions, editing.preset.name)
                }
                effortScale={program.effortScale}
                onSave={(e) => saveExercise((p) => addExercise(p, day.id, e))}
                // Back to the picker, in case the wrong exercise was picked.
                onCancel={() => setEditing({ dayId: day.id })}
              />
            )
          ) : (
            <Button onClick={() => setEditing({ dayId: day.id })}>+ Add exercise</Button>
          )}
        </Card>
      ))}

      <Card as="form" className="add-day" onSubmit={submitDay}>
        <Field label="New training day">
          <input
            value={newDayName}
            placeholder={days.length === 0 ? 'e.g. Upper A' : ''}
            onChange={(e) => setNewDayName(e.target.value)}
          />
        </Field>
        <Button type="submit" disabled={!newDayName.trim()}>
          Add day
        </Button>
      </Card>

      {days.length > 0 && (
        <TemplateCard program={program} sessions={sessions} onApplied={onTemplateApplied} />
      )}
      <BackupCard />
    </>
  )
}
