# ChargeVeta console

The web front end for ChargeVeta: the operator and administrator console today,
and the home of the fleet and driver screens as those are built.

It is a Next.js application (App Router, TypeScript, Tailwind, shadcn/ui on Base
UI) and an installable progressive web app. It holds no data of its own — every
screen is a view of the ChargeVeta API.

## Running it

You need the API running first. In `charveta`:

```
docker compose -f docker-compose.dev.yml up -d   # Postgres and Redis
npm run start:dev                                 # the API, on :3000
npm run start:worker:dev                          # the event worker
```

Then here:

```
cp .env.example .env.local     # and edit if your API is not on :3000
npm install
npm run dev                    # http://localhost:4200
```

Sign in with the account the API was seeded with (`SEED_ADMIN_EMAIL` and
`SEED_ADMIN_PASSWORD` in the API's `.env`). In a shared installation you also
need the operator's short name — `SEED_TENANT_SLUG`.

| Script | What it does |
|---|---|
| `npm run dev` | Development server on 4200 |
| `npm run build` | Production build |
| `npm run start` | Serves the build on 4200 |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |

## How it talks to the API

Two decisions shape everything else here.

**Nothing in the browser holds a token.** Signing in puts the access and refresh
tokens in `httpOnly` cookies, and every API call the browser makes goes to this
app's own `/api/cv/...`, which attaches the token and forwards it
(`src/app/api/cv/[...path]/route.ts`). A 401 is refreshed and retried once,
there, so no screen has to know the refresh rules. The refresh token never
reaches the page.

**That is also the only way in.** The API sends no CORS headers at all, so a
browser cannot call it across origins. Going through this app is not a
convenience; it is what makes the console possible without loosening the API.

The one exception is live updates. The API's Socket.IO endpoint is a WebSocket
straight from the browser, and its handshake wants the token, so
`/api/realtime-token` hands over the *access* token — and only that — for the
socket to use. The API must be started with `REALTIME_ENABLED=true` and this
app's origin in `REALTIME_CORS_ORIGINS`. Without it the console still works; it
refetches on an interval instead, and the header says "not live".

The socket's messages are thin on purpose: ids and what changed, never an
entity. `src/components/realtime-provider.tsx` therefore does not patch the
cache — it marks the affected queries stale and lets them refetch through the
proxy, where the API's roles still apply.

## Layout

```
src/app/(console)/     the screens behind a sign-in
src/app/api/cv/        the proxy to the API
src/app/sign-in/       the only page in front of it
src/components/        shared pieces; components/ui is shadcn's, don't hand-edit
src/lib/api/           the API's shapes and the browser's client
src/lib/server/        session cookies, server-side API calls, sign-in actions
```

## Things worth knowing before changing anything

- **Money and energy are decimal strings.** The API sends money in minor units
  and energy in watt-hours, as strings, because they are `numeric` in Postgres.
  Format them with `src/lib/format.ts`; never do arithmetic on them and send the
  result back. Pricing belongs to the API, which has the tariff and the tax
  rules.
- **A remote command answers 200 whatever happened.** The charger's refusal, a
  timeout, the charger being offline: all of it is in the body's `outcome`, not
  in the status code. `delivered` is the field that matters before retrying —
  a command that arrived and then timed out may have been carried out.
- **Role checks here only hide things.** `useCan('admin')` decides what to show.
  The API decides what happens. Do not let the two drift into the console being
  the thing that enforces.
- **This shadcn build sits on Base UI, not Radix.** There is no `asChild`; use
  the `render` prop. `Select`'s `onValueChange` gives `string | null`.
- **Configuration goes through `.env` and `src/lib/config.ts`**, which validates
  it at import. Next inlines `NEXT_PUBLIC_*` by literal text match, so each one
  has to be written out in full there — a computed lookup reads undefined in the
  browser.

## The progressive web app

`public/sw.js` is written by hand rather than generated: the usual generator for
Next does not support Turbopack, which is Next 16's default bundler. It caches
the hashed build assets and an offline page, and it never caches an API
response — a cached answer to "is this charger live?" is worse than no answer.
The `push` handler arrives with the driver phase, along with the VAPID keys.

The icons are drawn at request time by `src/app/icons/[size]/route.tsx` rather
than stored, so there is one drawing and no binaries in the repository.
