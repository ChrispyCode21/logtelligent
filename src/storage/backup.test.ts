import { describe, expect, it } from 'vitest'
import type { Session } from './db'
import { backupFilename, buildBackup, parseBackup } from './backup'

const sessions: Session[] = [
  {
    id: 1,
    dayId: 'upper-a',
    startedAt: '2026-10-01T10:00:00Z',
    finishedAt: '2026-10-01T11:00:00Z',
    exercises: [{ exerciseId: 'bench', sets: [{ weight: 225, reps: 4, rpe: 8 }] }],
  },
]
const program = { id: 'main' as const, days: [{ id: 'upper-a', name: 'Upper A', exercises: [] }] }

describe('JSON backup (SPEC §2)', () => {
  it('names the file by local date', () => {
    expect(backupFilename(new Date(2026, 9, 4, 23, 30))).toBe('logtelligent-2026-10-04.json')
  })

  it('round-trips through JSON', () => {
    const backup = buildBackup(program, sessions, new Date('2026-10-04T12:00:00Z'))
    expect(parseBackup(JSON.stringify(backup))).toEqual(backup)
  })

  it('accepts a backup with no program yet', () => {
    expect(parseBackup(JSON.stringify(buildBackup(undefined, [], new Date()))).program).toBeNull()
  })

  it('rejects files that are not a usable backup, with a readable reason', () => {
    expect(() => parseBackup('not json')).toThrow('not valid JSON')
    expect(() => parseBackup('{"hello":1}')).toThrow('not a Logtelligent backup')
    const newer = { ...buildBackup(program, sessions, new Date()), format: 99 }
    expect(() => parseBackup(JSON.stringify(newer))).toThrow('newer version')
    const damaged = { ...buildBackup(program, sessions, new Date()), sessions: [{ id: 1 }] }
    expect(() => parseBackup(JSON.stringify(damaged))).toThrow('incomplete or damaged')
  })

  it('round-trips a full program and a session using the exercise menu', () => {
    const full = {
      id: 'main' as const,
      days: [
        {
          id: 'upper-a',
          name: 'Upper A',
          exercises: [
            {
              id: 'bench',
              name: 'Bench Press',
              tier: 'primary' as const,
              repRange: { min: 3, max: 5 },
              targetRpe: 8,
              sets: 3,
              equipment: 'barbell' as const,
              maxRelativeJump: 0.1,
              unilateral: false,
              seed: { weight: 225, reps: 5 },
            },
            {
              id: 'raise',
              name: 'Lateral Raise',
              tier: 'accessory' as const,
              repRange: { min: 15, max: 20 },
              targetRpe: 8,
              sets: 3,
              equipment: 'cable' as const,
              loads: [10, 15, 20],
              maxRelativeJump: 0.1,
              unilateral: true,
              archived: true,
            },
          ],
        },
      ],
    }
    const menuSession: Session = {
      id: 2,
      dayId: 'upper-a',
      startedAt: '2026-10-02T10:00:00Z',
      exercises: [
        { exerciseId: 'bench', sets: [], substitute: { name: 'Machine press', sets: [{ weight: 150, reps: 10 }] } },
        { exerciseId: 'raise', sets: [], skipped: true },
      ],
      warmupDismissed: true,
    }
    const backup = buildBackup(full, [...sessions, menuSession], new Date('2026-10-04T12:00:00Z'))
    expect(parseBackup(JSON.stringify(backup))).toEqual(backup)
  })

  it('points at the bad field in a damaged backup', () => {
    const bad = buildBackup(program, sessions, new Date())
    const json = JSON.parse(JSON.stringify(bad))
    json.sessions[0].exercises[0].sets[0].reps = 'four'
    expect(() => parseBackup(JSON.stringify(json))).toThrow('sessions[0].exercises[0].sets[0].reps')
  })

  it('rejects absurd numbers', () => {
    const json = JSON.parse(JSON.stringify(buildBackup(program, sessions, new Date())))
    json.sessions[0].exercises[0].sets[0].weight = 1e9
    expect(() => parseBackup(JSON.stringify(json))).toThrow('weight')
  })

  it('drops fields it does not know about', () => {
    const json = JSON.parse(JSON.stringify(buildBackup(program, sessions, new Date())))
    json.sessions[0].injected = '<script>alert(1)</script>'
    json.sessions[0].exercises[0].sets[0].extra = true
    const parsed = parseBackup(JSON.stringify(json))
    expect(parsed.sessions[0]).not.toHaveProperty('injected')
    expect(parsed.sessions[0].exercises[0].sets[0]).toEqual({ weight: 225, reps: 4, rpe: 8 })
  })
})
