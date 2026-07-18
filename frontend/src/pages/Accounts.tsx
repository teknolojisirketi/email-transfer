import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, Account, AccountCreate, AccountTestResponse } from '../api'
import { formatTrDateTime } from '../utils/datetime'
import { STATUS_LABELS } from '../utils/status'
import CsvImport from '../components/CsvImport'
import FolderPickerModal from '../components/FolderPickerModal'
import ManualAccountForm from '../components/ManualAccountForm'
import TestResults from '../components/TestResults'
import { availableYearOptions } from '../utils/years'
import { shortUuid } from '../utils/uuid'

type AccountTab = 'all' | 'pending' | 'running' | 'completed' | 'failed'

const YEAR_OPTIONS = availableYearOptions(12)

const TABS: { id: AccountTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Waiting' },
  { id: 'running', label: 'Running' },
  { id: 'completed', label: 'Completed' },
  { id: 'failed', label: 'Failed' },
]

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [activeTab, setActiveTab] = useState<AccountTab>('all')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [testingId, setTestingId] = useState<number | null>(null)
  const [rowTestResult, setRowTestResult] = useState<AccountTestResponse | null>(null)
  const [selectedYears, setSelectedYears] = useState<Set<number>>(new Set())
  const [folderPickerAccount, setFolderPickerAccount] = useState<Account | null>(null)

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
      setMessage(`${result.imported} account(s) imported${result.skipped ? `, ${result.skipped} skipped` : ''}`)
      load()
    } catch (e) {
      setMessage(String(e))
    }
  }

  const handleStartAll = async () => {
    try {
      const ids = selected.size > 0 ? Array.from(selected) : undefined
      const years = selectedYears.size > 0 ? Array.from(selectedYears).sort((a, b) => a - b) : undefined
      const result = await api.startMigration(ids, years)
      const yearHint = years?.length ? ` (${years.join(', ')})` : ' (all years)'
      setMessage(`${result.jobs_created} job(s) queued${yearHint}`)
      load()
    } catch (e) {
      setMessage(String(e))
    }
  }

  const toggleYear = (year: number) => {
    setSelectedYears((prev) => {
      const next = new Set(prev)
      if (next.has(year)) next.delete(year)
      else next.add(year)
      return next
    })
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this account?')) return
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
          ? `Account #${id}: both connections succeeded`
          : `Account #${id}: connection test failed`,
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
    failed: accounts.filter((a) => a.latest_job_status === 'failed').length,
  }

  const emptyTabMessage: Record<AccountTab, string> = {
    all: 'No accounts yet. Add manually or import from CSV.',
    pending: 'No accounts waiting in queue.',
    running: 'No accounts currently migrating.',
    completed: 'No completed migrations.',
    failed: 'No failed migrations.',
  }

  return (
    <div className="page">
      <div className="accounts-toolbar card">
        <div className="accounts-toolbar-top">
          <h2>Accounts</h2>
          <button onClick={handleStartAll} disabled={accounts.length === 0}>
            {selected.size > 0 ? `Migrate selected (${selected.size})` : 'Migrate all'}
          </button>
        </div>
        <div className="year-filter-bar">
          <span className="year-filter-label">Years to migrate</span>
          <div className="year-filter-options">
            {YEAR_OPTIONS.map((year) => (
              <label key={year} className="year-chip">
                <input
                  type="checkbox"
                  checked={selectedYears.has(year)}
                  onChange={() => toggleYear(year)}
                />
                {year}
              </label>
            ))}
          </div>
          <p className="year-filter-hint">
            {selectedYears.size > 0
              ? `Selected: ${[...selectedYears].sort((a, b) => a - b).join(', ')}`
              : 'If none selected, all mail will be migrated'}
          </p>
        </div>
      </div>

      {message && <div className="alert">{message}</div>}

      <ManualAccountForm onSaved={(msg) => { setMessage(msg); load() }} />

      <CsvImport onImport={handleImport} />

      {rowTestResult && (
        <div className="card">
          <h3>Latest test result</h3>
          <TestResults result={rowTestResult} />
        </div>
      )}

      {loading && accounts.length === 0 ? (
        <p>Loading...</p>
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
                    <th>Yandex email</th>
                    <th>cPanel email</th>
                    <th>cPanel IMAP host</th>
                    <th>Migration</th>
                    <th>Added</th>
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
                          <span className="msg-count">{a.messages_transferred} messages</span>
                        )}
                        {a.latest_job_uuid && (
                          <Link to="/jobs" className="job-link">
                            {shortUuid(a.latest_job_uuid)}
                          </Link>
                        )}
                        {a.latest_job_status === 'failed' && a.latest_job_error && (
                          <span className="error-text job-error-detail" title={a.latest_job_error}>
                            {a.latest_job_error}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="muted">Not queued</span>
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
                    <button
                      className="small"
                      onClick={() => setFolderPickerAccount(a)}
                      disabled={a.latest_job_status === 'pending' || a.latest_job_status === 'running'}
                    >
                      Folders
                    </button>
                    <button className="danger small" onClick={() => handleDelete(a.id)}>
                      Delete
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

      {folderPickerAccount && (
        <FolderPickerModal
          account={folderPickerAccount}
          selectedYears={[...selectedYears].sort((a, b) => a - b)}
          onClose={() => setFolderPickerAccount(null)}
          onStarted={(msg) => {
            setMessage(msg)
            load()
          }}
        />
      )}
    </div>
  )
}
