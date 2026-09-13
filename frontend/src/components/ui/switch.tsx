import { InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '../../lib/utils'

export type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(({ className, ...props }, ref) => (
  <label className={cn('relative inline-flex h-5 w-9 shrink-0 cursor-pointer', className)}>
    <input ref={ref} type="checkbox" className="peer sr-only" {...props} />
    <span
      className={cn(
        'absolute inset-0 rounded-full bg-secondary transition-colors',
        'peer-checked:bg-primary',
        'peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2',
        'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
      )}
    />
    <span
      className={cn(
        'pointer-events-none absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
        'peer-checked:translate-x-4',
      )}
    />
  </label>
))
Switch.displayName = 'Switch'
