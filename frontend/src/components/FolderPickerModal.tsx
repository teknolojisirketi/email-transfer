import { useEffect, useState } from 'react'
import { api, Account, AccountFolderItem } from '../api'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from './ui/dialog'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

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
      const folderList = folders.map((folder) => folder.name).filter((name) => selected.has(name))
      const years = selectedYears.length > 0 ? selectedYears : undefined
      const result = await api.startMigration([account.id], years, folderList)
      const yearHint = years?.length ? `, years: ${years.join(', ')}` : ''
      const folderHint =
        folderList.length === folders.length ? 'all folders' : `${folderList.length} folder(s)`
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
    <Dialog open onClose={onClose} className="max-w-lg">
      <DialogHeader title={`Select folders — ${account.yandex_email}`} onClose={onClose} />
      <DialogBody className="flex flex-col gap-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading folders from Yandex...</p>
        ) : error && folders.length === 0 ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                {selected.size} / {folders.length} selected
              </span>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => setAll(true)}>
                  Select all
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => setAll(false)}>
                  Clear
                </Button>
              </div>
            </div>

            <div className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-md border border-border bg-muted/30 p-2">
              {folders.map((folder) => (
                <label
                  key={folder.name}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-secondary"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={selected.has(folder.name)}
                    onChange={() => toggleFolder(folder.name)}
                  />
                  <span className="min-w-0 flex-1 break-words text-sm">{folder.name}</span>
                  {folder.is_standard && <Badge variant="secondary">standard</Badge>}
                </label>
              ))}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </>
        )}
      </DialogBody>
      {!loading && folders.length > 0 && (
        <DialogFooter>
          <Button onClick={handleStart} disabled={starting || selected.size === 0}>
            {starting ? 'Starting...' : 'Start migration'}
          </Button>
        </DialogFooter>
      )}
    </Dialog>
  )
}
