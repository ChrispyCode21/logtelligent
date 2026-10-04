/**
 * The next training day (SPEC §5.1): the one after the last day logged,
 * wrapping from the final day back to the first. With nothing logged yet, or
 * if the last day is no longer in the rotation, start at the first day.
 */
export function nextDay<T extends { id: string }>(days: T[], lastDayId?: string): T | undefined {
  if (days.length === 0) return undefined
  const lastIndex = days.findIndex((d) => d.id === lastDayId)
  return days[(lastIndex + 1) % days.length]
}
