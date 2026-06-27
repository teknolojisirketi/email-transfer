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
      setError('Yandex and cPanel email addresses are required.')
      return
    }
    if (!data.yandex_password || !data.cpanel_password) {
      setError('Both passwords are required for testing.')
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
      setError('Please fill in all required fields.')
      return
    }
    if (!data.yandex_password || !data.cpanel_password) {
      setError('Both passwords are required.')
      return
    }

    setSaving(true)
    setError('')
    try {
      await api.createAccount(data)
      setForm({ ...emptyForm })
      setTestResult(null)
      onSaved('Account saved.')
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card manual-form">
      <h3>Add account manually</h3>
      <p className="hint">
        Add accounts one at a time. You can test the connection before saving.
      </p>

      <div className="form-grid manual-grid">
        <label>
          Yandex email
          <input
            type="email"
            value={form.yandex_email}
            onChange={(e) => update('yandex_email', e.target.value)}
            placeholder="example@example.com"
          />
        </label>
        <label>
          Yandex password
          <input
            type="password"
            value={form.yandex_password}
            onChange={(e) => update('yandex_password', e.target.value)}
            placeholder="App password"
          />
        </label>
        <label>
          cPanel email
          <input
            type="email"
            value={form.cpanel_email}
            onChange={(e) => update('cpanel_email', e.target.value)}
            placeholder="example@example.com"
          />
        </label>
        <label>
          cPanel password
          <input
            type="password"
            value={form.cpanel_password}
            onChange={(e) => update('cpanel_password', e.target.value)}
            placeholder="Email password"
          />
        </label>
        <label>
          cPanel IMAP host
          <input
            type="text"
            value={form.cpanel_imap_host}
            onChange={(e) => update('cpanel_imap_host', e.target.value)}
            placeholder="mail.example.com (auto if empty)"
          />
        </label>
      </div>

      {error && <div className="alert error">{error}</div>}
      {testResult && <TestResults result={testResult} />}

      <div className="csv-actions">
        <button type="button" className="secondary" onClick={handleTest} disabled={testing || saving}>
          {testing ? 'Testing...' : 'Test connection'}
        </button>
        <button type="button" onClick={handleSave} disabled={testing || saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}
