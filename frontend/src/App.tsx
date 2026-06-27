import { BrowserRouter, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import RequireAuth from './components/RequireAuth'
import Accounts from './pages/Accounts'
import Jobs from './pages/Jobs'
import Login from './pages/Login'
import SettingsPage from './pages/Settings'
import { clearToken } from './auth'
import './index.css'

function AppShell() {
  const navigate = useNavigate()

  const logout = () => {
    clearToken()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <div>
            <h1>Email Transfer</h1>
            <p className="subtitle">Yandex → cPanel email migration</p>
          </div>
          <button type="button" className="secondary small logout-btn" onClick={logout}>
            Log out
          </button>
        </div>
        <nav>
          <NavLink to="/" end>
            Accounts
          </NavLink>
          <NavLink to="/jobs">Jobs</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Accounts />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
