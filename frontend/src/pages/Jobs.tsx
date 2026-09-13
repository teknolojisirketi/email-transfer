import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { RefreshCw, Trash2 } from 'lucide-react'
import { api, Job } from '../api'
import JobLogModal from '../components/JobLogModal'
import JobProgress from '../components/JobProgress'
import { ConfirmDialog, ConfirmDialogState } from '../components/ConfirmDialog'
import { formatTrDateTime } from '../utils/datetime'
import { shortUuid } from '../utils/uuid'
import { formatFoldersLabel } from '../utils/folders'
import { formatYearsLabel } from '../utils/years'
import { Card } from '../components/ui/card'
import { Button } from '../components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
} from '../components/ui/table'

export default function Jobs() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmState, setConfirmState] = useState<ConfirmDialogState | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    try {
      setJobs(await api.getJobs())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [load])

  const retry = async (uuid: string) => {
    await api.retryJob(uuid)
    load()
  }

  const handleCancel = (job: Job) => {
    const label = `${job.yandex_email} → ${job.cpanel_email}`
    const hint =
      job.status === 'running'
        ? ' The migration may stop mid-way; you can retry afterwards.'
        : ' It will be removed from the queue.'
    setConfirmState({
      title: `Cancel job ${shortUuid(job.uuid)}?`,
      description: `${label}.${hint}`,
      confirmLabel: 'Cancel job',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await api.cancelJob(job.uuid)
          if (selectedJob?.uuid === job.uuid) {
            setSelectedJob({ ...selectedJob, status: 'failed', error_message: 'Cancelled by user' })
          }
          toast.success(`Job ${shortUuid(job.uuid)} cancelled. Use Retry to start again.`)
          load()
        } catch (e) {
          toast.error(String(e))
        }
      },
    })
  }

  const handleDelete = (job: Job) => {
    if (job.status === 'running') {
      toast.error('Cannot delete a running job. Cancel it first.')
      return
    }
    const label = `${job.yandex_email} → ${job.cpanel_email}`
    setConfirmState({
      title: `Delete job ${shortUuid(job.uuid)}?`,
      description: `${label}.${job.status === 'pending' ? ' It will also be removed from the queue.' : ''}`,
      confirmLabel: 'Delete',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await api.deleteJob(job.uuid)
          if (selectedJob?.uuid === job.uuid) setSelectedJob(null)
          toast.success(`Job ${shortUuid(job.uuid)} deleted.`)
          load()
        } catch (e) {
          toast.error(String(e))
        }
      },
    })
  }

  const toggleSelect = (uuid: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(uuid)) next.delete(uuid)
      else next.add(uuid)
      return next
    })
  }

  const toggleAll = () => {
    const visibleUuids = jobs.map((j) => j.uuid)
    const allVisibleSelected =
      visibleUuids.length > 0 && visibleUuids.every((uuid) => selected.has(uuid))
    if (allVisibleSelected) {
      setSelected((prev) => {
        const next = new Set(prev)
        visibleUuids.forEach((uuid) => next.delete(uuid))
        return next
      })
    } else {
      setSelected((prev) => new Set([...prev, ...visibleUuids]))
    }
  }

  const handleBulkDelete = () => {
    const uuids = Array.from(selected)
    if (uuids.length === 0) return
    setConfirmState({
      title: `Delete ${uuids.length} job(s)?`,
      description: 'Running jobs will be skipped. This cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          const result = await api.bulkDeleteJobs(uuids)
          toast.success(
            `${result.deleted} job(s) deleted${result.skipped ? `, ${result.skipped} running job(s) skipped` : ''}`,
          )
          setSelected(new Set())
          if (selectedJob && uuids.includes(selectedJob.uuid)) setSelectedJob(null)
          load()
        } catch (e) {
          toast.error(String(e))
        }
      },
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Jobs</h2>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <Button variant="destructive" onClick={handleBulkDelete}>
              <Trash2 className="h-3.5 w-3.5" />
              Delete selected ({selected.size})
            </Button>
          )}
          <Button variant="secondary" onClick={load}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {loading && jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : jobs.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No jobs yet. Start a migration from the Accounts page.
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
                    checked={jobs.length > 0 && jobs.every((j) => selected.has(j.uuid))}
                    onChange={toggleAll}
                  />
                </TableHeadCell>
                <TableHeadCell>ID</TableHeadCell>
                <TableHeadCell>Yandex → cPanel</TableHeadCell>
                <TableHeadCell>Status</TableHeadCell>
                <TableHeadCell>Years</TableHeadCell>
                <TableHeadCell>Folders</TableHeadCell>
                <TableHeadCell>Started</TableHeadCell>
                <TableHeadCell>Finished</TableHeadCell>
                <TableHeadCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.uuid}>
                  <TableCell>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={selected.has(job.uuid)}
                      onChange={() => toggleSelect(job.uuid)}
                    />
                  </TableCell>
                  <TableCell title={job.uuid}>{shortUuid(job.uuid)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5 text-xs">
                      <span>{job.yandex_email}</span>
                      <span className="text-muted-foreground">→</span>
                      <span>{job.cpanel_email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <JobProgress job={job} />
                  </TableCell>
                  <TableCell>{formatYearsLabel(job.migrate_years) ?? 'All'}</TableCell>
                  <TableCell title={formatFoldersLabel(job.migrate_folders) ?? undefined}>
                    {formatFoldersLabel(job.migrate_folders) ?? 'All'}
                  </TableCell>
                  <TableCell>{formatTrDateTime(job.started_at)}</TableCell>
                  <TableCell>{formatTrDateTime(job.finished_at)}</TableCell>
                  <TableCell>
                    <div className="flex flex-nowrap gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => setSelectedJob(job)}>
                        Log
                      </Button>
                      {(job.status === 'pending' || job.status === 'running') && (
                        <Button size="sm" variant="destructive" onClick={() => handleCancel(job)}>
                          Cancel
                        </Button>
                      )}
                      {job.status === 'failed' && (
                        <Button size="sm" onClick={() => retry(job.uuid)}>
                          Retry
                        </Button>
                      )}
                      {job.status === 'completed' && (
                        <Button size="sm" variant="secondary" onClick={() => retry(job.uuid)}>
                          Migrate again
                        </Button>
                      )}
                      {job.status !== 'running' && (
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(job)}>
                          Delete
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {selectedJob && <JobLogModal job={selectedJob} onClose={() => setSelectedJob(null)} />}
      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
    </div>
  )
}
