'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

/**
 * The second question, for the actions that cannot be undone.
 *
 * The description carries the consequence in plain words rather than "are you
 * sure": what actually breaks is the only thing worth reading.
 */
export function ConfirmDialog({
  trigger,
  triggerLabel,
  title,
  description,
  confirmLabel,
  pending = false,
  onConfirm,
}: {
  /** The element the trigger renders as, e.g. `<Button variant="destructive" />`. */
  trigger: React.ReactElement<Record<string, unknown>>;
  triggerLabel: React.ReactNode;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  pending?: boolean;
  /** Resolve to close the dialog; reject or throw to leave it open. */
  onConfirm: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger}>{triggerLabel}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => {
              void onConfirm().then(
                () => setOpen(false),
                () => undefined,
              );
            }}
          >
            {pending ? 'Working…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
