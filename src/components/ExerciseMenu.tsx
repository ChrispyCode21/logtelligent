import { useState, type ReactNode } from 'react'
import type { ExerciseConfig } from '../engine'
import type { ExerciseLog } from '../session/types'
import { replaceExercise, restoreExercise, skipExercise, undoReplace } from '../storage/sessions'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'

const VOLUME_ONLY_NOTICE = 'This will be tracked as volume only and not used for estimates.'

interface Props {
  sessionId: number
  config: ExerciseConfig
  log: ExerciseLog
  /** The exercise's heading, shown beside the ⋯ button. */
  children: ReactNode
}

/**
 * Exercise menu (SPEC §5.2): replace or skip; undo either until the session is finished.
 * Renders the heading row with the ⋯ button, and the open menu below it.
 */
export function ExerciseMenu({ sessionId, config, log, children }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [replacing, setReplacing] = useState(false)
  const [substituteName, setSubstituteName] = useState('')

  const substitute = log.substitute

  function closeMenu() {
    setMenuOpen(false)
    setReplacing(false)
  }

  async function confirmReplace(e: React.FormEvent) {
    e.preventDefault()
    const name = substituteName.trim()
    if (!name) return
    await replaceExercise(sessionId, config.id, name)
    setSubstituteName('')
    closeMenu()
  }

  async function undo() {
    const count = substitute?.sets.length ?? 0
    const message = `Undo the replace? The ${count} set${count === 1 ? '' : 's'} logged for ${substitute?.name} will be discarded.`
    if (count === 0 || confirm(message)) await undoReplace(sessionId, config.id)
    closeMenu()
  }

  async function skip() {
    const count = log.sets.length + (substitute?.sets.length ?? 0)
    const message = `Skip ${config.name} today? The ${count} set${count === 1 ? '' : 's'} logged for it will be discarded.`
    if (count === 0 || confirm(message)) await skipExercise(sessionId, config.id)
    closeMenu()
  }

  async function restore() {
    await restoreExercise(sessionId, config.id)
    closeMenu()
  }

  return (
    <>
      <div className="logger-head">
        {children}
        <Button
          className="menu-button"
          aria-label={`Options for ${config.name}`}
          aria-expanded={menuOpen}
          onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
        >
          ⋯
        </Button>
      </div>
      {menuOpen && (
        <div className="exercise-menu">
          {replacing ? (
            <form className="replace-form" onSubmit={confirmReplace}>
              <p className="note">{VOLUME_ONLY_NOTICE}</p>
              <Field label={<>Replace {config.name} with</>}>
                <input
                  autoFocus
                  value={substituteName}
                  placeholder="e.g. Machine chest press"
                  onChange={(e) => setSubstituteName(e.target.value)}
                />
              </Field>
              <div className="actions">
                <Button type="submit" variant="primary" disabled={!substituteName.trim()}>
                  Replace
                </Button>
                <Button onClick={closeMenu}>Cancel</Button>
              </div>
            </form>
          ) : (
            <div className="actions">
              {log.skipped ? (
                <Button onClick={() => void restore()}>Restore</Button>
              ) : (
                <>
                  {substitute ? (
                    <Button onClick={() => void undo()}>Undo replace</Button>
                  ) : (
                    <Button onClick={() => setReplacing(true)}>Replace…</Button>
                  )}
                  <Button variant="danger" onClick={() => void skip()}>
                    Skip today
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </>
  )
}
