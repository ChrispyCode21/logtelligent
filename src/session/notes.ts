// Session notes: a note for next time (SPEC §5.2).

export const NOTE_MAX = 200
/** The character counter shows from here on. */
export const NOTE_COUNTER_FROM = 160

/** A note as stored: trimmed and at most 200 characters; empty or whitespace-only is no note. */
export function normalizeNote(text: string): string | undefined {
  const note = text.trim().slice(0, NOTE_MAX).trimEnd()
  return note === '' ? undefined : note
}

/**
 * The Finish confirm, or undefined when Finish needs none: a short session asks first (SPEC §5.2),
 * and with no note it adds a nudge (SPEC §5.2).
 */
export function finishConfirmMessage(logged: number, target: number, hasNote: boolean): string | undefined {
  if (logged >= target) return undefined
  const base = `Only ${logged} of ${target} sets logged. Finish anyway?`
  return hasNote ? base : `${base} (No note for next time.)`
}
