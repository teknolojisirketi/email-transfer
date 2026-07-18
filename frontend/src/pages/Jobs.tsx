import { useCallback, useEffect, useState } from 'react'
import { api, Job } from '../api'
import JobLogModal from '../components/JobLogModal'
import JobProgress from '../components/JobProgress'
import { formatTrDateTime } from '../utils/datetime'
import { shortUuid } from '../utils/uuid'
import { formatFoldersLabel } from '../utils/folders'
import { formatYearsLabel } from '../utils/years'

export default function Jobs() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

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

  const handleCancel = async (job: Job) => {
    const label = `${job.yandex_email} → ${job.cpanel_email}`
    const hint =
      job.status === 'running'
        ? ' The migration may stop mid-way; you can retry afterwards.'
        : ' It will be removed from the queue.'
    if (!confirm(`Cancel job ${shortUuid(job.uuid)} (${label})?${hint}`)) {
      return
    }
    try {
      await api.cancelJob(job.uuid)
      if (selectedJob?.uuid === job.uuid) {
        setSelectedJob({ ...selectedJob, status: 'failed', error_message: 'Cancelled by user' })
      }
      setMessage(`Job ${shortUuid(job.uuid)} cancelled. Use Retry to start again.`)
      load()
    } catch (e) {
      setMessage(String(e))
    }
  }

  const handleDelete = async (job: Job) => {
    if (job.status === 'running') {
      setMessage('Cannot delete a running job. Cancel it first.')
      return
    }
    const label = `${job.yandex_email} → ${job.cpanel_email}`
    if (!confirm(`Delete job ${shortUuid(job.uuid)} (${label})?${job.status === 'pending' ? ' It will also be removed from the queue.' : ''}`)) {
      return
    }
    try {
      await api.deleteJob(job.uuid)
      if (selectedJob?.uuid === job.uuid) setSelectedJob(null)
      setMessage(`Job ${shortUuid(job.uuid)} deleted.`)
      load()
    } catch (e) {
      setMessage(String(e))
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Jobs</h2>
        <button className="secondary" onClick={load}>
          Refresh
        </button>
      </div>

      {message && <div className="alert">{message}</div>}

      {loading && jobs.length === 0 ? (
        <p>Loading...</p>
      ) : jobs.length === 0 ? (
        <p className="empty">No jobs yet. Start a migration from the Accounts page.</p>
      ) : (
        <div className="table-wrap card">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Yandex → cPanel</th>
                <th>Status</th>
                <th>Years</th>
                <th>Folders</th>
                <th>Started</th>
                <th>Finished</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.uuid}>
                  <td title={job.uuid}>{shortUuid(job.uuid)}</td>
                  <td>
                    <div className="email-pair">
                      <span>{job.yandex_email}</span>
                      <span className="arrow">→</span>
                      <span>{job.cpanel_email}</span>
                    </div>
                  </td>
                  <td>
                    <JobProgress job={job} />
                  </td>
                  <td>{formatYearsLabel(job.migrate_years) ?? 'All'}</td>
                  <td title={formatFoldersLabel(job.migrate_folders) ?? undefined}>
                    {formatFoldersLabel(job.migrate_folders) ?? 'All'}
                  </td>
                  <td>{formatTrDateTime(job.started_at)}</td>
                  <td>{formatTrDateTime(job.finished_at)}</td>
                  <td className="row-actions">
                    <button className="small secondary" onClick={() => setSelectedJob(job)}>
                      Log
                    </button>
                    {(job.status === 'pending' || job.status === 'running') && (
                      <button className="small danger" onClick={() => handleCancel(job)}>
                        Cancel
                      </button>
                    )}
                    {job.status === 'failed' && (
                      <button className="small" onClick={() => retry(job.uuid)}>
                        Retry
                      </button>
                    )}
                    {job.status === 'completed' && (
                      <button className="small secondary" onClick={() => retry(job.uuid)}>
                        Migrate again
                      </button>
                    )}
                    {job.status !== 'running' && (
                      <button className="small danger" onClick={() => handleDelete(job)}>
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedJob && <JobLogModal job={selectedJob} onClose={() => setSelectedJob(null)} />}
    </div>
  )
}
