/**
 * The API's fleet shapes (`charveta` doc 6 §23), shared by staff's fleet pages
 * in the console and the fleet manager's own portal (`/fleet`). Both read the
 * same DTOs; only the routes and the session differ.
 *
 * Money is minor units and energy watt-hours, as decimal strings — format with
 * `lib/format.ts` and never do arithmetic on them.
 */

import type { Kpi } from './types';

export type BillingMode = 'driver_pays' | 'fleet_invoice';

export interface Fleet {
  id: string;
  name: string;
  legalName: string | null;
  gstin: string | null;
  billingEmail: string | null;
  billingMode: BillingMode;
  invoiceCollectsAtSession: boolean;
  isActive: boolean;
  memberCount: number;
  vehicleCount: number;
  depotCount: number;
  createdAt: string;
}

export interface FleetMemberCard {
  id: string;
  label: string | null;
  /** The card's last few characters; the full token is never shown to a fleet. */
  tokenHint: string;
  isBlocked: boolean;
}

export interface FleetMember {
  driverId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  joinedAt: string;
  cards: FleetMemberCard[];
}

export interface Vehicle {
  id: string;
  fleetId: string;
  registration: string;
  label: string | null;
  makeModel: string | null;
  driverId: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface Depot {
  locationId: string;
  name: string;
  address: string | null;
  city: string | null;
  stationCount: number;
  since: string;
}

export interface FleetManager {
  id: string;
  fleetId: string;
  email: string;
  name: string | null;
  isActive: boolean;
  createdAt: string;
  lastSignInAt: string | null;
}

export interface FleetManagerSetupToken {
  setupToken: string;
  setupTokenExpiresAt: string;
  emailQueued: boolean;
}

export interface CreatedFleetManager extends FleetManagerSetupToken {
  manager: FleetManager;
}

export interface FleetManagerMe {
  manager: FleetManager;
  fleet: Fleet;
}

export interface FleetSession {
  id: string;
  driverId: string;
  driverName: string | null;
  stationIdentity: string;
  siteName: string | null;
  startedAt: string;
  stoppedAt: string | null;
  energyWh: string | null;
  costStatus: string | null;
  currency: string | null;
  totalMinor: string | null;
  /** Fixed when the session was first settled; null until then. */
  billingMode: BillingMode | null;
  /** true: the driver paid at the session. false: the fleet owes it. */
  collectedAtSession: boolean | null;
  chargedMinor: string | null;
}

export interface FleetSessionPage {
  items: FleetSession[];
  nextCursor: string | null;
}

export interface FleetBillingLine {
  currency: string;
  sessions: number;
  totalMinor: string;
  collectedMinor: string;
  owedMinor: string;
}

export interface FleetBillingMonth {
  month: string;
  lines: FleetBillingLine[];
}

/** Written by the vehicle dialog; the same body for staff and a manager. */
export interface VehicleInput {
  registration?: string;
  label?: string | null;
  makeModel?: string | null;
  driverId?: string | null;
  isActive?: boolean;
}

/** A fleet's billing mode, in words — the three choices the owner asked for. */
export function billingModeLabel(
  mode: BillingMode,
  collectsAtSession: boolean,
): string {
  if (mode === 'driver_pays') return 'Drivers pay';
  return collectsAtSession
    ? 'Monthly statement, drivers pay each session'
    : 'Monthly invoice, fleet pays';
}

/** Net, GST by component and the total, minor units as decimal strings. */
export interface StatementAmounts {
  netMinor: string;
  cgstMinor: string;
  sgstMinor: string;
  igstMinor: string;
  taxMinor: string;
  grossMinor: string;
}

export interface StatementSession extends StatementAmounts {
  transactionId: string;
  startedAt: string;
  stoppedAt: string | null;
  driverName: string | null;
  siteName: string | null;
  stationIdentity: string;
  energyWh: string | null;
  currency: string;
  taxRatePercent: string;
  taxTreatment: 'cgst_sgst' | 'igst' | 'none';
  /** The tax documents behind it: receipts (R-…) and credit notes (CN-…). */
  documents: string[];
  paidBy: 'driver' | 'fleet';
}

export interface StatementRateLine extends StatementAmounts {
  currency: string;
  taxRatePercent: string;
  sessions: number;
}

export interface StatementTotals {
  currency: string;
  sessions: number;
  all: StatementAmounts;
  paidByDrivers: StatementAmounts;
  owedByFleet: StatementAmounts;
}

export interface StatementParty {
  name: string | null;
  gstin: string | null;
  address: string | null;
  email: string | null;
}

/**
 * A fleet's monthly statement (`charveta` doc 6 §23 "Statement"): not a tax
 * invoice, but the receipts and credit notes already issued, with the price
 * before tax, each GST component and the total shown apart.
 */
export interface FleetStatement {
  month: string;
  generatedAt: string;
  operator: StatementParty;
  fleet: StatementParty;
  billingMode: BillingMode;
  invoiceCollectsAtSession: boolean;
  sessions: StatementSession[];
  byRate: StatementRateLine[];
  totals: StatementTotals[];
}

export interface FleetCost {
  currency: string;
  totalMinor: string;
  owedMinor: string;
  collectedMinor: string;
  perKwhMinor: string | null;
}

export interface FleetDashboardGroup {
  key: string;
  label: string | null;
  sessions: number;
  energyWh: string;
  minutes: string;
  cost: FleetCost[];
  /** Drivers only: the vehicles assigned to them now (sessions record none). */
  vehicles?: string[];
  /** Sites only. */
  isDepot?: boolean;
}

/**
 * A fleet's dashboard (`charveta` doc 6 §23): `GET /fleet-manager/dashboard`
 * for its managers, `GET /fleets/{id}/dashboard` for staff — the same shape.
 * Cost is what the monthly bill totals, so a month here and the bill agree.
 */
export interface FleetDashboard {
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  bucket: 'hour' | 'day';
  asOf: string;
  kpis: {
    sessions: Kpi;
    energyWh: Kpi;
    averageDurationMinutes: Kpi;
    averageEnergyWh: Kpi;
    activeDrivers: Kpi;
    unbilledSessions: Kpi;
    cost: {
      currency: string;
      totalMinor: Kpi;
      owedMinor: Kpi;
      collectedMinor: Kpi;
      perKwhMinor: Kpi;
    }[];
    activeNow: number;
  };
  series: FleetDashboardGroup[];
  byDriver: FleetDashboardGroup[];
  bySite: FleetDashboardGroup[];
}
