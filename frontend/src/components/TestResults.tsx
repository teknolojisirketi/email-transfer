import { AccountTestResponse } from '../api'

export default function TestResults({ result }: { result: AccountTestResponse }) {
  return (
    <div className="test-results">
      <div className={`test-item ${result.yandex.success ? 'ok' : 'fail'}`}>
        <strong>Yandex:</strong> {result.yandex.message}
        {result.yandex.success && (
          <span>
            {' '}
            — {result.yandex.folder_count} folders, Inbox: {result.yandex.inbox_messages} messages
          </span>
        )}
      </div>
      <div className={`test-item ${result.cpanel.success ? 'ok' : 'fail'}`}>
        <strong>cPanel:</strong> {result.cpanel.message}
        {result.cpanel.success && (
          <span>
            {' '}
            — {result.cpanel.folder_count} folders, Inbox: {result.cpanel.inbox_messages} messages
          </span>
        )}
      </div>
    </div>
  )
}
