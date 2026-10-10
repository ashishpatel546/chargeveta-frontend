import 'server-only';

import { headers } from 'next/headers';
import { isIP } from 'node:net';

/**
 * Who the browser is, told to the API (doc 6 §18.4).
 *
 * Every call to the API is made by this server, so without this the API
 * records the console's own address for every user — in the audit logs, the
 * session list — and its per-address sign-in limits count every user as one.
 * The API believes the `X-Forwarded-For` we send only because its
 * `TRUSTED_PROXY_CIDRS` names this server; so what we send must be something
 * we can justify, not whatever the browser wrote.
 *
 * ## What this server can see
 *
 * Next (16.3, `base-server.js`) sets `x-forwarded-for` to the socket's peer
 * **only when the request did not carry one** (`??=`), and route handlers are
 * given no other way to reach the socket. So a browser talking to this server
 * directly can put any address it likes in the header, and it arrives here
 * looking exactly like one Next wrote. Checked against `next start`:
 *
 *   no header                      -> "127.0.0.1"      (the peer, from Next)
 *   `X-Forwarded-For: 6.6.6.6`     -> "6.6.6.6"        (the browser's claim)
 *   `6.6.6.6, 203.0.113.9` (as Cloudflare appends) -> passed through as is
 *
 * ## `TRUSTED_PROXY_HOPS`
 *
 * How many proxies stand in front of this server, each appending the address
 * it saw (Cloudflare does; cloudflared adds nothing of its own). The client is
 * then the entry that many from the right: the one the outermost proxy wrote,
 * not anything the browser put before it. A request that arrives with fewer
 * entries than that is not believed.
 *
 * The default, **0**, forwards nothing: with no proxy in front, the peer is
 * only in the header if the browser chose not to write one, which cannot be
 * told apart from the browser writing one, so the API goes on recording this
 * server's address — today's behaviour. Setting it to N says every request
 * reaches this server through N proxies; one that bypasses them (the port
 * opened directly on the network) can choose its recorded address, so keep the
 * port private when N > 0.
 *
 * The browser's user agent goes with it: the API records that too, and
 * otherwise sees Node's.
 */

function readHops(): number {
  const raw = process.env.TRUSTED_PROXY_HOPS?.trim();
  if (!raw) return 0;
  if (!/^(0|[1-9][0-9]?)$/.test(raw)) {
    // At import, like `config.ts`: a typo here would otherwise quietly
    // record every user as this server again.
    throw new Error(
      `TRUSTED_PROXY_HOPS must be a whole number of proxies, not "${raw}"`,
    );
  }
  return Number(raw);
}

const TRUSTED_PROXY_HOPS = readHops();

/**
 * The address a request's `X-Forwarded-For` justifies, given how many proxies
 * append to it before this server — or null when it justifies none.
 */
export function believedClientAddress(
  forwardedFor: string | null,
  hops: number,
): string | null {
  if (hops < 1 || !forwardedFor) return null;
  const entries = forwardedFor
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length < hops) return null;
  const candidate = entries[entries.length - hops];
  // A bare address only: never pass on text a proxy did not write as one.
  return isIP(candidate) ? candidate : null;
}

/**
 * Headers to add to a call to the API made while handling a browser's
 * request. Empty outside one (a call with no request behind it has no client
 * to name), and without a believable address.
 */
export async function clientHeaders(): Promise<Record<string, string>> {
  let incoming: Headers;
  try {
    incoming = await headers();
  } catch {
    return {};
  }
  return clientHeadersFrom(incoming);
}

/**
 * `clientHeaders()`, from a request's headers in hand — for `proxy.ts`, which
 * is given the request rather than reaching it through `next/headers`.
 */
export function clientHeadersFrom(incoming: Headers): Record<string, string> {
  const forwarded: Record<string, string> = {};
  const address = believedClientAddress(
    incoming.get('x-forwarded-for'),
    TRUSTED_PROXY_HOPS,
  );
  if (address) forwarded['x-forwarded-for'] = address;
  const agent = incoming.get('user-agent');
  if (agent) forwarded['user-agent'] = agent.slice(0, 400);
  return forwarded;
}
