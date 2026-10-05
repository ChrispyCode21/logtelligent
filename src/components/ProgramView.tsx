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
import { effortTarget, type EffortScale } from '../program/effort'
import type { BankExercise } from '../program/bank'
import type { Program, ProgramExercise } from '../program/types'
import type { Session } from '../session/types'
import { dayHasHistory, exerciseHasHistory } from '../storage/history'
import { updateProgram } from '../storage/program'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Field } from '../ui/Field'
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

function summary(e: ProgramExercise, scale: EffortScale) {
  const { min, max } = e.repRange
  const rpe = e.tier === 'primary' ? effortTarget(scale, e.targetRpe) : ''
  return `${e.tier === 'primary' ? 'Primary' : 'Accessory'} · ${e.sets} × ${min}–${max}${rpe} · ${e.equipment}`
}

function removalMessage(name: string, hasHistory: boolean) {
  return hasHistory
    ? `Remove ${name}? It has logged sessions, so it will be archived and its history kept.`
    : `Delete ${name}?`
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

  const save = (edit: (p: Program) => Program) => void updateProgram(edit)

  function submitDay(e: React.FormEvent) {
    e.preventDefault()
    const name = newDayName.trim()
    if (!name) return
    save((p) => addDay(p, { id: crypto.randomUUID(), name, exercises: [] }))
    setNewDayName('')
  }

  function saveExercise(dayId: string, exercise: ProgramExercise) {
    const exists = program.days.some((d) => d.exercises.some((e) => e.id === exercise.id))
    save((p) => (exists ? updateExercise(p, exercise) : addExercise(p, dayId, exercise)))
    setEditing(null)
  }

  function removeDayConfirmed(dayId: string, name: string) {
    const hasHistory = dayHasHistory(sessions, dayId)
    if (confirm(removalMessage(name, hasHistory))) save((p) => removeDay(p, dayId, hasHistory))
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
            <div className="icon-buttons">
              <Button
                aria-label={`Move ${day.name} up`}
                disabled={dayIndex === 0}
                onClick={() => save((p) => moveDay(p, day.id, -1))}
              >
                ↑
              </Button>
              <Button
                aria-label={`Move ${day.name} down`}
                disabled={dayIndex === days.length - 1}
                onClick={() => save((p) => moveDay(p, day.id, 1))}
              >
                ↓
              </Button>
              <Button
                variant="danger"
                aria-label={`Remove ${day.name}`}
                onClick={() => removeDayConfirmed(day.id, day.name)}
              >
                ✕
              </Button>
            </div>
          </div>

          <ol className="exercise-list">
            {day.exercises.map((exercise, i) =>
              editing?.dayId === day.id && editing.exerciseId === exercise.id ? (
                <li key={exercise.id}>
                  <ExerciseForm
                    initial={exercise}
                    effortScale={program.effortScale}
                    onSave={(e) => saveExercise(day.id, e)}
                    onCancel={() => setEditing(null)}
                  />
                </li>
              ) : (
                <li key={exercise.id} className="exercise-row">
                  <Button
                    className="exercise-summary"
                    onClick={() => setEditing({ dayId: day.id, exerciseId: exercise.id })}
                  >
                    <strong>{exercise.name}</strong>
                    <span className="muted">{summary(exercise, program.effortScale)}</span>
                    {!exercise.seed && <span className="warning-text">Needs starting numbers</span>}
                  </Button>
                  <div className="icon-buttons">
                    <Button
                      aria-label={`Move ${exercise.name} up`}
                      disabled={i === 0}
                      onClick={() => save((p) => moveExercise(p, day.id, exercise.id, -1))}
                    >
                      ↑
                    </Button>
                    <Button
                      aria-label={`Move ${exercise.name} down`}
                      disabled={i === day.exercises.length - 1}
                      onClick={() => save((p) => moveExercise(p, day.id, exercise.id, 1))}
                    >
                      ↓
                    </Button>
                    <Button
                      variant="danger"
                      aria-label={`Remove ${exercise.name}`}
                      onClick={() => removeExerciseConfirmed(exercise)}
                    >
                      ✕
                    </Button>
                  </div>
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
                effortScale={program.effortScale}
                onSave={(e) => saveExercise(day.id, e)}
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
