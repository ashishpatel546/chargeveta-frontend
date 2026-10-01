import 'server-only';

import { headers } from 'next/headers';
import { DIAL_CODES } from '@/lib/dial-codes';

/** When nothing below says otherwise: the API's `SMS_DEFAULT_COUNTRY_CODE` is +91. */
const FALLBACK_COUNTRY = 'IN';

/**
 * The country a phone field starts on, so a driver types only their number.
 *
 * First Cloudflare's `CF-IPCountry` (sent through the tunnel and any
 * Cloudflare-proxied host: where the request came from), then the browser's
 * languages (`en-IN` → IN), then India. Neither header is trusted for
 * anything: a wrong guess only preselects a field the driver can change, and
 * the API normalises whatever number it is given.
 */
export async function detectCountry(): Promise<string> {
  const h = await headers();
  const fromIp = h.get('cf-ipcountry')?.toUpperCase();
  // XX (unknown) and T1 (Tor) are Cloudflare's, and in no table.
  if (fromIp && fromIp in DIAL_CODES) return fromIp;

  for (const part of (h.get('accept-language') ?? '').split(',')) {
    const region = part.split(';')[0].trim().split('-')[1]?.toUpperCase();
    if (region && region in DIAL_CODES) return region;
  }
  return FALLBACK_COUNTRY;
}
