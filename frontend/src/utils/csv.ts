import { AccountCreate } from './api'

const CSV_HEADERS = [
  'yandex_email',
  'yandex_password',
  'cpanel_email',
  'cpanel_password',
  'cpanel_imap_host',
]

export function parseCsv(text: string): AccountCreate[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  if (lines.length === 0) return []

  let start = 0
  const first = lines[0].toLowerCase()
  if (first.includes('yandex_email') || first.includes('cpanel_email')) {
    start = 1
  }

  const accounts: AccountCreate[] = []
  for (let i = start; i < lines.length; i++) {
    const parts = parseCsvLine(lines[i])
    if (parts.length < 4) continue
    const cpanelEmail = parts[2]
    const domain = cpanelEmail.includes('@') ? cpanelEmail.split('@')[1] : ''
    const imapHost = parts[4]?.trim() || (domain ? `mail.${domain}` : '')
    if (!imapHost) continue
    accounts.push({
      yandex_email: parts[0],
      yandex_password: parts[1],
      cpanel_email: cpanelEmail,
      cpanel_password: parts[3],
      cpanel_imap_host: imapHost,
    })
  }
  return accounts
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

export function csvTemplate(): string {
  return CSV_HEADERS.join(',') + '\n'
}

export function csvExampleContent(): string {
  return [
    CSV_HEADERS.join(','),
    'example@example.com,yandex_uygulama_sifresi,example@example.com,cpanel_sifresi,mail.example.com',
    'user@example.com,yandex_uygulama_sifresi,user@example.com,cpanel_sifresi,',
    'sales@example.com,yandex_uygulama_sifresi,sales@example.com,cpanel_sifresi,mail.example.com',
  ].join('\n') + '\n'
}

export function downloadCsvExample(filename = 'ornek-hesaplar.csv'): void {
  const blob = new Blob([csvExampleContent()], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
