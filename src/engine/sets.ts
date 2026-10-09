import type { LoggedSet } from './types'

/**
 * The sets the engine judges: the prescribed ones. Extra sets are recorded but left out of
 * validation and e1RM, so "sets are never added by progression" still holds (SPEC §6.2, §5.2).
 */
export const countedSets = (sets: LoggedSet[]): LoggedSet[] => sets.filter((s) => !s.extra)
