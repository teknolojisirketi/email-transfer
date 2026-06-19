import { ReactNode, useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { api } from '../api'
import { getToken } from '../auth'

export default function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [ready, setReady] = useState(false)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setAuthed(false)
      setReady(true)
      return
    }
    api
      .me()
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false))
      .finally(() => setReady(true))
  }, [location.pathname])

  if (!ready) {
    return (
      <div className="app">
        <p className="loading-center">Yükleniyor...</p>
      </div>
    )
  }

  if (!authed) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
