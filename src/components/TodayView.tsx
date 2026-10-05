import { useState } from 'react'
import { nextDay, suggestNext } from '../engine'
import { activeDays, missingSeeds } from '../program/program'
import type { Program } from '../program/types'
import type { Session } from '../session/types'
import { exerciseHistory, lastLoggedDayId } from '../history/sessions'
import { startSession } from '../storage/sessions'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Field } from '../ui/Field'
import { SeedWalkthrough } from './SeedWalkthrough'
import { SessionView } from './SessionView'
import { SuggestionCard } from './SuggestionCard'

interface Props {
  program: Program
  sessions: Session[]
  asOf: Date
  /** The guided seed walkthrough is open. */
  seeding: boolean
  onSeeding: (open: boolean) => void
  onEditProgram: () => void
}

export function TodayView({ program, sessions, asOf, seeding, onSeeding, onEditProgram }: Props) {
  const [chosenDayId, setChosenDayId] = useState<string>()

  const active = sessions.find((s) => !s.finishedAt)
  if (active) {
    return <SessionView session={active} program={program} sessions={sessions} asOf={asOf} />
  }

  const days = activeDays(program).filter((d) => d.exercises.length > 0)
  if (days.length === 0) {
    return (
      <Card>
        <h2>No program yet</h2>
        <p>Pick a ready-made program, or add your own training days and exercises.</p>
        <Button variant="primary" block onClick={onEditProgram}>
          Set up program
        </Button>
      </Card>
    )
  }

  // Sessions can't start until every exercise has starting numbers (SPEC §5.1, A12).
  const unseeded = missingSeeds(program)
  if (unseeded.length > 0) {
    if (seeding) return <SeedWalkthrough program={program} onClose={() => onSeeding(false)} />
    const which =
      unseeded.length <= 3 ? unseeded.map((e) => e.name).join(', ') : `${unseeded.length} exercises`
    return (
      <Card>
        <h2>Starting numbers needed</h2>
        <p>
          {which} {unseeded.length === 1 ? 'needs' : 'need'} starting numbers before you can start a session.
        </p>
        <div className="actions">
          <Button variant="primary" onClick={() => onSeeding(true)}>
            Enter starting numbers
          </Button>
          <Button onClick={onEditProgram}>Edit program</Button>
        </div>
      </Card>
    )
  }

  const next = nextDay(days, lastLoggedDayId(sessions))!
  const day = days.find((d) => d.id === chosenDayId) ?? next
  const outOfRotation = day.id !== next.id

  // Choosing a different day needs an explicit acknowledgement (SPEC §5.2).
  function chooseDay(dayId: string) {
    if (dayId === next.id) return setChosenDayId(undefined)
    const chosen = days.find((d) => d.id === dayId)!
    const ok = confirm(
      `${chosen.name} isn't next in the rotation (${next.name} is). ` +
        `If you log it, the rotation continues from ${chosen.name}. Switch?`,
    )
    if (ok) setChosenDayId(dayId)
  }

  return (
    <>
      <div className="day-header">
        <h2 className="page-title">{day.name}</h2>
        <p className="muted">
          {outOfRotation ? `Out of rotation (next is ${next.name})` : 'Next in rotation'}
        </p>
      </div>

      {day.exercises.map((exercise) => (
        <SuggestionCard
          key={exercise.id}
          config={exercise}
          suggestion={suggestNext(exercise, exerciseHistory(sessions, exercise.id), asOf)}
          heading={exercise.name}
          effortScale={program.effortScale}
        />
      ))}

      <Button
        variant="primary"
        block
        onClick={() => {
          // The override applies to this session only; afterward the rotation decides.
          setChosenDayId(undefined)
          void startSession(
            day.id,
            day.exercises.map((e) => e.id),
          )
        }}
      >
        Start {day.name}
      </Button>

      {days.length > 1 && (
        <Field label={<span className="muted">Do a different day</span>}>
          <select value={day.id} onChange={(e) => chooseDay(e.target.value)}>
            {days.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.id === next.id ? ' (next)' : ''}
              </option>
            ))}
          </select>
        </Field>
      )}
    </>
  )
}
