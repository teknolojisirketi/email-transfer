import { BrowserRouter, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { Inbox, ListChecks, LogOut, Mail, Settings as SettingsIcon } from 'lucide-react'
import RequireAuth from './components/RequireAuth'
import Accounts from './pages/Accounts'
import Jobs from './pages/Jobs'
import Login from './pages/Login'
import SettingsPage from './pages/Settings'
import { ThemeToggle } from './components/ThemeToggle'
import { Button } from './components/ui/button'
import { clearToken } from './auth'
import { cn } from './lib/utils'

const NAV_ITEMS = [
  { to: '/', label: 'Accounts', icon: Inbox, end: true },
  { to: '/jobs', label: 'Jobs', icon: ListChecks, end: false },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, end: false },
]

function NavLinks({ orientation }: { orientation: 'vertical' | 'horizontal' }) {
  return (
    <>
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              orientation === 'horizontal' && 'shrink-0',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
            )
          }
        >
          <Icon className="h-4 w-4" />
          {label}
        </NavLink>
      ))}
    </>
  )
}

function AppShell() {
  const navigate = useNavigate()

  const logout = () => {
    clearToken()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
        <div className="flex items-center gap-2 px-4 py-4">
          <Mail className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-semibold leading-none">Email Transfer</p>
            <p className="mt-1 text-xs text-muted-foreground">Yandex → cPanel</p>
          </div>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          <NavLinks orientation="vertical" />
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-6">
          <nav className="flex min-w-0 gap-1 overflow-x-auto md:hidden">
            <NavLinks orientation="horizontal" />
          </nav>
          <span className="hidden text-sm font-medium text-muted-foreground md:block">
            Migration panel
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4" />
              Log out
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Routes>
            <Route path="/" element={<Accounts />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
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
