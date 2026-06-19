import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, Account, AccountCreate, AccountTestResponse } from '../api'
import { formatTrDateTime } from '../utils/datetime'
import { STATUS_LABELS } from '../utils/status'
import CsvImport from '../components/CsvImport'
import ManualAccountForm from '../components/ManualAccountForm'
import TestResults from '../components/TestResults'

type AccountTab = 'all' | 'pending' | 'running' | 'completed'

const TABS: { id: AccountTab; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'pending', label: 'Bekleyen' },
  { id: 'running', label: 'Çalışan' },
  { id: 'completed', label: 'Tamamlandı' },
]

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [activeTab, setActiveTab] = useState<AccountTab>('all')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [testingId, setTestingId] = useState<number | null>(null)
  const [rowTestResult, setRowTestResult] = useState<AccountTestResponse | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setAccounts(await api.getAccounts())
    } catch (e) {
      setMessage(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [load])

  const handleImport = async (items: AccountCreate[]) => {
    try {
      const result = await api.bulkImport(items)
      setMessage(`${result.imported} hesap içe aktarıldı${result.skipped ? `, ${result.skipped} atlandı` : ''}`)
      load()
    } catch (e) {
      setMessage(String(e))
    }
  }

  const handleStartAll = async () => {
    try {
      const ids = selected.size > 0 ? Array.from(selected) : undefined
      const result = await api.startMigration(ids)
      setMessage(`${result.jobs_created} iş kuyruğa eklendi`)
      load()
    } catch (e) {
      setMessage(String(e))
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Bu hesabı silmek istediğinize emin misiniz?')) return
    await api.deleteAccount(id)
    if (rowTestResult) setRowTestResult(null)
    load()
  }

  const handleTestRow = async (id: number) => {
    setTestingId(id)
    setRowTestResult(null)
    setMessage('')
    try {
      const result = await api.testSavedAccount(id)
      setRowTestResult(result)
      setMessage(
        result.overall_success
          ? `Hesap #${id}: Her iki bağlantı başarılı`
          : `Hesap #${id}: Bağlantı testinde hata var`,
      )
    } catch (e) {
      setMessage(String(e))
    } finally {
      setTestingId(null)
    }
  }

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    const visibleIds = filteredAccounts.map((a) => a.id)
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
    if (allVisibleSelected) {
      setSelected((prev) => {
        const next = new Set(prev)
        visibleIds.forEach((id) => next.delete(id))
        return next
      })
    } else {
      setSelected((prev) => new Set([...prev, ...visibleIds]))
    }
  }

  const filteredAccounts = accounts.filter((a) => {
    if (activeTab === 'all') return true
    return a.latest_job_status === activeTab
  })

  const tabCounts = {
    all: accounts.length,
    pending: accounts.filter((a) => a.latest_job_status === 'pending').length,
    running: accounts.filter((a) => a.latest_job_status === 'running').length,
    completed: accounts.filter((a) => a.latest_job_status === 'completed').length,
  }

  const emptyTabMessage: Record<AccountTab, string> = {
    all: 'Henüz hesap eklenmedi. Elle girin veya CSV ile içe aktarın.',
    pending: 'Kuyrukta bekleyen hesap yok.',
    running: 'Şu an taşınan hesap yok.',
    completed: 'Tamamlanan taşıma yok.',
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Hesaplar</h2>
        <div className="actions">
          <button onClick={handleStartAll} disabled={accounts.length === 0}>
            {selected.size > 0 ? `Seçilenleri Taşı (${selected.size})` : 'Tümünü Taşı'}
          </button>
        </div>
      </div>

      {message && <div className="alert">{message}</div>}

      <ManualAccountForm onSaved={(msg) => { setMessage(msg); load() }} />

      <CsvImport onImport={handleImport} />

      {rowTestResult && (
        <div className="card">
          <h3>Son Test Sonucu</h3>
          <TestResults result={rowTestResult} />
        </div>
      )}

      {loading && accounts.length === 0 ? (
        <p>Yükleniyor...</p>
      ) : accounts.length === 0 ? (
        <p className="empty">{emptyTabMessage.all}</p>
      ) : (
        <>
          <div className="filter-tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`filter-tab${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
                <span className="tab-count">{tabCounts[tab.id]}</span>
              </button>
            ))}
          </div>

          {filteredAccounts.length === 0 ? (
            <p className="empty">{emptyTabMessage[activeTab]}</p>
          ) : (
            <div className="table-wrap card">
              <table>
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={
                          filteredAccounts.length > 0 &&
                          filteredAccounts.every((a) => selected.has(a.id))
                        }
                        onChange={toggleAll}
                      />
                    </th>
                    <th>Yandex E-posta</th>
                    <th>cPanel E-posta</th>
                    <th>cPanel IMAP Host</th>
                    <th>Taşıma</th>
                    <th>Eklenme</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.map((a) => (
                <tr key={a.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(a.id)}
                      onChange={() => toggleSelect(a.id)}
                    />
                  </td>
                  <td>{a.yandex_email}</td>
                  <td>{a.cpanel_email}</td>
                  <td>{a.cpanel_imap_host}</td>
                  <td>
                    {a.latest_job_status ? (
                      <div className="account-job-status">
                        <span className={`status-badge status-${a.latest_job_status}`}>
                          {STATUS_LABELS[a.latest_job_status] || a.latest_job_status}
                        </span>
                        {a.messages_transferred > 0 && (
                          <span className="msg-count">{a.messages_transferred} mesaj</span>
                        )}
                        {a.latest_job_id && (
                          <Link to="/jobs" className="job-link">
                            #{a.latest_job_id}
                          </Link>
                        )}
                      </div>
                    ) : (
                      <span className="muted">Kuyrukta değil</span>
                    )}
                  </td>
                  <td>{formatTrDateTime(a.created_at)}</td>
                  <td className="row-actions">
                    <button
                      className="small secondary"
                      onClick={() => handleTestRow(a.id)}
                      disabled={testingId === a.id}
                    >
                      {testingId === a.id ? '...' : 'Test'}
                    </button>
                    <button className="danger small" onClick={() => handleDelete(a.id)}>
                      Sil
                    </button>
                  </td>
                </tr>
              ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
