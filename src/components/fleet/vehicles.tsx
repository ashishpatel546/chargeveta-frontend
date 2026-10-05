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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { FleetMember, Vehicle, VehicleInput } from '@/lib/api/fleet-types';
import { ActiveBadge } from './billing-badge';

const NO_DRIVER = '__none__';

function memberName(member: FleetMember): string {
  return member.name ?? member.email ?? member.phone ?? member.driverId;
}

/**
 * A fleet's vehicles — tracking records only, by the owner's decision: the
 * driver's own card still starts the charge.
 */
export function VehiclesTable({
  vehicles,
  members,
  actions,
}: {
  vehicles: Vehicle[];
  members: FleetMember[];
  actions?: (vehicle: Vehicle) => React.ReactNode;
}) {
  const names = new Map(members.map((m) => [m.driverId, memberName(m)]));
  return (
    <div className="bg-card overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Registration</TableHead>
            <TableHead>Label</TableHead>
            <TableHead>Make and model</TableHead>
            <TableHead>Driver</TableHead>
            <TableHead>Status</TableHead>
            {actions ? <TableHead /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {vehicles.map((vehicle) => (
            <TableRow key={vehicle.id}>
              <TableCell className="font-mono font-medium">
                {vehicle.registration}
              </TableCell>
              <TableCell className="text-sm">{vehicle.label ?? '—'}</TableCell>
              <TableCell className="text-sm">{vehicle.makeModel ?? '—'}</TableCell>
              <TableCell className="text-sm">
                {vehicle.driverId ? (names.get(vehicle.driverId) ?? '—') : '—'}
              </TableCell>
              <TableCell>
                <ActiveBadge active={vehicle.isActive} />
              </TableCell>
              {actions ? (
                <TableCell className="text-right">{actions(vehicle)}</TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Adds a vehicle, or changes one. The registration is set once: the API
 * normalises it (upper case, no spaces or dashes) and refuses a duplicate
 * across the whole operator, not only this fleet.
 */
export function VehicleDialog({
  vehicle,
  members,
  onSave,
  trigger,
  triggerLabel,
}: {
  vehicle?: Vehicle;
  members: FleetMember[];
  /** Resolve to close the dialog; reject to keep it open. */
  onSave: (input: VehicleInput) => Promise<unknown>;
  trigger: React.ReactElement<Record<string, unknown>>;
  triggerLabel: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [registration, setRegistration] = useState('');
  const [label, setLabel] = useState('');
  const [makeModel, setMakeModel] = useState('');
  const [driverId, setDriverId] = useState(NO_DRIVER);
  const [isActive, setIsActive] = useState(true);
  const [pending, setPending] = useState(false);

  function reset() {
    setRegistration(vehicle?.registration ?? '');
    setLabel(vehicle?.label ?? '');
    setMakeModel(vehicle?.makeModel ?? '');
    setDriverId(vehicle?.driverId ?? NO_DRIVER);
    setIsActive(vehicle?.isActive ?? true);
  }

  async function save() {
    const driver = driverId === NO_DRIVER ? null : driverId;
    const input: VehicleInput = vehicle
      ? {
          label: label.trim() || null,
          makeModel: makeModel.trim() || null,
          driverId: driver,
          isActive,
        }
      : {
          registration: registration.trim(),
          ...(label.trim() ? { label: label.trim() } : {}),
          ...(makeModel.trim() ? { makeModel: makeModel.trim() } : {}),
          ...(driver ? { driverId: driver } : {}),
        };
    setPending(true);
    try {
      await onSave(input);
      setOpen(false);
    } catch {
      // The caller has said why; the dialog stays open to fix it.
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {vehicle ? `Change ${vehicle.registration}` : 'Add a vehicle'}
          </DialogTitle>
          <DialogDescription>
            A record for tracking. Charging still starts with the driver&apos;s
            own card.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {vehicle ? null : (
            <div className="space-y-2">
              <Label htmlFor="vehicle-registration">Registration</Label>
              <Input
                id="vehicle-registration"
                value={registration}
                onChange={(event) => setRegistration(event.target.value)}
                placeholder="MH12AB1234"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="vehicle-label">Label (optional)</Label>
            <Input
              id="vehicle-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Van 12"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vehicle-make">Make and model (optional)</Label>
            <Input
              id="vehicle-make"
              value={makeModel}
              onChange={(event) => setMakeModel(event.target.value)}
              placeholder="Tata Ace EV"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vehicle-driver">Driver (optional)</Label>
            <Select
              value={driverId}
              onValueChange={(value) => setDriverId(value ?? NO_DRIVER)}
              // Labels for the trigger before the list has ever opened;
              // without them it shows the driver's id.
              items={[
                { value: NO_DRIVER, label: 'No driver' },
                ...members.map((member) => ({
                  value: member.driverId,
                  label: memberName(member),
                })),
              ]}
            >
              <SelectTrigger id="vehicle-driver" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_DRIVER}>No driver</SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.driverId} value={member.driverId}>
                    {memberName(member)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Only a driver in this fleet.
            </p>
          </div>
          {vehicle ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
              />
              In service
            </label>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            onClick={() => void save()}
            disabled={pending || (!vehicle && registration.trim().length === 0)}
          >
            {pending ? 'Saving…' : vehicle ? 'Save' : 'Add vehicle'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
