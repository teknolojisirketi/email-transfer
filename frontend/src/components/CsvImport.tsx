import { useRef } from 'react'
import { toast } from 'sonner'
import { Upload, FileDown, ClipboardPaste } from 'lucide-react'
import { parseCsv, csvTemplate, downloadCsvExample } from '../utils/csv'
import { AccountCreate } from '../api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'

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
      toast.error('No valid rows found. Check the CSV format.')
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
        toast.error('No valid rows found in the file.')
        return
      }
      onImport(accounts)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk CSV import</CardTitle>
        <CardDescription>
          One row per account pair: Yandex source → cPanel destination. All folders (Inbox, Sent,
          Drafts, Spam, custom folders) are copied automatically.
          <br />
          Example: example@example.com (Yandex) → example@example.com (cPanel), host:
          mail.example.com
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Textarea
          ref={textareaRef}
          placeholder={
            csvTemplate() +
            'example@example.com,yandex_pass,example@example.com,cpanel_pass,mail.example.com'
          }
          rows={6}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={handlePaste}>
            <ClipboardPaste className="h-4 w-4" />
            Import pasted text
          </Button>
          <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" />
            Choose CSV file
          </Button>
          <Button type="button" variant="secondary" onClick={() => downloadCsvExample()}>
            <FileDown className="h-4 w-4" />
            Download sample CSV
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={handleFile}
          />
        </div>
      </CardContent>
    </Card>
  )
}
