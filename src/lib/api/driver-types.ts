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
  /** Running cost and what limits it — null when none was recorded. */
  limit: DriverSessionLimitDto | null;
}

/**
 * A session's running cost and money limit (doc 6 §22.4 "Session limits").
 * Money is minor units, energy Wh, power W — all decimal strings.
 */
export interface DriverSessionLimitDto {
  /** `wallet`, `hold`, or `none` when nothing limits it (a fleet pays). */
  source: 'wallet' | 'hold' | 'none';
  currency: string | null;
  budgetMinor: string | null;
  /** The session so far, as the receipt will price it, tax included. */
  runningCostMinor: string;
  remainingMinor: string | null;
  /** Kept back so the charger stops in time. */
  reserveMinor: string;
  energyWh: string | null;
  powerW: string | null;
  socPercent: string | null;
  /** Estimates, set only once the battery can be judged from the SoC. */
  toFullWh: string | null;
  toFullMinor: string | null;
  lastPricedAt: string | null;
  stopRequestedAt: string | null;
  /** `balance_used_up` or `hold_used_up`. */
  stopReason: string | null;
  stopSentAt: string | null;
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
  /** A wallet start: what the session may spend before it is stopped. */
  budgetMinor?: string;
}

/** `GET /driver/stations/:id/quote` — prices before a start (§22.4). */
export interface DriverQuotePriceDto {
  energyWh: string;
  netMinor: string;
  taxLines: { component: string; ratePercent: string; amountMinor: string }[];
  taxMinor: string;
  grossMinor: string;
}

export interface DriverQuoteBudgetDto {
  amountMinor: string;
  /** The amount less the margin kept back for the stop. */
  spendableMinor: string;
  buys: DriverQuotePriceDto | null;
}

export interface DriverQuoteDto {
  priced: boolean;
  unpricedReason: string | null;
  currency: string | null;
  energyPricePerKwhMinor: string | null;
  sessionFeeMinor: string | null;
  taxRatePercent: string;
  /** Time-based charges not in the estimate: charging_time, idle, occupancy. */
  notIncluded: string[];
  requested: DriverQuotePriceDto | null;
  wallet: DriverQuoteBudgetDto | null;
  hold: DriverQuoteBudgetDto | null;
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

/** `GET /driver/wallet` — doc 6 §22.4. `razorpayKeyId` is null while `enabled` is false. */
export interface WalletDto {
  enabled: boolean;
  currency: string;
  balanceMinor: string;
  minStartMinor: string;
  topUpMinMinor: string;
  topUpMaxMinor: string;
  holdDefaultMinor: string;
  holdMinMinor: string;
  holdMaxMinor: string;
  razorpayKeyId: string | null;
}

export interface WalletEntryDto {
  id: string;
  /** top_up, charge, or adjustment. */
  kind: string;
  /** Signed — negative for a charge. */
  amountMinor: string;
  balanceAfterMinor: string;
  currency: string;
  transactionId: string | null;
  paymentId: string | null;
  note: string | null;
  createdAt: string;
}

export interface WalletEntryPage {
  items: WalletEntryDto[];
  nextCursor: string | null;
}

/** A top-up or a hold, at any point in its Razorpay lifecycle. */
export interface PaymentDto {
  id: string;
  purpose: string;
  status: string;
  currency: string;
  amountMinor: string;
  capturedMinor: string;
  refundedMinor: string;
  /** Hold only: what the card should end up paying. */
  cardTargetMinor: string | null;
  method: string | null;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  stationId: string | null;
  transactionId: string | null;
  authorizedAt: string | null;
  expiresAt: string | null;
  capturedAt: string | null;
  createdAt: string;
}

export interface PaymentPage {
  items: PaymentDto[];
  nextCursor: string | null;
}

/**
 * What creating a top-up or a hold answers with — everything Razorpay
 * Checkout's options object needs, plus the `PaymentDto` row it was opened
 * for.
 */
export interface CheckoutDto {
  payment: PaymentDto;
  keyId: string;
  orderId: string;
  amountMinor: string;
  currency: string;
  name: string;
  description: string;
  email?: string;
  contact?: string;
}

export interface HoldConfirmedDto {
  payment: PaymentDto;
  /** Absent if this confirmation had already been made. */
  command?: DriverCommandResultDto;
}

/** `GET /driver/push-subscriptions` — one of this driver's own devices. */
export interface DriverPushSubscriptionDto {
  id: string;
  endpoint: string;
  userAgent: string | null;
  createdAt: string;
  lastPushedAt: string | null;
}
