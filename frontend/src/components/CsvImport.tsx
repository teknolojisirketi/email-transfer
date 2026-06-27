import { useRef } from 'react'
import { parseCsv, csvTemplate, downloadCsvExample } from '../utils/csv'
import { AccountCreate } from '../api'

interface Props {
  onImport: (accounts: AccountCreate[]) => void
}

export default function CsvImport({ onImport }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handlePaste = () => {
    const text = textareaRef.current?.value || ''
    const accounts = parseCsv(text)
    if (accounts.length === 0) {
      alert('No valid rows found. Check the CSV format.')
      return
    }
    onImport(accounts)
    if (textareaRef.current) textareaRef.current.value = ''
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const accounts = parseCsv(reader.result as string)
      if (accounts.length === 0) {
        alert('No valid rows found in the file.')
        return
      }
      onImport(accounts)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="csv-import card">
      <h3>Bulk CSV import</h3>
      <p className="hint">
        One row per account pair: Yandex source → cPanel destination. All folders (Inbox, Sent,
        Drafts, Spam, custom folders) are copied automatically.
        <br />
        Example: example@example.com (Yandex) → example@example.com (cPanel), host: mail.example.com
      </p>
      <textarea
        ref={textareaRef}
        placeholder={csvTemplate() + 'example@example.com,yandex_pass,example@example.com,cpanel_pass,mail.example.com'}
        rows={6}
      />
      <div className="csv-actions">
        <button type="button" onClick={handlePaste}>
          Import pasted text
        </button>
        <button type="button" className="secondary" onClick={() => fileRef.current?.click()}>
          Choose CSV file
        </button>
        <button type="button" className="secondary" onClick={() => downloadCsvExample()}>
          Download sample CSV
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
      </div>
    </div>
  )
}
