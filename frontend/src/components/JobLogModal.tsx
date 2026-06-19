import { useEffect, useState } from 'react'
import { api, Job, JobLog } from '../api'

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
        const result = await api.getJobLog(job.id)
        if (active) setData(result)
      } catch {
        if (active) setData({ job_id: job.id, log: '', folders: [], messages_transferred: 0 })
      }
    }
    load()
    const interval = setInterval(load, job.status === 'running' ? 2000 : 10000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [job.id, job.status])

  const folders = data?.folders ?? []

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal card log-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            İş #{job.id} — {job.yandex_email}
            {data && data.messages_transferred > 0 && (
              <span className="log-msg-total"> ({data.messages_transferred} mesaj)</span>
            )}
          </h3>
          <button className="secondary small" onClick={onClose}>
            Kapat
          </button>
        </div>

        {folders.length > 0 ? (
          <div className="folder-progress-table-wrap">
            <table className="folder-progress-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Yandex Klasör</th>
                  <th>Durum</th>
                  <th>Kaynak</th>
                  <th>Kopyalanan</th>
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
                        {f.status === 'completed' ? 'Tamam' : 'Aktarılıyor'}
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
              ? 'Klasör listesi henüz oluşmadı, imapsync başlıyor...'
              : 'Klasör detayı logda bulunamadı.'}
          </p>
        )}

        <pre className="log-viewer">{data?.log || 'Log yükleniyor...'}</pre>
      </div>
    </div>
  )
}
