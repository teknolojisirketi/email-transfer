import { useEffect, useState } from 'react'
import { Job } from '../api'
import { formatElapsed } from '../utils/datetime'
import { STATUS_LABELS } from '../utils/status'

interface Props {
  job: Job
}

export default function JobProgress({ job }: Props) {
  const [elapsed, setElapsed] = useState('')

  useEffect(() => {
    if (job.status !== 'running' || !job.started_at) return
    const tick = () => setElapsed(formatElapsed(job.started_at!))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [job.status, job.started_at])

  return (
    <div className="job-progress">
      <span className={`status-badge status-${job.status}`}>
        {STATUS_LABELS[job.status] || job.status}
      </span>
      {job.messages_transferred > 0 && (
        <span className="msg-count">{job.messages_transferred} mesaj</span>
      )}
      {job.status === 'running' && (
        <span className="elapsed">
          {elapsed}
          <span className="running-hint"> — Kopyalama devam ediyor, büyük hesaplarda uzun sürebilir</span>
        </span>
      )}
      {job.error_message && (
        <span className="error-text" title={job.error_message}>
          {job.error_message.slice(0, 80)}
        </span>
      )}
    </div>
  )
}
