import type { ConnectorStatus, OcppVersion } from '@/lib/api/types';

/**
 * The shapes the API answers a driver with — `lib/api/types.ts`'s convention,
 * hand-written from `charveta/src/modules/drivers/dto/driver.dto.ts` rather
 * than generated, for the same reason: the surface is small enough to keep
 * honest by hand without tying this build to a running API.
 *
 * Receipts are the one exception: `DriverController.receipts()` reuses
 * `ReceiptsApiService` verbatim, so the driver's receipt is the staff
 * `Receipt`/`Page<Receipt>` from `lib/api/types.ts`, not a copy here.
 */

export interface DriverDto {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  /** Whether password sign-in is set up — `changePassword` needs the old one only if this is true. */
  hasPassword: boolean;
  isActive: boolean;
  createdAt: string;
  lastSignInAt: string | null;
}

export interface DriverCardDto {
  id: string;
  token: string;
  tokenType: string | null;
  label: string | null;
  /** What a charger would be told right now: Accepted, Blocked, Expired, … */
  status: string;
  /** The card the app starts sessions with, issued with the account. */
  isAppCard: boolean;
  expiresAt: string | null;
  linkedAt: string;
}

export interface DriverSessionDto {
  id: string;
  stationId: string;
  stationIdentity: string;
  siteName: string | null;
  evseId: number | null;
  connectorId: number | null;
  cardId: string;
  startedAt: string;
  stoppedAt: string | null;
  stoppedReason: string | null;
  energyWh: string | null;
  /** priced, unpriced, or null while open or not yet priced. */
  costStatus: string | null;
  currency: string | null;
  /** Before tax, minor units — the full billed amount is on the receipt. */
  netMinor: string | null;
  receiptId: string | null;
}

export interface DriverSessionPage {
  items: DriverSessionDto[];
  nextCursor: string | null;
}

export interface DriverCommandResultDto {
  /** answered, timeout, not_connected, … — what happened to the request. */
  outcome: string;
  /** The charger's own answer: Accepted, … */
  status?: string;
  detail?: string;
}

export interface DriverConnectorDto {
  evseId: number;
  connectorId: number;
  connectorType: string | null;
  label: string | null;
  status: ConnectorStatus;
}

export interface DriverStationDto {
  id: string;
  identity: string;
  /** The protocol, which decides evseId or connectorId. */
  ocppVersion: OcppVersion;
  online: boolean;
  siteName: string | null;
  address: string | null;
  city: string | null;
  /** From the search origin, metres — only set by `/stations/nearby`. */
  distanceMeters?: number;
  connectors: DriverConnectorDto[];
}
