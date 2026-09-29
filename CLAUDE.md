# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

This repo is one of three that make up ChargeVeta (a multi-tenant EV Charging Station Management System). If you can see a parent `charveta-app/` directory with sibling repos (`charveta`, `chargeveta-ocpp-engine`), read its `CLAUDE.md` too for how they fit together. This repo is the web front end: the operator/admin console today, and the home of the driver and fleet screens as those are built. It's a Next.js App Router PWA that holds no data of its own — every screen is a view of the `charveta` API, reached only through this app's own same-origin proxy.

## Commands

```bash
npm run dev         # http://localhost:9014 (https://charveta.appme.in) — needs the charveta API running first (see its own docs)
npm run build
npm run start        # serves the production build on :9014
npm run lint
npm run typecheck    # next typegen + tsc --noEmit — there is no test script/suite in this repo
```

Tenants and their owners are created by a platform admin at `/platform/tenants` (the first platform admin comes from `PLATFORM_ADMIN_EMAIL`/`PLATFORM_ADMIN_INITIAL_PASSWORD` in the API's `.env`); staff sign in at `/sign-in` with the tenant's slug, email and password, and a forgotten password is reset from `/sign-in/forgot`.

## Architecture

- **Two independent installable surfaces, one codebase**: the operator console (`src/app/(console)/`, manifest scope `/`) and the driver PWA (`src/app/driver/`, manifest scope `/driver`, served by its own hand-written `manifest.webmanifest` route handler since Next's `manifest.ts` file convention only ever runs at the app root). A third, non-installable surface is the fleet manager portal (`src/app/fleet/`, `charveta` doc 6 §23), where a fleet company's managers see their drivers, vehicles, depots, sessions and monthly billing; staff manage fleets in the console at `/fleets` (shown only when the operator has the `fleet` module, from `/auth/me`'s `enabledModules`). Components both use live in `src/components/fleet/`.
- **Nothing in the browser ever holds a token.** Signing in puts access/refresh tokens in `httpOnly` cookies. Every real API call goes through this app's own proxy — `src/app/api/cv/[...path]/route.ts` for staff (attaches/refreshes the token, retries once on a 401), `src/app/api/cvd/[...path]/route.ts` for drivers (its own `cvd_at`/`cvd_rt` cookie pair), `src/app/api/cvf/[...path]/route.ts` for fleet managers (`cvf_at`/`cvf_rt`, and an allow-list of `/fleet-manager/*` only). The API sends no CORS headers at all, so this isn't a convenience layer — it's the only way in. The one exception is realtime: `/api/realtime-token` hands the browser only the short-lived access token, for a direct Socket.IO connection (needs `REALTIME_ENABLED=true` on the API and this app's origin in `REALTIME_CORS_ORIGINS`; without it the console still works, just refetches on an interval instead of live-updating).
- **Layout**:
  ```
  src/app/(console)/     the staff screens behind sign-in
  src/app/driver/        the driver PWA (its own sign-in, session, and screens)
  src/app/fleet/         the fleet manager portal (its own sign-in, setup link, session, and screens)
  src/app/api/cv/        proxy to the API, staff session
  src/app/api/cvd/       proxy to the API, driver session
  src/app/api/cvf/       proxy to the API, fleet manager session
  src/app/sign-in/       the only page in front of the console
  src/components/        shared pieces; components/ui is shadcn's — don't hand-edit it
  src/lib/api/           the API's shapes and the browser's client(s)
  src/lib/server/        session cookies, server-side API calls, sign-in actions
  ```
- **Money is minor-unit decimal strings; energy is watt-hour decimal strings** (both `numeric` in Postgres, sent as strings to dodge float error). Always format with `src/lib/format.ts`; never do arithmetic on them and send the result back — pricing and tax belong to the API.
- **A remote command to a charger always answers HTTP 200.** The charger's refusal, a timeout, being offline — all of it is in the body's `outcome` (and `delivered`, the field to check before retrying), never in the status code.
- **Role checks here (`useCan('admin')`) only hide UI.** The API decides what actually happens; never let the two drift into the console believing it enforces anything.
- **This shadcn build sits on Base UI, not Radix.** There is no `asChild` — use the `render` prop. `Select`'s `onValueChange` gives `string | null`, not just `string`.
- **Configuration goes through `.env` and `src/lib/config.ts`**, validated at import. Next inlines `NEXT_PUBLIC_*` by literal text match at build time, so each one must be written out in full there — a computed lookup reads as `undefined` in the browser bundle.
- **One hand-written service worker**, `public/sw.js` — not generated, because the usual Next PWA generator doesn't support Turbopack (Next 16's default bundler). Shared by both the console and the driver PWA: it caches hashed build assets and an offline page, and it **never** caches an API response (a stale "is this charger live?" answer is worse than none). It also shows web pushes (VAPID) for both staff and driver subscriptions — registered globally in production; in development, turning push on for a device registers `/sw.js?mode=push-only`, which shows pushes without touching the request cache.
- **Icons are drawn at request time** (`src/app/icons/[size]/route.tsx`), not stored as binaries in the repo.
