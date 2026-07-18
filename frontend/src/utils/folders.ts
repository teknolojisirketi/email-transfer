export function formatFoldersLabel(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  try {
    const folders = JSON.parse(value) as unknown
    if (Array.isArray(folders)) {
      const names = folders.map((item) => String(item)).filter(Boolean)
      if (names.length === 0) return null
      if (names.length <= 3) return names.join(', ')
      return `${names.slice(0, 2).join(', ')}, +${names.length - 2} more`
    }
  } catch {
    // fall through
  }
  return value
}
