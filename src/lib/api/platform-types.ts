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

/** A tenant's first owner, active ones first — who a resend goes to. */
export interface PlatformTenantOwner {
  id: string;
  email: string;
  isActive: boolean;
  /** Null until they first sign in (a redeemed setup link counts). */
  lastSignInAt: string | null;
  /** When their unused setup link expires, if they have one. */
  setupLinkExpiresAt: string | null;
}

/** A row of `GET /platform/tenants`. */
export interface PlatformTenantListItem extends PlatformTenant {
  owner: PlatformTenantOwner | null;
  activeOwners: number;
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

/** Another platform admin, as `GET /platform/admins` lists them. */
export interface PlatformAdmin {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  /** Null for an admin who has not used their setup link yet. */
  lastSignInAt: string | null;
  createdAt: string;
  setupLinkExpiresAt: string | null;
}

/** A platform admin's single-use setup or reset link. Never emailed. */
export interface PlatformAdminSetupLink {
  setupToken: string;
  setupTokenExpiresAt: string;
  /** Null when the API has no public console address configured. */
  setupUrl: string | null;
}

export interface CreatedPlatformAdmin extends PlatformAdminSetupLink {
  admin: PlatformAdmin;
}

export const PLATFORM_AUDIT_ACTIONS = [
  'tenant.create',
  'tenant.update',
  'tenant.suspend',
  'tenant.reinstate',
  'tenant.owner-link',
  'admin.add',
  'admin.deactivate',
  'admin.reactivate',
  'admin.reset-link',
  'admin.setup-redeemed',
  'admin.sign-in',
  'admin.sign-in-failed',
  'admin.password-change',
  'audit.prune',
] as const;

export type PlatformAuditAction = (typeof PLATFORM_AUDIT_ACTIONS)[number];

/** One row of the platform audit log. Never holds a token or password. */
export interface PlatformAuditEntry {
  id: string;
  createdAt: string;
  /** `platform-admin:<id>`, `platform`, `script:<name>` or `anonymous`. */
  actor: string;
  actorAdminId: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  tenantId: string | null;
  tenantName: string | null;
  detail: Record<string, unknown>;
  ipAddress: string | null;
}

export interface PlatformAuditPage {
  items: PlatformAuditEntry[];
  nextCursor: string | null;
}
