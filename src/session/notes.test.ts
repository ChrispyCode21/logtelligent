import { describe, expect, it } from 'vitest'
import { finishConfirmMessage, NOTE_MAX, normalizeNote } from './notes'

describe('session notes (SPEC §9.2, slice 3)', () => {
  it('stores a note trimmed, and whitespace as no note', () => {
    expect(normalizeNote('  shoulder felt tight \n')).toBe('shoulder felt tight')
    expect(normalizeNote('   ')).toBeUndefined()
    expect(normalizeNote('')).toBeUndefined()
  })

  it('keeps at most 200 characters', () => {
    expect(normalizeNote('x'.repeat(250))).toHaveLength(NOTE_MAX)
  })

  it('asks before a short Finish, nudging for a note when there is none', () => {
    expect(finishConfirmMessage(4, 8, true)).toBe('Only 4 of 8 sets logged. Finish anyway?')
    expect(finishConfirmMessage(4, 8, false)).toBe(
      'Only 4 of 8 sets logged. Finish anyway? (No note for next time.)',
    )
  })

  it('asks nothing when every set is logged, note or not', () => {
    expect(finishConfirmMessage(8, 8, false)).toBeUndefined()
  })
})
