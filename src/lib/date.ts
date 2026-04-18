export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

export function addDays(d: Date, n: number): Date {
  const next = new Date(d)
  next.setDate(next.getDate() + n)
  return next
}

export function relativeHours(from: Date, to: Date = new Date()): number {
  return (to.getTime() - from.getTime()) / 3_600_000
}
