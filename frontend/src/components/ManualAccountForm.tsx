import { useState } from 'react'
import { api, AccountCreate, AccountTestResponse } from '../api'
import TestResults from './TestResults'

const emptyForm: AccountCreate = {
  yandex_email: '',
  yandex_password: '',
  cpanel_email: '',
  cpanel_password: '',
  cpanel_imap_host: '',
}

function deriveImapHost(cpanelEmail: string, host: string): string {
  const trimmed = host.trim()
  if (trimmed) return trimmed
  if (cpanelEmail.includes('@')) return `mail.${cpanelEmail.split('@')[1]}`
  return ''
}

interface Props {
  onSaved: (message: string) => void
}

export default function ManualAccountForm({ onSaved }: Props) {
  const [form, setForm] = useState<AccountCreate>({ ...emptyForm })
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<AccountTestResponse | null>(null)
  const [error, setError] = useState('')

  const update = (field: keyof AccountCreate, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'cpanel_email' && !prev.cpanel_imap_host.trim()) {
        next.cpanel_imap_host = deriveImapHost(value, '')
      }
      return next
    })
    setTestResult(null)
    setError('')
  }

  const payload = (): AccountCreate => ({
    ...form,
    yandex_email: form.yandex_email.trim(),
    cpanel_email: form.cpanel_email.trim(),
    cpanel_imap_host: deriveImapHost(form.cpanel_email, form.cpanel_imap_host),
  })

  const handleTest = async () => {
    const data = payload()
    if (!data.yandex_email || !data.cpanel_email) {
      setError('Yandex ve cPanel e-posta adresleri zorunludur.')
      return
    }
    if (!data.yandex_password || !data.cpanel_password) {
      setError('Test için her iki şifre de girilmelidir.')
      return
    }

    setTesting(true)
    setError('')
    setTestResult(null)
    try {
      const result = await api.testAccount(data)
      setTestResult(result)
    } catch (e) {
      setError(String(e))
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    const data = payload()
    if (!data.yandex_email || !data.cpanel_email || !data.cpanel_imap_host) {
      setError('Tüm zorunlu alanları doldurun.')
      return
    }
    if (!data.yandex_password || !data.cpanel_password) {
      setError('Her iki şifre de zorunludur.')
      return
    }

    setSaving(true)
    setError('')
    try {
      await api.createAccount(data)
      setForm({ ...emptyForm })
      setTestResult(null)
      onSaved('Hesap kaydedildi.')
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card manual-form">
      <h3>Elle Hesap Ekle</h3>
      <p className="hint">
        Tek tek hesap girişi yapın. Kaydetmeden önce bağlantıyı test edebilirsiniz.
      </p>

      <div className="form-grid manual-grid">
        <label>
          Yandex E-posta
          <input
            type="email"
            value={form.yandex_email}
            onChange={(e) => update('yandex_email', e.target.value)}
            placeholder="example@example.com"
          />
        </label>
        <label>
          Yandex Şifre
          <input
            type="password"
            value={form.yandex_password}
            onChange={(e) => update('yandex_password', e.target.value)}
            placeholder="Uygulama şifresi"
          />
        </label>
        <label>
          cPanel E-posta
          <input
            type="email"
            value={form.cpanel_email}
            onChange={(e) => update('cpanel_email', e.target.value)}
            placeholder="example@example.com"
          />
        </label>
        <label>
          cPanel Şifre
          <input
            type="password"
            value={form.cpanel_password}
            onChange={(e) => update('cpanel_password', e.target.value)}
            placeholder="E-posta şifresi"
          />
        </label>
        <label>
          cPanel IMAP Host
          <input
            type="text"
            value={form.cpanel_imap_host}
            onChange={(e) => update('cpanel_imap_host', e.target.value)}
            placeholder="mail.example.com (boş = otomatik)"
          />
        </label>
      </div>

      {error && <div className="alert error">{error}</div>}
      {testResult && <TestResults result={testResult} />}

      <div className="csv-actions">
        <button type="button" className="secondary" onClick={handleTest} disabled={testing || saving}>
          {testing ? 'Test ediliyor...' : 'Bağlantıyı Test Et'}
        </button>
        <button type="button" onClick={handleSave} disabled={testing || saving}>
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </div>
    </div>
  )
}
