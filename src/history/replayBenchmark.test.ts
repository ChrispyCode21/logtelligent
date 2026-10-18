import { describe, expect, it } from 'vitest'
import { schemeId } from '../engine'
import { activeDays, EMPTY_PROGRAM } from '../program/program'
import { applyTemplate, TEMPLATES } from '../program/templates'
import type { Program } from '../program/types'
import { suggestFor } from './lifts'
import { syntheticHistory, syntheticProgram } from './synthetic'

// The replay benchmark (#113, ARCHITECTURE.md "Progression state is derived"): every suggestion
// replays the whole history, so this times a session's suggestions after years of training, for
// each scheme, against a limit. A later scheme adds a program that uses it to PROGRAMS.

/** One session's suggestions, every exercise in it, on CI hardware. */
const LIMIT_MS = 50
/** About 3 years, 4 sessions a week, with a week off every 13 weeks. */
const HISTORY = { weeks: 156, perWeek: 4, breakEvery: 13 }
/** Each day is timed this many times and its fastest run kept, to keep out GC and JIT warm-up. */
const RUNS = 5

const template = (id: string): Program => {
  const t = TEMPLATES.find((x) => x.id === id)
  if (!t) throw new Error(`No template ${id}`)
  return syntheticProgram(applyTemplate(EMPTY_PROGRAM, t))
}

/** A program for each scheme built so far, every exercise on it. */
const PROGRAMS = {
  adaptive: template('upper-lower-4'),
  linear: template('novice-ab-3'),
}

describe('replay benchmark', () => {
  for (const [scheme, program] of Object.entries(PROGRAMS)) {
    it(`${scheme}: a session's suggestions after 3 years take under ${LIMIT_MS} ms`, () => {
      expect(new Set(activeDays(program).flatMap((d) => d.exercises.map(schemeId)))).toEqual(
        new Set([scheme]),
      )
      const sessions = syntheticHistory(program, HISTORY)
      const asOf = new Date(Date.parse(sessions[sessions.length - 1].startedAt) + 2 * 24 * 60 * 60 * 1000)

      const slowest = Math.max(
        ...activeDays(program).map((day) => {
          const times = Array.from({ length: RUNS }, () => {
            const t0 = performance.now()
            for (const e of day.exercises) suggestFor(program, sessions, e, asOf)
            return performance.now() - t0
          })
          return Math.min(...times)
        }),
      )
      console.log(
        `replay benchmark, ${scheme}: ${sessions.length} sessions, slowest day ${slowest.toFixed(1)} ms`,
      )
      expect(slowest).toBeLessThan(LIMIT_MS)
    }, 120_000)
  }
})
