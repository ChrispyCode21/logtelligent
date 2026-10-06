import { NOTE_COUNTER_FROM, NOTE_MAX } from '../session/notes'
import { Field } from '../ui/Field'

interface Props {
  value: string
  onChange: (value: string) => void
  /** Leaving the field saves the note. */
  onBlur: () => void
}

/** The note for next time (SPEC §9.2, slice 3): plain text, up to 200 characters. */
export function NoteField({ value, onChange, onBlur }: Props) {
  return (
    <Field label="Note for next time" hint="Optional. It shows when this day comes up again.">
      <textarea
        rows={2}
        maxLength={NOTE_MAX}
        value={value}
        placeholder="e.g. Shoulder felt tight; go lighter on presses."
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
      {value.length >= NOTE_COUNTER_FROM && (
        <span className="muted">
          {value.length}/{NOTE_MAX}
        </span>
      )}
    </Field>
  )
}
