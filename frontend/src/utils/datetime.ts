/** API returns UTC datetimes; naive strings must be treated as UTC. */
export function parseApiDate(iso: string): Date {
  if (iso.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(iso)) {
    return new Date(iso)
  }
  return new Date(`${iso}Z`)
}

export function formatTrDateTime(iso: string | null): string {
  if (!iso) return '—'
  return parseApiDate(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export function elapsedSince(iso: string): { h: number; m: number; s: number } {
  const diff = Math.max(0, Math.floor((Date.now() - parseApiDate(iso).getTime()) / 1000))
  return {
    h: Math.floor(diff / 3600),
    m: Math.floor((diff % 3600) / 60),
    s: diff % 60,
  }
}

export function formatElapsed(iso: string): string {
  const { h, m, s } = elapsedSince(iso)
  const parts: string[] = []
  if (h > 0) parts.push(`${h}h`)
  if (m > 0) parts.push(`${m}m`)
  parts.push(`${s}s`)
  return parts.join(' ')
}
