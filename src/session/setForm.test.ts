import { describe, expect, it } from 'vitest'
import { parseSetForm, prefill, prefillExtra } from './setForm'

describe('set pre-fill (SPEC §5.2)', () => {
  it('fills the next set from the previous one, effort included', () => {
    expect(prefill([{ weight: 225, reps: 4, rpe: 8 }], { weight: 235, reps: 5 })).toEqual({
      weight: '225',
      reps: '4',
      rpe: 8,
    })
  })

  it('fills set 1 from the suggestion, with no effort', () => {
    expect(prefill([], { weight: 235, reps: 5 })).toEqual({ weight: '235', reps: '5' })
  })

  it('is blank with neither', () => {
    expect(prefill([])).toEqual({ weight: '', reps: '' })
  })
})

describe('reading the set form', () => {
  const loaded = { allowZeroWeight: false, rpeRequired: false }
  const form = (weight: string, reps: string, rpe?: number) => ({ weight, reps, rpe })

  it('gives the set when the form is complete', () => {
    expect(parseSetForm(form('225', '5', 8), loaded)).toEqual({ weight: 225, reps: 5, rpe: 8 })
    expect(parseSetForm(form('22.5', '0'), loaded)).toEqual({ weight: 22.5, reps: 0, rpe: undefined })
  })

  it('needs a weight and reps', () => {
    expect(parseSetForm(form('', '5'), loaded)).toBeUndefined()
    expect(parseSetForm(form('225', ''), loaded)).toBeUndefined()
    expect(parseSetForm(form('heavy', '5'), loaded)).toBeUndefined()
  })

  it('needs whole, non-negative reps', () => {
    expect(parseSetForm(form('225', '4.5'), loaded)).toBeUndefined()
    expect(parseSetForm(form('225', '-1'), loaded)).toBeUndefined()
  })

  it('allows 0 lb only where it is valid (SPEC §6.1), and never a negative weight', () => {
    expect(parseSetForm(form('0', '10'), loaded)).toBeUndefined()
    expect(parseSetForm(form('0', '10'), { ...loaded, allowZeroWeight: true })).toEqual({
      weight: 0,
      reps: 10,
      rpe: undefined,
    })
    expect(parseSetForm(form('-5', '10'), { ...loaded, allowZeroWeight: true })).toBeUndefined()
  })

  it('needs effort where it is required (SPEC §6.3)', () => {
    const required = { ...loaded, rpeRequired: true }
    expect(parseSetForm(form('225', '5'), required)).toBeUndefined()
    expect(parseSetForm(form('225', '5', 8), required)).toEqual({ weight: 225, reps: 5, rpe: 8 })
  })
})

describe('pre-fill with extra sets (SPEC §9.2, slice 2)', () => {
  const sets = [
    { weight: 225, reps: 5, rpe: 8 },
    { weight: 185, reps: 8, extra: true },
  ]

  it('fills a prescribed set from the last prescribed set, not an extra', () => {
    expect(prefill(sets)).toEqual({ weight: '225', reps: '5', rpe: 8 })
  })

  it('fills an extra from the set before it, without effort', () => {
    expect(prefillExtra(sets)).toEqual({ weight: '185', reps: '8' })
    expect(prefillExtra([{ weight: 225, reps: 5, rpe: 8 }])).toEqual({ weight: '225', reps: '5' })
  })
})
