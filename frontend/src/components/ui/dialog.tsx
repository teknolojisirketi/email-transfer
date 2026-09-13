import { HTMLAttributes, ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './button'

interface DialogProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
}

export function Dialog({ open, onClose, children, className }: DialogProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          'flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg border border-border bg-card text-card-foreground shadow-lg',
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function DialogHeader({
  title,
  onClose,
  className,
  children,
}: {
  title: ReactNode
  onClose: () => void
  className?: string
  children?: ReactNode
}) {
  return (
    <div
      className={cn('flex items-start justify-between gap-3 border-b border-border p-4', className)}
    >
      <div className="min-w-0">
        <h3 className="text-base font-semibold">{title}</h3>
        {children}
      </div>
      <Button variant="ghost" size="icon" className="-mt-1 -mr-1 shrink-0" onClick={onClose}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}

export function DialogBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex-1 overflow-auto p-4', className)} {...props} />
}

export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex justify-end gap-2 border-t border-border p-4', className)}
      {...props}
    />
  )
}
