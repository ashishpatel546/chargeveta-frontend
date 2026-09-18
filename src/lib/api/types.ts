/**
 * The shapes the API answers with.
 *
 * Hand-written from the controllers and DTOs rather than generated: the API
 * publishes Swagger at `/docs`, but generating from it would tie the console's
 * build to a running API, and the surface is small enough to keep honest by
 * hand. Money and energy are decimal **strings** throughout — they are `numeric`
 * in Postgres, and putting them through a JavaScript number is how a bill comes
 * out a paisa short.
 */

export type Role = 'viewer' | 'operator' | 'admin' | 'owner';

/** The role ladder, weakest first. `atLeast` compares positions in it. */
export const ROLES: Role[] = ['viewer', 'operator', 'admin', 'owner'];

export function atLeast(role: Role, needed: Role): boolean {
  return ROLES.indexOf(role) >= ROLES.indexOf(needed);
}

export type Principal =
  | {
      kind: 'user';
      userId: string;
      email: string;
      role: Role;
      tenantId: string;
      sessionId: string;
    }
  | {
      kind: 'api-key';
      apiKeyId: string;
      name: string;
      role: Role;
      tenantId: string;
    };

export type OcppVersion = '1.6' | '2.0.1' | '2.1';

export type ConnectorStatus =
  | 'Available'
  | 'Occupied'
  | 'Reserved'
  | 'Unavailable'
  | 'Faulted';

export interface Station {
  id: string;
  tenantId: string;
  identity: string;
  locationId: string | null;
  tariffId: string | null;
  ocppVersion: OcppVersion;
  securityProfile: number;
  clientCertificateSha256: string | null;
  vendor: string | null;
  model: string | null;
  serialNumber: string | null;
  firmwareVersion: string | null;
  isActive: boolean;
  quarantinedAt: string | null;
  quarantinedBy: string | null;
  quarantineReason: string | null;
  localListVersion: number;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
  hasCredential: boolean;
}

/**
 * How a connector or EVSE came to exist: somebody added it, or a charger
 * reported it and the platform created it.
 */
export type ProvisioningSource = 'operator' | 'reported';

export interface Evse {
  id: string;
  tenantId: string;
  stationId: string;
  evseNumber: number;
  source: ProvisioningSource;
  firstReportedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Connector {
  id: string;
  tenantId: string;
  evseId: string;
  connectorNumber: number;
  /** What the people on site call it. Display only. */
  label: string | null;
  connectorType: string | null;
  maxAmperage: number | null;
  status: ConnectorStatus;
  statusUpdatedAt: string | null;
  source: ProvisioningSource;
  /** Null means no charger has ever mentioned this connector. */
  firstReportedAt: string | null;
  /**
   * Taken out of service. Its status stops following what the charger reports,
   * and nothing re-creates it however often the charger mentions it.
   */
  isRetired: boolean;
  retiredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Site {
  id: string;
  tenantId: string;
  name: string;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  timeZone: string | null;
  tariffId: string | null;
  gstRateBp: number | null;
  gstStateCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionCostSummary {
  status: 'priced' | 'unpriced';
  unpricedReason?: string;
  totalMinor?: string;
  currency?: string;
  clockSource: 'station' | 'engine';
  clockTrusted: boolean;
  revision: number;
}

export interface Transaction {
  id: string;
  stationId: string;
  transactionRef: string;
  sequenceNo?: number;
  protocolVersion: OcppVersion;
  connectorId?: number;
  evseId?: number;
  idToken?: string;
  startedAt: string;
  meterStart?: number;
  stoppedAt?: string;
  meterStop?: number;
  stoppedReason?: string;
  energyWh?: string;
  lastMeterWh?: string;
  lastSampleAt?: string;
  cost?: TransactionCostSummary;
  isOpen: boolean;
}

export interface TransactionCost extends TransactionCostSummary {
  transactionId: string;
  unpricedDetail?: string;
  tariffId?: string;
  tariffVersionId?: string;
  rounding?: string;
  tariffDefinition?: unknown;
  lines: unknown[];
  clockOffsetMs?: string;
  clockObservations: number;
  billedStartedAt: string;
  billedStoppedAt: string;
  chargingEndedAt?: string;
  energyWh?: string;
  timeZone?: string;
  pricedAt: string;
}

export interface TransactionEvent {
  id: string;
  eventType: string;
  triggerReason?: string;
  seqNo?: number;
  protocolVersion: OcppVersion;
  connectorId?: number;
  evseId?: number;
  idToken?: string;
  chargingState?: string;
  stoppedReason?: string;
  meterStart?: number;
  meterStop?: number;
  offline: boolean;
  failure?: string;
  dedupeKey: string;
  occurredAt?: string;
  receivedAt: string;
  payload: Record<string, unknown>;
}

export interface MeterReading {
  id: string;
  source: 'MeterValues' | 'TransactionEvent';
  protocolVersion: OcppVersion;
  connectorId?: number;
  evseId?: number;
  sampledAt: string;
  context?: string;
  energyRegisterWh?: string;
  powerActiveImportW?: string;
  socPercent?: string;
  sampledValue: unknown;
  receivedAt: string;
}

/** Every remote command answers with this, at 200, whatever happened. */
export interface CommandResult {
  outcome:
    | 'answered'
    | 'charger_error'
    | 'not_connected'
    | 'unsupported'
    | 'timeout'
    | 'disconnected'
    | 'busy'
    | 'engine_error'
    | 'engine_unreachable';
  status?: string;
  reasonCode?: string;
  detail?: string;
  delivered?: boolean;
  messageId?: string;
  data?: Record<string, unknown>;
  requestId?: number;
  profileId?: number;
  durationMs: number;
}

export interface StationCommandEntry {
  id: string;
  command: string;
  request: Record<string, unknown>;
  actor: string;
  outcome: string;
  status?: string;
  reasonCode?: string;
  detail?: string;
  delivered?: boolean;
  messageId?: string;
  response?: Record<string, unknown>;
  durationMs: number;
  createdAt: string;
}

export interface BootEntry {
  status: string;
  intervalSeconds: number;
  protocolVersion: OcppVersion;
  reportedVendor: string;
  reportedModel: string;
  reportedSerialNumber: string | null;
  reportedFirmwareVersion: string | null;
  bootReason: string | null;
  occurredAt: string | null;
  receivedAt: string;
  producedBy: string;
}

export interface ConnectorStatusEntry {
  evseNumber: number;
  connectorNumber: number;
  status: ConnectorStatus;
  reportedStatus: string;
  protocolVersion: OcppVersion;
  errorCode: string | null;
  info: string | null;
  vendorId: string | null;
  vendorErrorCode: string | null;
  occurredAt: string | null;
  receivedAt: string;
  producedBy: string;
}

export interface QuarantineStatus {
  quarantined: boolean;
  quarantinedAt: string | null;
  quarantinedBy: string | null;
  reason: string | null;
  history: {
    action: string;
    actorKind: string;
    actor: string;
    reason: string | null;
    at: string;
  }[];
}

export type NotificationKind =
  | 'connector.faulted'
  | 'station.quarantined'
  | 'station.offline'
  | 'security.event';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  severity: 'info' | 'warning' | 'critical';
  stationId: string | null;
  title: string;
  detail: Record<string, unknown>;
  createdAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
}

export interface TaxLine {
  component: 'CGST' | 'SGST' | 'IGST';
  ratePercent: string;
  amountMinor: string;
}

export interface CreditNote {
  id: string;
  documentNumber: string;
  number: string;
  receiptId: string;
  receiptDocumentNumber: string;
  reason: 'repriced' | 'unpriced' | 'operator';
  note: string | null;
  currency: string;
  netMinor: string;
  taxMinor: string;
  grossMinor: string;
  taxLines: TaxLine[];
  issuedBy: string;
  issuedAt: string;
}

export interface Receipt {
  id: string;
  documentNumber: string;
  number: string;
  transactionId: string;
  costRevision: number;
  currency: string;
  netMinor: string;
  taxMinor: string;
  grossMinor: string;
  taxRateBp: number;
  taxTreatment: string;
  taxLines: TaxLine[];
  lines: unknown[];
  snapshot: Record<string, unknown>;
  creditedNetMinor: string;
  remainingNetMinor: string;
  creditNotes?: CreditNote[];
  issuedBy: string;
  issuedAt: string;
}

export interface IdToken {
  id: string;
  token: string;
  tokenType: string | null;
  label: string | null;
  status: 'Accepted' | 'Blocked' | 'Expired';
  isBlocked: boolean;
  blockedReason: string | null;
  expiresAt: string | null;
  groupId: string | null;
  chargingPriority: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthorizationRecord {
  id: string;
  stationId: string;
  stationIdentity: string;
  protocolVersion: OcppVersion;
  token: string;
  tokenType?: string;
  status: string;
  detail?: string;
  failure?: string;
  expiresAt?: string;
  groupId?: string;
  receivedAt: string;
  eventId: string;
}

export interface TariffVersion {
  id: string;
  version: number;
  validFrom: string;
  rounding: string;
  definition: unknown;
  createdAt: string;
}

export interface Tariff {
  id: string;
  name: string;
  currency: string;
  currentVersion?: TariffVersion;
  versions?: TariffVersion[];
  createdAt: string;
  updatedAt: string;
}

export interface SessionReportRow {
  key: string;
  label: string | null;
  currency: string | null;
  sessions: number;
  unpricedSessions: number;
  energyWh: string;
  billedMinutes: string;
  netMinor: string;
  taxMinor: string;
  grossMinor: string;
}

export interface SessionReport {
  from: string;
  to: string;
  groupBy: 'day' | 'month' | 'site' | 'station';
  asOf: string;
  rows: SessionReportRow[];
}

export interface ConnectorAvailability {
  stationId: string;
  stationIdentity: string;
  siteId: string | null;
  siteName: string | null;
  evse: number;
  connector: number;
  upSeconds: number;
  downSeconds: number;
  excludedSeconds: number;
  unknownSeconds: number;
  availability: number | null;
  coverage: number;
}

export interface AvailabilityReport {
  from: string;
  to: string;
  unavailableCountsAs: 'down' | 'excluded';
  asOf: string;
  rows: ConnectorAvailability[];
}

export interface TenantSettings {
  concurrentTxPolicy: 'refuse' | 'allow';
  legalName: string | null;
  gstin: string | null;
  billingAddress: string | null;
  sacCode: string | null;
  unavailableCountsAs: 'down' | 'excluded';
}

export interface ConsoleUser {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface CreatedUser extends ConsoleUser {
  setupToken?: string;
  setupTokenExpiresAt?: string;
}

export interface ApiKey {
  id: string;
  name: string;
  role: Exclude<Role, 'owner'>;
  createdBy: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

export interface CreatedApiKey extends ApiKey {
  key: string;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  kinds: NotificationKind[];
  isActive: boolean;
  createdBy: string;
  createdAt: string;
}

export interface CreatedWebhookEndpoint extends WebhookEndpoint {
  secret: string;
}

export interface WebhookDelivery {
  id: string;
  notificationId: string;
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
  lastStatus: number | null;
  lastError: string | null;
  nextAttemptAt: string;
  createdAt: string;
  deliveredAt: string | null;
}

export interface Reservation {
  id: string;
  stationId: string;
  reservationId: number;
  token: string;
  evseId?: number;
  connectorId?: number;
  connectorType?: string;
  expiresAt: string;
  status:
    | 'requested'
    | 'accepted'
    | 'refused'
    | 'unconfirmed'
    | 'failed'
    | 'cancelled'
    | 'used'
    | 'expired'
    | 'removed';
  chargerStatus?: string;
  transactionId?: string;
  createdAt: string;
}

/** The cursor pages: authorizations, notifications, receipts, credit notes. */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
