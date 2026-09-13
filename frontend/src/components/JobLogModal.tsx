import { useEffect, useState } from 'react'
import { api, Job, JobLog } from '../api'
import { shortUuid } from '../utils/uuid'
import { Dialog, DialogBody, DialogHeader } from './ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from './ui/table'
import { Badge } from './ui/badge'
import { cn } from '../lib/utils'

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
    (job.status === 'pending'
      ? 'Job has not started yet.'
      : job.status === 'running'
        ? 'Loading log...'
        : 'No log found.')

  return (
    <Dialog open onClose={onClose} className="max-w-3xl">
      <DialogHeader title={`Job ${shortUuid(job.uuid)} — ${job.yandex_email}`} onClose={onClose}>
        {data && data.messages_transferred > 0 && (
          <p className="text-xs text-muted-foreground">
            {data.messages_transferred} messages transferred
          </p>
        )}
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        {folders.length > 0 ? (
          <div className="max-h-56 overflow-y-auto rounded-md border border-border">
            <Table>
              <TableHead className="sticky top-0">
                <TableRow>
                  <TableHeadCell>#</TableHeadCell>
                  <TableHeadCell>Yandex folder</TableHeadCell>
                  <TableHeadCell>Status</TableHeadCell>
                  <TableHeadCell>Source</TableHeadCell>
                  <TableHeadCell>Copied</TableHeadCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {folders.map((f) => (
                  <TableRow
                    key={`${f.index}-${f.name}`}
                    className={cn(f.status === 'running' && 'bg-blue-50 dark:bg-blue-500/10')}
                  >
                    <TableCell>
                      {f.index}/{f.total}
                    </TableCell>
                    <TableCell>{f.name}</TableCell>
                    <TableCell>
                      <Badge variant={f.status === 'completed' ? 'completed' : 'running'}>
                        {f.status === 'completed' ? 'Done' : 'Copying'}
                      </Badge>
                    </TableCell>
                    <TableCell>{f.source_messages ?? '—'}</TableCell>
                    <TableCell>{f.transferred ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {job.status === 'running'
              ? 'Folder list not ready yet; imapsync is starting...'
              : job.status === 'pending'
                ? 'Job is waiting in queue.'
                : 'No folder details found in the log.'}
          </p>
        )}

        <pre className="max-h-96 overflow-auto rounded-md bg-[#1e1e1e] p-4 text-xs leading-relaxed whitespace-pre-wrap text-[#d4d4d4]">
          {logText}
        </pre>
      </DialogBody>
    </Dialog>
  )
}
