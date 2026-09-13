import { ReactNode, useState } from 'react'
import { api, AccountCreate, AccountTestResponse } from '../api'
import TestResults from './TestResults'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'

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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      {children}
    </label>
  )
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
    <Card>
      <CardHeader>
        <CardTitle>Add account manually</CardTitle>
        <CardDescription>
          Add accounts one at a time. You can test the connection before saving.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Yandex email">
            <Input
              type="email"
              value={form.yandex_email}
              onChange={(e) => update('yandex_email', e.target.value)}
              placeholder="example@example.com"
            />
          </Field>
          <Field label="Yandex password">
            <Input
              type="password"
              value={form.yandex_password}
              onChange={(e) => update('yandex_password', e.target.value)}
              placeholder="App password"
            />
          </Field>
          <Field label="cPanel email">
            <Input
              type="email"
              value={form.cpanel_email}
              onChange={(e) => update('cpanel_email', e.target.value)}
              placeholder="example@example.com"
            />
          </Field>
          <Field label="cPanel password">
            <Input
              type="password"
              value={form.cpanel_password}
              onChange={(e) => update('cpanel_password', e.target.value)}
              placeholder="Email password"
            />
          </Field>
          <Field label="cPanel IMAP host">
            <Input
              type="text"
              value={form.cpanel_imap_host}
              onChange={(e) => update('cpanel_imap_host', e.target.value)}
              placeholder="mail.example.com (auto if empty)"
            />
          </Field>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </div>
        )}
        {testResult && <TestResults result={testResult} />}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleTest}
            disabled={testing || saving}
          >
            {testing ? 'Testing...' : 'Test connection'}
          </Button>
          <Button type="button" onClick={handleSave} disabled={testing || saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
