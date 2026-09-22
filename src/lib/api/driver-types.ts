/**
 * The shapes the API answers a driver with — `lib/api/types.ts`'s convention,
 * hand-written from `charveta/src/modules/drivers/dto/driver.dto.ts` rather
 * than generated, for the same reason: the surface is small enough to keep
 * honest by hand without tying this build to a running API.
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
