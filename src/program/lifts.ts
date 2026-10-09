import type { Program, ProgramExercise } from './types'

// Lifts (SPEC §9.4 slice 2): exercises with the same name are one lift, wherever they are in the
// program. Nothing is stored for it: sessions belong to exercises, so a rename moves them with it.

/** A name as a lift: lower case, punctuation and spacing ignored ("bench-press" = "Bench  Press"). */
export function liftKey(name: string): string {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join(' ')
}

/** Every exercise in the program with this name, archived or not, in program order. */
export function liftExercises(program: Program, name: string): ProgramExercise[] {
  const key = liftKey(name)
  return program.days.flatMap((d) => d.exercises).filter((e) => liftKey(e.name) === key)
}
