import { Job } from '../api'
import { formatElapsed } from '../utils/datetime'
import { STATUS_LABELS } from '../utils/status'

interface Props {
  job: Job
  compact?: boolean
}

export default function JobProgress({ job, compact = false }: Props) {
  const elapsed =
    job.status === 'running' && job.started_at
      ? formatElapsed(job.started_at)
      : ''

  return (
    <div className="job-progress">
      <span className={`status-badge status-${job.status}`}>
        {STATUS_LABELS[job.status] || job.status}
      </span>
      {job.messages_transferred > 0 && (
        <span className="msg-count">{job.messages_transferred} messages</span>
      )}
      {job.status === 'running' && elapsed && (
        <span className="elapsed">
          {elapsed}
          {!compact && (
            <span className="running-hint"> — Copying in progress; large mailboxes may take a long time</span>
          )}
        </span>
      )}
      {job.status === 'failed' && (
        <span className="error-text job-error-detail" title={job.error_message || undefined}>
          {job.error_message || 'Unknown error'}
        </span>
      )}
    </div>
  )
}
