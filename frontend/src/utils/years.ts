export function availableYearOptions(count = 12): number[] {
  const current = new Date().getFullYear()
  return Array.from({ length: count }, (_, i) => current - i)
}

export function formatYearsLabel(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const years = value
    .split(',')
    .map((y) => Number(y.trim()))
    .filter((y) => !Number.isNaN(y))
    .sort((a, b) => a - b)
  if (years.length === 0) return null
  if (years.length === 1) return String(years[0])
  if (years[years.length - 1] - years[0] + 1 === years.length) {
    return `${years[0]}–${years[years.length - 1]}`
  }
  return years.join(', ')
}
