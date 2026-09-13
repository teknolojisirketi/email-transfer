import { ReactNode, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api, Settings } from '../api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Switch } from '../components/ui/switch'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      {children}
    </label>
  )
}

export default function SettingsPage() {
  const [form, setForm] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api
      .getSettings()
      .then(setForm)
      .catch((e) => toast.error(String(e)))
  }, [])

  const handleSave = async () => {
    if (!form) return
    setSaving(true)
    try {
      const updated = await api.updateSettings(form)
      setForm(updated)
      toast.success('Settings saved.')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSaving(false)
    }
  }

  if (!form) return <p className="text-sm text-muted-foreground">Loading...</p>

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Settings</h2>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Yandex IMAP (source)</CardTitle>
          <CardDescription>
            Turkey: imap.yandex.com.tr — Outside Russia: imap.ya.ru — Port 993, SSL
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="IMAP server">
              <Input
                value={form.yandex_imap_host}
                onChange={(e) => setForm({ ...form, yandex_imap_host: e.target.value })}
              />
            </Field>
            <Field label="Port">
              <Input
                type="number"
                value={form.yandex_imap_port}
                onChange={(e) => setForm({ ...form, yandex_imap_port: Number(e.target.value) })}
              />
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
              <Switch
                checked={form.yandex_imap_ssl}
                onChange={(e) => setForm({ ...form, yandex_imap_ssl: e.target.checked })}
              />
              Use SSL
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>cPanel IMAP (destination defaults)</CardTitle>
          <CardDescription>
            Each account has its own IMAP host in CSV (e.g. mail.example.com). Port is usually 993
            with SSL.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Port">
              <Input
                type="number"
                value={form.cpanel_imap_port}
                onChange={(e) => setForm({ ...form, cpanel_imap_port: Number(e.target.value) })}
              />
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
              <Switch
                checked={form.cpanel_imap_ssl}
                onChange={(e) => setForm({ ...form, cpanel_imap_ssl: e.target.checked })}
              />
              Use SSL
            </label>
            <Field label="Parallel jobs">
              <Input
                type="number"
                min={1}
                max={10}
                value={form.worker_concurrency}
                onChange={(e) => setForm({ ...form, worker_concurrency: Number(e.target.value) })}
              />
            </Field>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
