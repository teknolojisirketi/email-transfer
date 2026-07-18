import { useEffect, useState } from 'react'
import { api, Account, AccountFolderItem } from '../api'

interface Props {
  account: Account
  selectedYears: number[]
  onClose: () => void
  onStarted: (message: string) => void
}

export default function FolderPickerModal({ account, selectedYears, onClose, onStarted }: Props) {
  const [folders, setFolders] = useState<AccountFolderItem[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await api.getAccountFolders(account.id)
        if (!active) return
        setFolders(result.folders)
        setSelected(new Set(result.folders.map((folder) => folder.name)))
      } catch (e) {
        if (active) setError(String(e))
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [account.id])

  const toggleFolder = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const setAll = (checked: boolean) => {
    if (checked) {
      setSelected(new Set(folders.map((folder) => folder.name)))
    } else {
      setSelected(new Set())
    }
  }

  const handleStart = async () => {
    if (selected.size === 0) {
      setError('Select at least one folder.')
      return
    }
    setStarting(true)
    setError('')
    try {
      const folderList = folders
        .map((folder) => folder.name)
        .filter((name) => selected.has(name))
      const years = selectedYears.length > 0 ? selectedYears : undefined
      const result = await api.startMigration([account.id], years, folderList)
      const yearHint = years?.length ? `, years: ${years.join(', ')}` : ''
      const folderHint =
        folderList.length === folders.length
          ? 'all folders'
          : `${folderList.length} folder(s)`
      onStarted(
        result.jobs_created > 0
          ? `Migration queued for ${account.yandex_email} (${folderHint}${yearHint})`
          : 'No job created — account may already have an active migration.',
      )
      onClose()
    } catch (e) {
      setError(String(e))
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal folder-modal card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Select folders — {account.yandex_email}</h3>
          <button className="secondary small" onClick={onClose}>
            Close
          </button>
        </div>

        {loading ? (
          <p className="folder-modal-status">Loading folders from Yandex...</p>
        ) : error && folders.length === 0 ? (
          <p className="error-text folder-modal-status">{error}</p>
        ) : (
          <>
            <div className="folder-modal-toolbar">
              <span className="muted">
                {selected.size} / {folders.length} selected
              </span>
              <div className="folder-modal-actions">
                <button type="button" className="small secondary" onClick={() => setAll(true)}>
                  Select all
                </button>
                <button type="button" className="small secondary" onClick={() => setAll(false)}>
                  Clear
                </button>
              </div>
            </div>

            <div className="folder-list">
              {folders.map((folder) => (
                <label key={folder.name} className="folder-list-item">
                  <input
                    type="checkbox"
                    checked={selected.has(folder.name)}
                    onChange={() => toggleFolder(folder.name)}
                  />
                  <span className="folder-list-name">{folder.name}</span>
                  {folder.is_standard && <span className="folder-tag">standard</span>}
                </label>
              ))}
            </div>

            {error && <p className="error-text">{error}</p>}

            <div className="folder-modal-footer">
              <button onClick={handleStart} disabled={starting || selected.size === 0}>
                {starting ? 'Starting...' : 'Start migration'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
