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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { BillingMode, Fleet } from '@/lib/api/fleet-types';

/**
 * The owner's three billing choices (`charveta` doc 6 §23), as one pick
 * rather than a mode and a flag that only half-combine.
 */
const BILLING_CHOICES: {
  value: string;
  mode: BillingMode;
  collects: boolean;
  title: string;
  detail: string;
}[] = [
  {
    value: 'driver_pays',
    mode: 'driver_pays',
    collects: true,
    title: 'Drivers pay',
    detail: 'Each driver pays for their own sessions, as any driver does.',
  },
  {
    value: 'statement',
    mode: 'fleet_invoice',
    collects: true,
    title: 'Monthly statement, drivers pay each session',
    detail:
      'Drivers still pay at the session; the fleet gets a monthly summary of them.',
  },
  {
    value: 'invoice',
    mode: 'fleet_invoice',
    collects: false,
    title: 'Monthly invoice, fleet pays',
    detail:
      'Nothing is taken from drivers at charge time, and they need no wallet balance to start. The fleet owes it all.',
  },
];

function choiceOf(fleet?: Fleet): string {
  if (!fleet || fleet.billingMode === 'driver_pays') return 'driver_pays';
  return fleet.invoiceCollectsAtSession ? 'statement' : 'invoice';
}

export interface FleetInput {
  name: string;
  legalName: string | null;
  gstin: string | null;
  billingEmail: string | null;
  billingMode: BillingMode;
  invoiceCollectsAtSession: boolean;
  isActive?: boolean;
}

/**
 * Creates a fleet, or changes one. A change of billing applies to sessions
 * settled from now on; a session already settled keeps what it was settled
 * under.
 */
export function FleetDialog({
  fleet,
  onSave,
  trigger,
  triggerLabel,
}: {
  fleet?: Fleet;
  /** Resolve to close; reject to keep the dialog open. */
  onSave: (input: FleetInput) => Promise<unknown>;
  trigger: React.ReactElement<Record<string, unknown>>;
  triggerLabel: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [gstin, setGstin] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [choice, setChoice] = useState('driver_pays');
  const [isActive, setIsActive] = useState(true);
  const [pending, setPending] = useState(false);

  function reset() {
    setName(fleet?.name ?? '');
    setLegalName(fleet?.legalName ?? '');
    setGstin(fleet?.gstin ?? '');
    setBillingEmail(fleet?.billingEmail ?? '');
    setChoice(choiceOf(fleet));
    setIsActive(fleet?.isActive ?? true);
  }

  async function save() {
    const picked = BILLING_CHOICES.find((c) => c.value === choice)!;
    setPending(true);
    try {
      await onSave({
        name: name.trim(),
        legalName: legalName.trim() || null,
        gstin: gstin.trim().toUpperCase() || null,
        billingEmail: billingEmail.trim() || null,
        billingMode: picked.mode,
        invoiceCollectsAtSession: picked.collects,
        ...(fleet ? { isActive } : {}),
      });
      setOpen(false);
    } catch {
      // The caller has said why.
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) reset();
        setOpen(next);
      }}
    >
      <DialogTrigger render={trigger}>{triggerLabel}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{fleet ? `Change ${fleet.name}` : 'Add a fleet'}</DialogTitle>
          <DialogDescription>
            A company whose drivers charge on your network with their own
            cards.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label htmlFor="fleet-name">Name</Label>
            <Input
              id="fleet-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Tata EV"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fleet-legal">Legal name (optional)</Label>
              <Input
                id="fleet-legal"
                value={legalName}
                onChange={(event) => setLegalName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fleet-gstin">GSTIN (optional)</Label>
              <Input
                id="fleet-gstin"
                value={gstin}
                onChange={(event) => setGstin(event.target.value)}
                spellCheck={false}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fleet-email">Billing email (optional)</Label>
            <Input
              id="fleet-email"
              type="email"
              value={billingEmail}
              onChange={(event) => setBillingEmail(event.target.value)}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Who pays</legend>
            {BILLING_CHOICES.map((option) => (
              <label
                key={option.value}
                className="has-checked:border-foreground flex cursor-pointer gap-3 rounded-md border p-3"
              >
                <input
                  type="radio"
                  name="fleet-billing"
                  value={option.value}
                  checked={choice === option.value}
                  onChange={() => setChoice(option.value)}
                  className="mt-1"
                />
                <span className="space-y-0.5">
                  <span className="block text-sm font-medium">{option.title}</span>
                  <span className="text-muted-foreground block text-xs">
                    {option.detail}
                  </span>
                </span>
              </label>
            ))}
            {fleet ? (
              <p className="text-muted-foreground text-xs">
                A change applies to sessions settled from now on. Sessions
                already settled keep the choice they were settled under.
              </p>
            ) : null}
          </fieldset>

          {fleet ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
              />
              Active. Deactivating signs out every manager of the fleet, and
              its drivers pay for themselves again.
            </label>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            onClick={() => void save()}
            disabled={pending || name.trim().length === 0}
          >
            {pending ? 'Saving…' : fleet ? 'Save' : 'Add fleet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
