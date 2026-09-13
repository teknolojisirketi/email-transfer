import { Dialog, DialogBody, DialogFooter, DialogHeader } from './ui/dialog'
import { Button } from './ui/button'

export interface ConfirmDialogState {
  title: string
  description?: string
  confirmLabel?: string
  variant?: 'default' | 'destructive'
  onConfirm: () => void
}

export function ConfirmDialog({
  state,
  onClose,
}: {
  state: ConfirmDialogState | null
  onClose: () => void
}) {
  return (
    <Dialog open={state !== null} onClose={onClose} className="max-w-md">
      {state && (
        <>
          <DialogHeader title={state.title} onClose={onClose} />
          {state.description && (
            <DialogBody className="text-sm text-muted-foreground">{state.description}</DialogBody>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant={state.variant ?? 'default'}
              onClick={() => {
                state.onConfirm()
                onClose()
              }}
            >
              {state.confirmLabel ?? 'Confirm'}
            </Button>
          </DialogFooter>
        </>
      )}
    </Dialog>
  )
}
