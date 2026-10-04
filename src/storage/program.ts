import { EMPTY_PROGRAM } from '../program/program'
import type { Program } from '../program/types'
import { db } from './db'

/**
 * Apply an edit to the stored program. Reading and writing inside one transaction
 * means quick successive edits each see the previous one, instead of all starting
 * from whatever copy the UI last rendered.
 */
export async function updateProgram(edit: (program: Program) => Program) {
  await db.transaction('rw', db.programs, async () => {
    const program = (await db.programs.get('main')) ?? EMPTY_PROGRAM
    await db.programs.put(edit(program))
  })
}
