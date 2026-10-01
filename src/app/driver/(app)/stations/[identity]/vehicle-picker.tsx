'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { driverApiGet } from '@/lib/api/driver-client';
import type { DriverVehicleDto } from '@/lib/api/driver-types';

/**
 * Which car is being charged (doc 6 §23 "The driver picks the car"). A fleet
 * driver with several vehicles must pick one before starting — the API
 * refuses a start without it (`VEHICLE_REQUIRED`) — and the session records
 * it. One vehicle needs no choice; none, nothing is shown at all.
 *
 * The last car picked is remembered per driver in this browser, as the
 * default next time. Only a convenience: storage can be unavailable or
 * cleared, and the picker then simply starts empty.
 */

const storageKey = (driverId: string) => `cv.driver.lastVehicle.${driverId}`;

function rememberedVehicle(driverId: string): string | null {
  try {
    return window.localStorage.getItem(storageKey(driverId));
  } catch {
    return null;
  }
}

export function rememberVehicle(driverId: string, vehicleId: string): void {
  try {
    window.localStorage.setItem(storageKey(driverId), vehicleId);
  } catch {
    // Private window or blocked storage: no default next time, nothing else.
  }
}

export interface VehicleChoice {
  vehicles: DriverVehicleDto[];
  /** The vehicle to send with the start, or undefined for none. */
  vehicleId: string | undefined;
  /** False while the list loads, or while several wait for a pick. */
  ready: boolean;
  pick: (vehicleId: string) => void;
}

export function useVehicleChoice(driverId: string): VehicleChoice {
  const query = useQuery({
    queryKey: ['driver', 'vehicles'],
    queryFn: () => driverApiGet<DriverVehicleDto[]>('/driver/vehicles'),
  });
  const [picked, setPicked] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : rememberedVehicle(driverId),
  );

  const vehicles = query.data ?? [];
  let vehicleId: string | undefined;
  if (vehicles.length === 1) vehicleId = vehicles[0].id;
  else if (vehicles.length > 1) {
    // A remembered car no longer assigned is no default.
    vehicleId = vehicles.find((v) => v.id === picked)?.id;
  }
  // A failed list does not block a start: the API still decides, and says
  // so if a car was needed.
  const ready =
    query.isError ||
    (query.isSuccess && (vehicles.length <= 1 || vehicleId !== undefined));

  return { vehicles, vehicleId, ready, pick: setPicked };
}

export function VehiclePicker({ choice }: { choice: VehicleChoice }) {
  const { vehicles, vehicleId, pick } = choice;
  if (vehicles.length === 0) return null;

  if (vehicles.length === 1) {
    const only = vehicles[0];
    return (
      <Card size="sm">
        <CardContent className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Vehicle</span>
          <span className="min-w-0 truncate text-right">
            Charging <span className="font-medium">{only.registration}</span>
            {only.label ? (
              <span className="text-muted-foreground"> · {only.label}</span>
            ) : null}
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Which vehicle are you charging?</legend>
      {vehicles.map((vehicle) => (
        <label
          key={vehicle.id}
          className="has-checked:border-foreground flex min-h-11 cursor-pointer items-center gap-3 rounded-md border p-3"
        >
          <input
            type="radio"
            name="charging-vehicle"
            value={vehicle.id}
            checked={vehicleId === vehicle.id}
            onChange={() => pick(vehicle.id)}
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">
              {vehicle.registration}
            </span>
            {vehicle.label ? (
              <span className="text-muted-foreground block truncate text-xs">
                {vehicle.label}
              </span>
            ) : null}
          </span>
        </label>
      ))}
      {vehicleId === undefined ? (
        <p className="text-muted-foreground text-xs">
          Pick one to start. It is recorded on the session for your fleet.
        </p>
      ) : null}
    </fieldset>
  );
}
