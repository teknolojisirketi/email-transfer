import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { FolderCog, Trash2 } from 'lucide-react'
import { api, Account, AccountCreate, AccountTestResponse } from '../api'
import { formatTrDateTime } from '../utils/datetime'
import { STATUS_LABELS } from '../utils/status'
import CsvImport from '../components/CsvImport'
import FolderPickerModal from '../components/FolderPickerModal'
import ManualAccountForm from '../components/ManualAccountForm'
import TestResults from '../components/TestResults'
import { ConfirmDialog, ConfirmDialogState } from '../components/ConfirmDialog'
import { availableYearOptions } from '../utils/years'
import { shortUuid } from '../utils/uuid'
import { Card, CardContent, CardHeader } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
} from '../components/ui/table'
import { cn } from '../lib/utils'

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
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [testingIds, setTestingIds] = useState<Set<number>>(new Set())
  const [rowTestResult, setRowTestResult] = useState<AccountTestResponse | null>(null)
  const [selectedYears, setSelectedYears] = useState<Set<number>>(new Set())
  const [folderPickerAccount, setFolderPickerAccount] = useState<Account | null>(null)
  const [confirmState, setConfirmState] = useState<ConfirmDialogState | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setAccounts(await api.getAccounts())
    } catch (e) {
      toast.error(String(e))
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
      toast.success(
        `${result.imported} account(s) imported${result.skipped ? `, ${result.skipped} skipped` : ''}`,
      )
      load()
    } catch (e) {
      toast.error(String(e))
    }
  }

  const handleStartAll = async () => {
    try {
      const ids = selected.size > 0 ? Array.from(selected) : undefined
      const years =
        selectedYears.size > 0 ? Array.from(selectedYears).sort((a, b) => a - b) : undefined
      const result = await api.startMigration(ids, years)
      const yearHint = years?.length ? ` (${years.join(', ')})` : ' (all years)'
      toast.success(`${result.jobs_created} job(s) queued${yearHint}`)
      load()
    } catch (e) {
      toast.error(String(e))
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

  const handleDelete = (id: number) => {
    setConfirmState({
      title: 'Delete this account?',
      description: 'This cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'destructive',
      onConfirm: async () => {
        await api.deleteAccount(id)
        if (rowTestResult) setRowTestResult(null)
        load()
      },
    })
  }

  const handleBulkDelete = () => {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    setConfirmState({
      title: `Delete ${ids.length} account(s)?`,
      description: 'This cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'destructive',
      onConfirm: async () => {
        const result = await api.bulkDeleteAccounts(ids)
        toast.success(`${result.deleted} account(s) deleted`)
        setSelected(new Set())
        if (rowTestResult) setRowTestResult(null)
        load()
      },
    })
  }

  const applyTestResult = (id: number, result: AccountTestResponse) => {
    setAccounts((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              last_test_success: result.overall_success,
              last_test_at: new Date().toISOString(),
              last_test_yandex_message: result.yandex.message,
              last_test_cpanel_message: result.cpanel.message,
            }
          : a,
      ),
    )
  }

  const handleTestRow = async (id: number) => {
    setTestingIds((prev) => new Set(prev).add(id))
    setRowTestResult(null)
    try {
      const result = await api.testSavedAccount(id)
      applyTestResult(id, result)
      setRowTestResult(result)
      if (result.overall_success) {
        toast.success(`Account #${id}: both connections succeeded`)
      } else {
        toast.error(`Account #${id}: connection test failed`)
      }
    } catch (e) {
      toast.error(String(e))
    } finally {
      setTestingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const handleBulkTest = async () => {
    const candidateIds = selected.size > 0 ? Array.from(selected) : filteredAccounts.map((a) => a.id)
    const accountsById = new Map(accounts.map((a) => [a.id, a]))
    // Already-confirmed (last test passed) accounts are skipped — no need to re-test them.
    const ids = candidateIds.filter((id) => accountsById.get(id)?.last_test_success !== true)
    const alreadyConfirmed = candidateIds.length - ids.length
    if (ids.length === 0) {
      toast.success('Selected account(s) already passed a previous test — nothing to test.')
      return
    }
    setTestingIds((prev) => new Set([...prev, ...ids]))
    let passed = 0
    let failed = 0
    const queue = [...ids]
    const worker = async () => {
      while (queue.length > 0) {
        const id = queue.shift()
        if (id === undefined) break
        try {
          const result = await api.testSavedAccount(id)
          applyTestResult(id, result)
          if (result.overall_success) passed++
          else failed++
        } catch {
          failed++
        } finally {
          setTestingIds((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(3, ids.length) }, worker))
    const skipHint = alreadyConfirmed > 0 ? `, ${alreadyConfirmed} already confirmed & skipped` : ''
    if (failed > 0) {
      toast.error(`Test finished: ${passed} passed, ${failed} failed${skipHint}`)
    } else {
      toast.success(`Test finished: all ${passed} passed${skipHint}`)
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
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <h2 className="text-xl font-semibold">Accounts</h2>
          <div className="flex gap-2">
            {selected.size > 0 && (
              <Button variant="destructive" onClick={handleBulkDelete}>
                <Trash2 className="h-3.5 w-3.5" />
                Delete selected ({selected.size})
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={handleBulkTest}
              disabled={accounts.length === 0 || testingIds.size > 0}
            >
              {testingIds.size > 0
                ? 'Testing...'
                : selected.size > 0
                  ? `Test selected (${selected.size})`
                  : 'Test all'}
            </Button>
            <Button onClick={handleStartAll} disabled={accounts.length === 0}>
              {selected.size > 0 ? `Migrate selected (${selected.size})` : 'Migrate all'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="border-t border-border pt-4">
          <span className="mb-2 block text-sm font-semibold">Years to migrate</span>
          <div className="flex flex-wrap gap-2">
            {YEAR_OPTIONS.map((year) => (
              <label
                key={year}
                className={cn(
                  'flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium select-none',
                  selectedYears.has(year)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-muted/40 text-foreground',
                )}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={selectedYears.has(year)}
                  onChange={() => toggleYear(year)}
                />
                {year}
              </label>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {selectedYears.size > 0
              ? `Selected: ${[...selectedYears].sort((a, b) => a - b).join(', ')}`
              : 'If none selected, all mail will be migrated'}
          </p>
        </CardContent>
      </Card>

      <ManualAccountForm
        onSaved={(msg) => {
          toast.success(msg)
          load()
        }}
      />

      <CsvImport onImport={handleImport} />

      {rowTestResult && (
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold">Latest test result</h3>
          </CardHeader>
          <CardContent>
            <TestResults result={rowTestResult} />
          </CardContent>
        </Card>
      )}

      {loading && accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : accounts.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{emptyTabMessage.all}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/40',
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold',
                    activeTab === tab.id ? 'bg-white/25' : 'bg-muted',
                  )}
                >
                  {tabCounts[tab.id]}
                </span>
              </button>
            ))}
          </div>

          {filteredAccounts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {emptyTabMessage[activeTab]}
            </p>
          ) : (
            <Card className="overflow-hidden py-0">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeadCell className="w-8">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={
                          filteredAccounts.length > 0 &&
                          filteredAccounts.every((a) => selected.has(a.id))
                        }
                        onChange={toggleAll}
                      />
                    </TableHeadCell>
                    <TableHeadCell>Yandex email</TableHeadCell>
                    <TableHeadCell>cPanel email</TableHeadCell>
                    <TableHeadCell>cPanel IMAP host</TableHeadCell>
                    <TableHeadCell>Test</TableHeadCell>
                    <TableHeadCell>Migration</TableHeadCell>
                    <TableHeadCell>Added</TableHeadCell>
                    <TableHeadCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredAccounts.map((a) => (
                    <TableRow
                      key={a.id}
                      className={cn(
                        a.last_test_success === false && 'bg-red-50 dark:bg-red-500/10',
                      )}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={selected.has(a.id)}
                          onChange={() => toggleSelect(a.id)}
                        />
                      </TableCell>
                      <TableCell>{a.yandex_email}</TableCell>
                      <TableCell>{a.cpanel_email}</TableCell>
                      <TableCell>{a.cpanel_imap_host}</TableCell>
                      <TableCell>
                        {a.last_test_success !== null ? (
                          <span
                            title={[
                              `Yandex: ${a.last_test_yandex_message ?? '—'}`,
                              `cPanel: ${a.last_test_cpanel_message ?? '—'}`,
                              a.last_test_at ? `Tested: ${formatTrDateTime(a.last_test_at)}` : null,
                            ]
                              .filter(Boolean)
                              .join('\n')}
                          >
                            <Badge variant={a.last_test_success ? 'completed' : 'failed'}>
                              {a.last_test_success ? 'Passed' : 'Failed'}
                            </Badge>
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {a.latest_job_status ? (
                          <div className="flex flex-col items-start gap-1">
                            <Badge
                              variant={
                                a.latest_job_status as
                                  'pending' | 'running' | 'completed' | 'failed'
                              }
                            >
                              {STATUS_LABELS[a.latest_job_status] || a.latest_job_status}
                            </Badge>
                            {a.messages_transferred > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {a.messages_transferred} messages
                              </span>
                            )}
                            {a.latest_job_uuid && (
                              <Link to="/jobs" className="text-xs text-primary hover:underline">
                                {shortUuid(a.latest_job_uuid)}
                              </Link>
                            )}
                            {a.latest_job_status === 'failed' && a.latest_job_error && (
                              <span
                                className="block max-w-[280px] text-xs leading-snug break-words text-destructive"
                                title={a.latest_job_error}
                              >
                                {a.latest_job_error}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Not queued</span>
                        )}
                      </TableCell>
                      <TableCell>{formatTrDateTime(a.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex flex-nowrap gap-1.5">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleTestRow(a.id)}
                            disabled={testingIds.has(a.id)}
                          >
                            {testingIds.has(a.id) ? '...' : 'Test'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setFolderPickerAccount(a)}
                            disabled={
                              a.latest_job_status === 'pending' || a.latest_job_status === 'running'
                            }
                          >
                            <FolderCog className="h-3.5 w-3.5" />
                            Folders
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(a.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}

      {folderPickerAccount && (
        <FolderPickerModal
          account={folderPickerAccount}
          selectedYears={[...selectedYears].sort((a, b) => a - b)}
          onClose={() => setFolderPickerAccount(null)}
          onStarted={(msg) => {
            toast.success(msg)
            load()
          }}
        />
      )}

      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
    </div>
  )
}
