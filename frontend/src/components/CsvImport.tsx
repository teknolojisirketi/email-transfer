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
      alert('Geçerli satır bulunamadı. CSV formatını kontrol edin.')
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
        alert('Dosyada geçerli satır bulunamadı.')
        return
      }
      onImport(accounts)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="csv-import card">
      <h3>Toplu CSV İçe Aktar</h3>
      <p className="hint">
        Her satır bir hesap çifti: Yandex kaynak → cPanel hedef. Tüm klasörler (Gelen, Giden,
        Taslaklar, Spam, özel klasörler) otomatik kopyalanır.
        <br />
        Örnek: example@example.com (Yandex) → example@example.com (cPanel), host: mail.example.com
      </p>
      <textarea
        ref={textareaRef}
        placeholder={csvTemplate() + 'example@example.com,yandex_sifre,example@example.com,cpanel_sifre,mail.example.com'}
        rows={6}
      />
      <div className="csv-actions">
        <button type="button" onClick={handlePaste}>
          Yapıştırılanı İçe Aktar
        </button>
        <button type="button" className="secondary" onClick={() => fileRef.current?.click()}>
          CSV Dosyası Seç
        </button>
        <button type="button" className="secondary" onClick={() => downloadCsvExample()}>
          Örnek CSV İndir
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
