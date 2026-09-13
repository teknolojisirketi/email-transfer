import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button } from './ui/button'
import { applyTheme, getStoredTheme } from '../lib/theme'

export function ThemeToggle() {
  const [theme, setTheme] = useState(getStoredTheme)

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}
