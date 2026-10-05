import { useState } from 'react'
import { BODY_AREAS, searchBank, type BankExercise } from '../program/bank'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Field } from '../ui/Field'
import { formatPrescription } from '../ui/format'

interface Props {
  onPick: (exercise: BankExercise) => void
  onCustom: () => void
  onCancel: () => void
}

/** Choose an exercise from the bank by body area or search, or start a custom one (SPEC §9.1, slice 2). */
export function ExercisePicker({ onPick, onCustom, onCancel }: Props) {
  const [query, setQuery] = useState('')
  const results = searchBank(query)
  const searching = query.trim() !== ''

  return (
    <Card className="exercise-picker">
      <h3>Add exercise</h3>
      <Field label="Search">
        <input
          type="search"
          value={query}
          placeholder="e.g. squat, RDL, curl"
          onChange={(e) => setQuery(e.target.value)}
        />
      </Field>

      {BODY_AREAS.map((area) => {
        const exercises = results.filter((e) => e.area === area.id)
        if (exercises.length === 0) return null
        return (
          // Collapsed for browsing; a search opens every group that has a match.
          <details key={area.id} className="bank-area" open={searching}>
            <summary>
              {area.label} <span className="muted">({exercises.length})</span>
            </summary>
            <ul className="bank-list">
              {exercises.map((e) => (
                <li key={e.id}>
                  <Button className="list-button bank-item" onClick={() => onPick(e)}>
                    <strong>{e.name}</strong>
                    <span className="muted">{formatPrescription(e)}</span>
                  </Button>
                </li>
              ))}
            </ul>
          </details>
        )
      })}

      {searching && results.length === 0 && (
        <p className="muted">No matches. Add it as a custom exercise instead.</p>
      )}

      <div className="actions">
        <Button onClick={onCustom}>Custom exercise…</Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </Card>
  )
}
