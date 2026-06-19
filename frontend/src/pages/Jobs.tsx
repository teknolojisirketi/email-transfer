import { useCallback, useEffect, useState } from 'react'
import { api, Job } from '../api'
import JobLogModal from '../components/JobLogModal'
import JobProgress from '../components/JobProgress'
import { formatTrDateTime } from '../utils/datetime'

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

  const retry = async (id: number) => {
    await api.retryJob(id)
    load()
  }

  const handleDelete = async (job: Job) => {
    if (job.status === 'running') {
      setMessage('Çalışan iş silinemez.')
      return
    }
    const label = `${job.yandex_email} → ${job.cpanel_email}`
    if (!confirm(`İş #${job.id} (${label}) silinsin mi?${job.status === 'pending' ? ' Kuyruktan da kaldırılacak.' : ''}`)) {
      return
    }
    try {
      await api.deleteJob(job.id)
      if (selectedJob?.id === job.id) setSelectedJob(null)
      setMessage(`İş #${job.id} silindi.`)
      load()
    } catch (e) {
      setMessage(String(e))
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>İşler</h2>
        <button className="secondary" onClick={load}>
          Yenile
        </button>
      </div>

      {message && <div className="alert">{message}</div>}

      {loading && jobs.length === 0 ? (
        <p>Yükleniyor...</p>
      ) : jobs.length === 0 ? (
        <p className="empty">Henüz iş yok. Hesaplar sayfasından taşımayı başlatın.</p>
      ) : (
        <div className="table-wrap card">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Yandex → cPanel</th>
                <th>Durum</th>
                <th>Başlangıç</th>
                <th>Bitiş</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td>{job.id}</td>
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
                  <td>{formatTrDateTime(job.started_at)}</td>
                  <td>{formatTrDateTime(job.finished_at)}</td>
                  <td className="row-actions">
                    <button className="small secondary" onClick={() => setSelectedJob(job)}>
                      Log
                    </button>
                    {(job.status === 'failed' || job.status === 'completed') && (
                      <button className="small" onClick={() => retry(job.id)}>
                        Yeniden Dene
                      </button>
                    )}
                    {job.status !== 'running' && (
                      <button className="small danger" onClick={() => handleDelete(job)}>
                        Sil
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
