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

export type Principal = (
  | {
      kind: 'user';
      userId: string;
      email: string;
      role: Role;
      tenantId: string;
      sessionId: string;
      /**
       * Set while the user still has to replace a temporary password. The
       * console sends them to `/change-password` before anything else; the
       * API refuses every other route with `PASSWORD_CHANGE_REQUIRED` anyway.
       */
      mustChangePassword?: boolean;
      /** E.164; where an unanswered stop alert is texted (doc 6 §22.4). */
      phone?: string | null;
    }
  | {
      kind: 'api-key';
      apiKeyId: string;
      name: string;
      role: Role;
      tenantId: string;
    }
) & {
  /**
   * The optional modules switched on for this operator (`charveta` doc 4
   * §3.4) — `fleet` so far. The console offers only what the API will serve;
   * the API answers 404 for the rest regardless.
   */
  enabledModules?: string[];
};

/** Whether an optional module is on for the signed-in operator. */
export function hasModule(principal: Principal, module: string): boolean {
  return principal.enabledModules?.includes(module) ?? false;
}

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
  /**
   * OCPP 2.1 only (charveta doc 6 §16.13.9): whether the charger is told our
   * tariff (at Authorize and after it boots), and whether a paying driver's
   * budget is sent as the session's `maxCost`. Ignored on 1.6 and 2.0.1.
   */
  ocpp21SendTariff: boolean;
  ocpp21SendTransactionLimit: boolean;
  /**
   * What site load management knows of the hardware (charveta doc 6 §24.4):
   * its rating (null is "as much as the site allows"), whether it takes
   * limits in amps or watts, and on how many phases it charges.
   */
  maxPowerW: number | null;
  chargingRateUnit: 'A' | 'W';
  supplyPhases: 1 | 3;
  lastSeenAt: string | null;
  /**
   * When and from where the station last connected. The address is the
   * station's own; `lastConnectedVia` is the trusted proxy it came through,
   * null for a direct connection (doc 6 §17.13).
   */
  lastConnectedAt: string | null;
  lastConnectedAddress: string | null;
  lastConnectedVia: string | null;
  createdAt: string;
  updatedAt: string;
  hasCredential: boolean;
}

/**
 * What became of a charger's live connection when a quarantine, deactivation
 * or deletion asked the engine to close it (doc 6 §14.5). The change itself is
 * saved whatever this says; `not_connected` is a success — there was nothing
 * to close.
 */
export type LiveConnection =
  | {
      outcome: 'disconnected';
      closeCode: number;
      terminated: boolean;
      connectedForMs: number;
    }
  | { outcome: 'not_connected' }
  | { outcome: 'connected_elsewhere'; instanceId: string }
  | { outcome: 'engine_unreachable'; detail: string };

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

/** `GET /stations/board`: the charger list's live layer (`charveta` doc 6 §17). */
export interface StationBoard {
  summary: {
    /** Open sessions on chargers heard from in the last 15 minutes. */
    chargingNow: number;
    faultedConnectors: number;
    availableConnectors: number;
    totalConnectors: number;
    onlineStations: number;
    offlineStations: number;
    /** Wh since `since`, decimal text. */
    energyWh: string;
    since: string;
  };
  stations: { stationId: string; connectors: BoardConnector[] }[];
}

export interface BoardConnector {
  evseNumber: number;
  connectorNumber: number;
  status: ConnectorStatus;
  statusUpdatedAt: string | null;
  connectorType: string | null;
  /** A session with no recorded stop is on this connector. */
  charging: boolean;
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

/** A site's load management (charveta doc 6 §24). */
export interface LoadWindow {
  /** `HH:MM` in the site's zone. */
  from: string;
  /** `HH:MM`; at or before `from` runs past midnight. */
  to: string;
  /** ISO weekdays the window starts on; absent is every day. */
  days?: number[];
  limitW: number;
}

export interface LoadPolicy {
  locationId: string;
  enabled: boolean;
  capacityW: number;
  strategy: 'equal' | 'fifo';
  minCurrentA: number;
  voltageV: number;
  windows: LoadWindow[];
  lastRunAt: string | null;
  lastBudgetW: number | null;
  lastError: string | null;
  updatedAt: string;
}

/** Why a session got what it got. */
export type LoadReason = 'shared' | 'capped' | 'held' | 'fixed' | 'underuse';

export interface LoadSession {
  transactionId: string;
  transactionRef: string;
  stationId: string;
  stationIdentity: string;
  evseNumber: number;
  startedAt: string;
  drawW: number | null;
  /** The car's state of charge, when the charger reports one. */
  socPercent: number | null;
  targetW: number;
  reason: LoadReason;
  sentW: number | null;
  sentLimit: number | null;
  sentUnit: 'A' | 'W' | null;
  sentAt: string | null;
  expiresAt: string | null;
  outcome: string | null;
  detail: string | null;
}

export interface LoadStation {
  id: string;
  identity: string;
  ocppVersion: OcppVersion;
  online: boolean;
  maxPowerW: number | null;
  chargingRateUnit: 'A' | 'W';
  supplyPhases: 1 | 3;
  failsafe: {
    evseNumber: number;
    targetW: number;
    sentW: number | null;
    sentLimit: number | null;
    sentUnit: 'A' | 'W' | null;
    sentAt: string | null;
    outcome: string | null;
    detail: string | null;
  }[];
}

export interface LoadStatus {
  locationId: string;
  policy: LoadPolicy | null;
  budgetNowW: number | null;
  windowNow: { from: string; to: string; limitW: number } | null;
  failsafePerEvseW: number | null;
  allocatedW: number;
  drawW: number;
  sessions: LoadSession[];
  stations: LoadStation[];
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
  /** `interval_sum` when the charger reports no register (doc 6 §16.7.8). */
  energySource?: 'register' | 'interval_sum';
  lastMeterWh?: string;
  lastSampleAt?: string;
  cost?: TransactionCostSummary;
  isOpen: boolean;
  /**
   * The fleet vehicle recorded when the session started (`charveta` doc 6
   * §23), or null. On `GET /transactions/{id}` only, never on the list.
   */
  vehicle?: SessionVehicle | null;
  /**
   * The driver whose card started the session, when it was a driver's card
   * then and still is (`charveta` doc 6 §22.3). On the list only.
   */
  driver?: TransactionDriver;
}

export interface TransactionDriver {
  id: string;
  name: string | null;
  /** E.164, or null for a driver who signed up by email. */
  phone: string | null;
}

/**
 * The vehicle recorded on a session at its start: the one the driver picked
 * in the app, or else the one active vehicle assigned to them then. `id` is
 * null once the vehicle was deleted; the plate stays as it was.
 */
export interface SessionVehicle {
  id: string | null;
  registration: string;
  label: string | null;
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
  /** How charging end, charging time and idle were measured (doc 6 §16.13). */
  idleBasis?: 'register' | 'charging_state';
  energyWh?: string;
  energySource?: 'register' | 'interval_sum';
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

/**
 * Device-model monitoring, OCPP 2.x (`charveta` doc 6 §13.6): a rule the
 * charger applies to its own device model, reported as a device event when it
 * fires. `monitorId` is the charger's own number for it.
 */
export const MONITOR_TYPES = [
  'UpperThreshold',
  'LowerThreshold',
  'Delta',
  'Periodic',
  'PeriodicClockAligned',
  'TargetDelta',
  'TargetDeltaRelative',
] as const;
export type MonitorType = (typeof MONITOR_TYPES)[number];

export const MONITORING_BASES = [
  'All',
  'FactoryDefault',
  'HardWiredOnly',
] as const;

export interface StationMonitor {
  monitorId: number;
  componentName: string;
  componentInstance: string | null;
  evseNumber: number;
  connectorNumber: number;
  variableName: string;
  variableInstance: string | null;
  type: MonitorType;
  value: number;
  severity: number;
  transaction: boolean;
  /** `csms` — set here; `charger` — known only from the charger's report. */
  origin: 'csms' | 'charger';
  /** OCPP 2.1 only: HardWiredMonitor, PreconfiguredMonitor, CustomMonitor. */
  notificationType: string | null;
  setBy: string | null;
  setAt: string | null;
  reportedAt: string | null;
  updatedAt: string;
}

export interface StationMonitoring {
  /** False for a 1.6 station, which has no device model to monitor. */
  supported: boolean;
  ocppVersion: string;
  monitors: StationMonitor[];
  level: { value: number; setAt: string; setBy: string } | null;
  base: { value: string; setAt: string; setBy: string } | null;
  lastReportedAt: string | null;
}

/** A monitoring command's answer, with the charger's verdict on the monitor. */
export interface MonitorCommandResult extends CommandResult {
  monitorStatus?: string;
  monitor?: StationMonitor;
}

/** One OCPP 2.x `NotifyEvent` entry: the device model reporting itself. */
export interface ComponentEventEntry {
  stationEventId: number;
  cause: number | null;
  trigger: 'Alerting' | 'Delta' | 'Periodic';
  notificationType: string;
  evseNumber: number;
  connectorNumber: number;
  componentName: string;
  componentInstance: string | null;
  variableName: string;
  variableInstance: string | null;
  actualValue: string;
  techCode: string | null;
  techInfo: string | null;
  cleared: boolean;
  variableMonitoringId: number | null;
  /** The monitor that fired, when the station's monitor list knows it. */
  monitor: {
    monitorId: number;
    type: string;
    value: number;
    severity: number;
    origin: string;
  } | null;
  severity: number | null;
  protocolVersion: string;
  occurredAt: string;
  receivedAt: string;
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

/**
 * One connection or disconnection of a charger (doc 6 §17.13). `address` is
 * the station's own address as the engine resolved it, `via` the trusted
 * proxy it came through; both null for a disconnect, and once the API's
 * address retention has cleared them.
 */
export interface ConnectionEntry {
  id: string;
  kind: 'connected' | 'disconnected';
  receivedAt: string;
  address: string | null;
  via: string | null;
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
  | 'security.event'
  | 'payment.attention'
  | 'session.stop_failed';

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
  /**
   * When an alert nobody answered was escalated to the owners and admins by
   * email (`session.stop_failed` only); `detail.escalation` says how it went.
   */
  escalatedAt?: string | null;
  /**
   * When it was escalated a second time — texted, emailed again and pushed;
   * `detail.escalationAgain.texted` says to how many numbers, and
   * `.whatsapped` to how many on WhatsApp (absent from an older API).
   */
  escalatedAgainAt?: string | null;
  /**
   * How many steps of the escalation ladder it has climbed (0 never), and
   * when the latest was; `detail.escalationAgain` records the latest step
   * from the second on.
   */
  escalationStep?: number;
  escalatedLastAt?: string | null;
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
  /**
   * Set when the session was free charging: its full price was paid by a
   * sponsor — the staff member who granted it, or the company — not the driver.
   */
  sponsoredBy?: 'grantor' | 'company' | null;
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
  /** The card's free-charging grant, if it has one not revoked. */
  freeCharging?: FreeChargingGrant | null;
  createdAt: string;
  updatedAt: string;
}

export interface StaffRef {
  userId: string;
  email: string | null;
}

/**
 * Free charging on a card (`charveta` doc 6 §22.4, "Card taps and free
 * charging"): its sessions cost the driver nothing and are paid for by the
 * staff member who granted it, until an owner makes the company pay.
 */
export interface FreeChargingGrant {
  id: string;
  idTokenId: string;
  reason: string;
  expiresAt: string | null;
  grantedBy: StaffRef;
  grantedAt: string;
  companySponsored: boolean;
  companySponsoredBy: StaffRef | null;
  companySponsoredAt: string | null;
  revokedBy: StaffRef | null;
  revokedAt: string | null;
  active: boolean;
  payer: 'grantor' | 'company';
}

export interface FreeChargingReport {
  month: string;
  totals: {
    payerKind: 'grantor' | 'company';
    payer: StaffRef | null;
    currency: string;
    sessions: number;
    amountMinor: string;
  }[];
  sessions: {
    transactionId: string;
    startedAt: string;
    stationIdentity: string;
    siteName: string | null;
    card: string;
    cardLabel: string | null;
    grantId: string;
    reason: string;
    payerKind: 'grantor' | 'company';
    payer: StaffRef | null;
    currency: string;
    amountMinor: string;
  }[];
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
  /** E.164, or null; owners and admins with one are texted escalations. */
  phone: string | null;
  createdAt: string;
}

export interface CreatedUser extends ConsoleUser {
  setupToken?: string;
  setupTokenExpiresAt?: string;
  /** With a setup token: whether an email carrying it will be sent. */
  emailQueued?: boolean;
}

/**
 * The signed-in person's own alert preferences (GET/PUT
 * /users/me/alert-preferences, doc 6 §22.2, §22.4). Every flag is on until
 * they change it.
 */
export interface AlertPreferences {
  /** Alerts pushed to their devices at all. */
  pushAlerts: boolean;
  /** Warnings as well as critical alerts. */
  pushWarnings: boolean;
  /** A stuck session's escalation email (owners and admins). */
  escalationEmail: boolean;
  /** Its texts — SMS, and WhatsApp where that is on. */
  escalationSms: boolean;
}

/** One of the signed-in person's own devices registered for push. */
export interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  userAgent: string | null;
  createdAt: string;
  lastPushedAt: string | null;
}

export type MessageChannel = 'email' | 'sms' | 'whatsapp' | 'push';
export type MessageStatus = 'pending' | 'sent' | 'failed' | 'skipped';

/** A row of the outbox. The API never returns a message's body. */
export interface OutboxMessage {
  id: string;
  channel: MessageChannel;
  template: string;
  toAddress: string;
  status: MessageStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  completedAt: string | null;
  redactedAt: string | null;
}

/** A new setup token for an existing user — a password reset. */
export interface IssuedSetupToken {
  setupToken: string;
  setupTokenExpiresAt: string;
  /** Whether an email carrying it will be sent. */
  emailQueued: boolean;
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

/** What the tenant audit log records (charveta doc 6 §18.4). */
export const TENANT_AUDIT_ACTIONS = [
  'staff.sign-in',
  'staff.sign-in-failed',
  'fleet-manager.sign-in-failed',
  'driver.sign-in-failed',
  'driver.test-number-code',
  'driver.test-number-sign-in',
  'staff.setup-redeemed',
  'staff.password-reset-requested',
  'staff.password-change',
  'user.add',
  'user.role-change',
  'user.deactivate',
  'user.reactivate',
  'user.reset-link',
  'user.sessions-revoke',
  'api-key.create',
  'api-key.revoke',
  'card.create',
  'card.update',
  'card.delete',
  'driver.deactivate',
  'driver.reactivate',
  'fleet-manager.add',
  'fleet-manager.deactivate',
  'fleet-manager.reactivate',
  'fleet-manager.reset-link',
  'station.credential-set',
  'station.client-certificate-set',
  'station.client-certificate-remove',
  'free-charging.grant',
  'free-charging.revoke',
  'free-charging.sponsor',
  'free-charging.unsponsor',
  'payment.retry',
  'wallet.adjust',
  'receipt.credit-note',
  'settings.update',
  'tariff.create',
  'tariff.rename',
  'tariff.version-add',
  'tariff.assign',
  'fleet.create',
  'fleet.update',
  'fleet.member-add',
  'fleet.member-remove',
  'station.create',
  'station.update',
  'station.delete',
  'station.quarantine',
  'station.quarantine-clear',
  'evse.create',
  'connector.create',
  'connector.update',
  'location.create',
  'location.update',
  'location.delete',
  'location.load-management',
  'webhook.create',
  'webhook.update',
  'webhook.delete',
  'webhook.secret-rotate',
  'station.reset',
  'station.unlock-connector',
  'station.remote-start',
  'station.remote-stop',
  'station.trigger-message',
  'station.change-availability',
  'station.get-configuration',
  'station.change-configuration',
  'station.clear-cache',
  'station.update-firmware',
  'station.get-diagnostics',
  'station.local-list-send',
  'station.get-local-list-version',
  'station.charging-profile-set',
  'station.charging-profile-clear',
  'station.get-composite-schedule',
  'station.certificate-install',
  'station.get-installed-certificates',
  'station.certificate-delete',
  'station.certificate-signed',
  'station.monitor-set',
  'station.monitor-clear',
  'station.get-monitoring-report',
  'station.monitoring-base-set',
  'station.monitoring-level-set',
  'reservation.create',
  'reservation.cancel',
] as const;

export type TenantAuditAction = (typeof TENANT_AUDIT_ACTIONS)[number];

export const TENANT_AUDIT_TARGET_TYPES = [
  'user',
  'api-key',
  'id-token',
  'driver',
  'fleet',
  'fleet-manager',
  'payment',
  'receipt',
  'tariff',
  'tenant',
  'station',
  'location',
  'transaction',
  'evse',
  'connector',
  'webhook',
] as const;

/** One row of the tenant audit log. Never holds a token or password. */
export interface TenantAuditEntry {
  id: string;
  occurredAt: string;
  /** `user:<id>`, `api-key:<id>` or `anonymous` (a refused sign-in). */
  actor: string;
  actorKind: 'user' | 'api-key' | 'anonymous';
  actorId: string | null;
  actorEmail: string | null;
  actorName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown>;
  /** The browser's address, as far as the API could vouch for it. */
  ipAddress: string | null;
  userAgent: string | null;
}

export interface TenantAuditPage {
  items: TenantAuditEntry[];
  nextCursor: string | null;
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

/**
 * A page asked for by number (`?page=`): `total` is counted up to the API's
 * cap, and `totalCapped` says there are more than that.
 */
export interface NumberedPage<T> extends Page<T> {
  page: number;
  total: number;
  totalCapped: boolean;
}

/** One refund asked of Razorpay (`charveta` doc 6 §22.4). */
export interface PaymentRefund {
  /** Also the refund's receipt at Razorpay. */
  id: string;
  paymentId: string;
  amountMinor: string;
  status: 'pending' | 'processed' | 'failed';
  /** 1 for the first request; each retry is one more. */
  attempt: number;
  razorpayRefundId: string | null;
  withdrawalId: string | null;
  failureReason: string | null;
  createdAt: string;
  completedAt: string | null;
  failedAt: string | null;
}

/** `GET /payments/attention` — a driver payment the worker could not finish. */
export interface AttentionPayment {
  id: string;
  driverId: string;
  purpose: 'top_up' | 'hold';
  status: string;
  currency: string;
  amountMinor: string;
  capturedMinor: string;
  refundedMinor: string;
  method: string | null;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  stationId: string | null;
  transactionId: string | null;
  expiresAt: string | null;
  createdAt: string;
  lastError: string | null;
  syncAttempts: number;
  nextSyncAt: string | null;
  needsAttention: boolean;
  attentionAt: string | null;
  attentionReason: string | null;
  refunds: PaymentRefund[];
}

/**
 * A figure for a period and the one of equal length just before it, and the
 * change between them (`charveta` doc 6 §20.4). Values are decimal strings as
 * everywhere else; `changePct` is the API's, for display only.
 */
export interface Kpi {
  current: string | null;
  previous: string | null;
  changePct: number | null;
}

export interface RevenueKpi {
  currency: string;
  netMinor: Kpi;
  taxMinor: Kpi;
  grossMinor: Kpi;
}

export interface DashboardMoney {
  currency: string;
  netMinor: string;
  taxMinor: string;
  grossMinor: string;
}

export interface DashboardGroup {
  key: string;
  label: string | null;
  siteName: string | null;
  sessions: number;
  energyWh: string;
  billedMinutes: string;
  revenue: DashboardMoney[];
}

export type PaymentMethod = 'free' | 'wallet' | 'online' | 'not_collected';
export type StartMethod = 'app' | 'card' | 'unregistered' | 'none';

/** `GET /reports/dashboard` — the console's overview (doc 6 §20.4). */
export interface Dashboard {
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
    uniqueDrivers: Kpi;
    uniqueIdTokens: Kpi;
    unpricedSessions: Kpi;
    untrustedClockSessions: Kpi;
    refusedAuthorizations: Kpi;
    availability: Kpi;
    coverage: Kpi;
    utilisation: Kpi;
    revenue: RevenueKpi[];
    activeNow: number;
  };
  series: DashboardGroup[];
  bySite: DashboardGroup[];
  byStation: DashboardGroup[];
  heatmap: { weekday: number; hour: number; sessions: number; energyWh: string }[];
  byPaymentMethod: DashboardGroup[];
  byStartMethod: DashboardGroup[];
}
