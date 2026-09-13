import { CheckCircle2, XCircle } from 'lucide-react'
import { AccountTestResponse } from '../api'
import { cn } from '../lib/utils'

function ResultRow({
  label,
  success,
  message,
  folderCount,
  inboxMessages,
}: {
  label: string
  success: boolean
  message: string
  folderCount: number
  inboxMessages: number
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-md border px-3 py-2 text-sm',
        success
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400'
          : 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400',
      )}
    >
      {success ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <div>
        <strong>{label}:</strong> {message}
        {success && (
          <span>
            {' '}
            — {folderCount} folders, Inbox: {inboxMessages} messages
          </span>
        )}
      </div>
    </div>
  )
}

export default function TestResults({ result }: { result: AccountTestResponse }) {
  return (
    <div className="flex flex-col gap-2">
      <ResultRow
        label="Yandex"
        success={result.yandex.success}
        message={result.yandex.message}
        folderCount={result.yandex.folder_count}
        inboxMessages={result.yandex.inbox_messages}
      />
      <ResultRow
        label="cPanel"
        success={result.cpanel.success}
        message={result.cpanel.message}
        folderCount={result.cpanel.folder_count}
        inboxMessages={result.cpanel.inbox_messages}
      />
    </div>
  )
}
