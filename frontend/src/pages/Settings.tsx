import { useEffect, useState } from 'react'
import { api, Settings } from '../api'

export default function SettingsPage() {
  const [form, setForm] = useState<Settings | null>(null)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.getSettings().then(setForm).catch((e) => setMessage(String(e)))
  }, [])

  const handleSave = async () => {
    if (!form) return
    setSaving(true)
    try {
      const updated = await api.updateSettings(form)
      setForm(updated)
      setMessage('Settings saved.')
    } catch (e) {
      setMessage(String(e))
    } finally {
      setSaving(false)
    }
  }

  if (!form) return <p>Loading...</p>

  return (
    <div className="page">
      <div className="page-header">
        <h2>Settings</h2>
        <button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {message && <div className="alert">{message}</div>}

      <div className="card settings-form">
        <h3>Yandex IMAP (source)</h3>
        <p className="hint">
          Turkey: imap.yandex.com.tr — Outside Russia: imap.ya.ru — Port 993, SSL
        </p>
        <div className="form-grid">
          <label>
            IMAP server
            <input
              value={form.yandex_imap_host}
              onChange={(e) => setForm({ ...form, yandex_imap_host: e.target.value })}
            />
          </label>
          <label>
            Port
            <input
              type="number"
              value={form.yandex_imap_port}
              onChange={(e) => setForm({ ...form, yandex_imap_port: Number(e.target.value) })}
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.yandex_imap_ssl}
              onChange={(e) => setForm({ ...form, yandex_imap_ssl: e.target.checked })}
            />
            Use SSL
          </label>
        </div>

        <h3>cPanel IMAP (destination defaults)</h3>
        <p className="hint">
          Each account has its own IMAP host in CSV (e.g. mail.example.com). Port is usually 993 with SSL.
        </p>
        <div className="form-grid">
          <label>
            Port
            <input
              type="number"
              value={form.cpanel_imap_port}
              onChange={(e) => setForm({ ...form, cpanel_imap_port: Number(e.target.value) })}
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.cpanel_imap_ssl}
              onChange={(e) => setForm({ ...form, cpanel_imap_ssl: e.target.checked })}
            />
            Use SSL
          </label>
          <label>
            Parallel jobs
            <input
              type="number"
              min={1}
              max={10}
              value={form.worker_concurrency}
              onChange={(e) => setForm({ ...form, worker_concurrency: Number(e.target.value) })}
            />
          </label>
        </div>
      </div>
    </div>
  )
}
