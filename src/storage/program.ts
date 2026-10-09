import { EMPTY_PROGRAM } from '../program/program'
import type { Program } from '../program/types'
import { db } from './db'

/**
 * Apply an edit to the stored program. Reading and writing inside one transaction
 * means quick successive edits each see the previous one, instead of all starting
 * from whatever copy the UI last rendered.
 *
 * `discardSessions` are deleted in the same transaction: open sessions with nothing logged, on days
 * the edit removes (SPEC §9.4 slice 0).
 */
export async function updateProgram(edit: (program: Program) => Program, discardSessions: number[] = []) {
  await db.transaction('rw', db.programs, db.sessions, async () => {
    const program = (await db.programs.get('main')) ?? EMPTY_PROGRAM
    await db.programs.put(edit(program))
    await db.sessions.bulkDelete(discardSessions)
  })
}
