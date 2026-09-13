import { Job } from '../api'
import { formatElapsed } from '../utils/datetime'
import { STATUS_LABELS } from '../utils/status'
import { Badge } from './ui/badge'

interface Props {
  job: Job
  compact?: boolean
}

export default function JobProgress({ job, compact = false }: Props) {
  const elapsed = job.status === 'running' && job.started_at ? formatElapsed(job.started_at) : ''

  return (
    <div className="flex flex-col items-start gap-1">
      <Badge variant={job.status as 'pending' | 'running' | 'completed' | 'failed'}>
        {STATUS_LABELS[job.status] || job.status}
      </Badge>
      {job.messages_transferred > 0 && (
        <span className="text-xs text-muted-foreground">{job.messages_transferred} messages</span>
      )}
      {job.status === 'running' && elapsed && (
        <span className="text-xs text-muted-foreground">
          {elapsed}
          {!compact && (
            <span className="text-muted-foreground/70">
              {' '}
              — Copying in progress; large mailboxes may take a long time
            </span>
          )}
        </span>
      )}
      {job.status === 'failed' && (
        <span
          className="block max-w-[280px] text-xs leading-snug break-words text-destructive"
          title={job.error_message || undefined}
        >
          {job.error_message || 'Unknown error'}
        </span>
      )}
    </div>
  )
}
