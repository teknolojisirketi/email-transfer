import { useEffect, useState } from 'react'
import { api, Job, JobLog } from '../api'
import { shortUuid } from '../utils/uuid'

interface Props {
  job: Job
  onClose: () => void
}

export default function JobLogModal({ job, onClose }: Props) {
  const [data, setData] = useState<JobLog | null>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const result = await api.getJobLog(job.uuid)
        if (active) setData(result)
      } catch {
        if (active) setData({ job_uuid: job.uuid, log: '', folders: [], messages_transferred: 0 })
      }
    }
    load()
    const interval = setInterval(load, job.status === 'running' ? 2000 : 10000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [job.uuid, job.status])

  const folders = data?.folders ?? []
  const logText =
    data?.log ||
    (job.status === 'pending' ? 'Job has not started yet.' : job.status === 'running' ? 'Loading log...' : 'No log found.')

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal card log-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            Job {shortUuid(job.uuid)} — {job.yandex_email}
            {data && data.messages_transferred > 0 && (
              <span className="log-msg-total"> ({data.messages_transferred} messages)</span>
            )}
          </h3>
          <button className="secondary small" onClick={onClose}>
            Close
          </button>
        </div>

        {folders.length > 0 ? (
          <div className="folder-progress-table-wrap">
            <table className="folder-progress-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Yandex folder</th>
                  <th>Status</th>
                  <th>Source</th>
                  <th>Copied</th>
                </tr>
              </thead>
              <tbody>
                {folders.map((f) => (
                  <tr key={`${f.index}-${f.name}`} className={`folder-row-${f.status}`}>
                    <td>
                      {f.index}/{f.total}
                    </td>
                    <td>{f.name}</td>
                    <td>
                      <span className={`status-badge status-${f.status === 'completed' ? 'completed' : 'running'}`}>
                        {f.status === 'completed' ? 'Done' : 'Copying'}
                      </span>
                    </td>
                    <td>{f.source_messages ?? '—'}</td>
                    <td>{f.transferred ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="hint log-hint">
            {job.status === 'running'
              ? 'Folder list not ready yet; imapsync is starting...'
              : job.status === 'pending'
                ? 'Job is waiting in queue.'
                : 'No folder details found in the log.'}
          </p>
        )}

        <pre className="log-viewer">{logText}</pre>
      </div>
    </div>
  )
}
