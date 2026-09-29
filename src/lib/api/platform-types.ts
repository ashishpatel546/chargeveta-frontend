/**
 * The shapes the platform administration API returns (`/api/v1/platform/*`).
 * Kept apart from `types.ts` because none of it belongs to a tenant: a
 * platform admin works across every operator, above the tenant boundary.
 */

export interface PlatformAdminMe {
  id: string;
  email: string;
  name: string | null;
  /** While true, the API refuses everything but password, me and sign-out. */
  mustChangePassword: boolean;
  lastSignInAt: string | null;
}

export interface PlatformTenant {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  enabledModules: string[];
  createdAt: string;
}

/** What a new tenant's first owner is sent to choose their password. */
export interface OwnerSetupLink {
  setupToken: string;
  setupTokenExpiresAt: string;
  emailQueued: boolean;
  /** Null when the API has no public console address configured. */
  setupUrl: string | null;
}

export interface CreatedTenant extends OwnerSetupLink {
  tenant: PlatformTenant;
  ownerId: string;
}

/** What suspending a tenant did to its chargers' live connections. */
export interface ChargerDisconnects {
  stations: number;
  disconnected: number;
  notConnected: number;
  failed: number;
}

export interface UpdatedTenant {
  tenant: PlatformTenant;
  /** Present only when this request is the one that suspended the tenant. */
  chargers?: ChargerDisconnects;
}
