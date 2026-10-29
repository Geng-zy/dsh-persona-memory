export function localClock(now: number, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: timeZone || undefined, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(now)).replace(/^24/, '00')
  } catch {
    return new Date(now).toISOString().slice(11, 16)
  }
}
export function logicalDay(now: number, boundaryHour: number, timeZone: string): string {
  const shifted = new Date(now - boundaryHour * 3_600_000)
  try {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: timeZone || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).format(shifted)
  } catch {
    return shifted.toISOString().slice(0, 10)
  }
}
