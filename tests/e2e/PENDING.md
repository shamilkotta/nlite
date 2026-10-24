# E2E suite: progress and pending work

Run: `cd tests/e2e && pnpm exec vitest run --config vitest.config.ts [specs/<name>.test.ts]`
(set `NLITE_E2E_SKIP_PACKAGE_BUILD=1` to skip rebuilding `packages/nlite`).

## Done (passing)

| Spec           | Covers                                                                                                                                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ssg            | auto static output (html/rsc/meta), nested routes, route groups, query/trailing slash, HEAD, `.rsc` stale time, force-cache fetch; negatives: cookies / dynamic segment / uncached fetch not prerendered |
| ssr            | cookies (multi, encoded, concurrent isolation), headers, layout-level dynamic APIs, uncached fetch, params decoding, catch-all, `.rsc` on demand                                                         |
| force-ssr      | skips prerender, ignores generateStaticParams, layout export ignored, invalid value = auto                                                                                                               |
| force-ssg      | request APIs and uncached fetch frozen at build, gSP listed vs unlisted                                                                                                                                  |
| static-params  | async gSP, catch-all, multi-segment, empty gSP, notFound for unknown param, baked searchParams, encoded params                                                                                           |
| search-params  | dev-mode searchParams; documents the build crash (see bugs)                                                                                                                                              |
| ppr            | shell + resumed holes, `.rsc` resume, `use cache` carried to resume, fetch cache, loading.tsx as hole, multiple holes, browser hydration, forged resume requests                                         |
| ppr-ssr        | force-ssr / force-ssg / gSP / dynamic routes / API / 404 with `ppr: true`                                                                                                                                |
| use-cache      | static bake, per-request dedupe, arg keying, undefined result → 500                                                                                                                                      |
| api-routes     | all methods, 405 + Allow, params, catch-all, form data, headers/set-cookie, 204, streaming, redirects, throws → 500, routing fallbacks                                                                   |
| not-found      | root/segment not-found.tsx, notFound() status, noindex, `.rsc` 404, non-HTML 404s, default UI fixture, browser checks                                                                                    |
| redirect       | 307 + Location, external, conditional, from layout, streamed redirect, `.rsc` digest, static meta refresh, browser + client-nav redirects                                                                |
| error-boundary | 500 status, segment / nested / global error UI, Suspense errors, client errors + reset()                                                                                                                 |
| layouts        | nesting order, group layouts, params in layouts                                                                                                                                                          |
| loading        | streamed fallback before content, parent loading.tsx, static pages without fallback                                                                                                                      |
| metadata       | title default/template/absolute, description/keywords/robots/canonical/OG/twitter, generateMetadata (params, searchParams, parent), title after hydration and client nav                                 |

## Currently failing (need triage)

- `client.test.ts` › "renders navigation hooks with the request URL": during SSR `usePathname()` returns `/` instead of `/hooks`. Likely a real bug (server navigation URL not visible to client components); confirm in `internal/navigation-context.ts` / `lib/navigation/client.tsx`.
- `navigation.test.ts` › "scrolls to the top … unless scroll={false}": probably a test bug, because `/b` is too short to keep any scroll offset. Give `/b` (or a new target page) a tall body and re-check.

All other specs in `client` and `navigation` pass.

## Pending specs and fixtures

- [ ] **stale-times**: `staleTimes: { static: 42, dynamic: 7 }`; check `_headers`, static `.rsc` = 42, SSR html/rsc and `_not-found.rsc` = 7; user `public/_headers` merged, not duplicated on rebuild.
- [ ] **config**: custom `appDir` (e.g. `src/routes`, `app/` ignored), function form of `defineConfig`, `vite` passthrough (alias); a fixture with **no** `nlite.config.ts` (default config).
- [ ] **dev**: `nlite dev` renders everything on demand (static and force-ssg live), static redirect → 307, static notFound → 404, errors → 500, API, adding/removing a route file at runtime is picked up, browser hydration and client nav in dev. Known issue to record: React "unique key" warning from `Document` in dev logs.
- [ ] **security**: XSS via cookie/query escaped in HTML and inline RSC script, path traversal (`..%2f`, `%2e%2e`) gives 404 with no source leak, malformed URI (`/users/%E0%A4%A`) doesn't crash the server, whether `*.meta` files (postponed state + cached fetch bodies) are publicly downloadable.
- [ ] **build-errors** (`fixtures/build-errors/*`): force-ssg dynamic route without gSP, `page` + `route` in the same segment, static page that throws, generateStaticParams that throws. Assert non-zero exit and a useful message.
- [ ] **adapters**: `vercel()` (config.json routes, static dir, `.vc-config.json`, PPR prerender files, invoke `functions/__nlite.func/index.js` with real `Request`s), `netlify()` (functions/edge output, `config.json`, generated `netlify.toml`, `_rsc` + `_redirects`, invoke function, `x-nlite-origin-url`), `cloudflare()` (build output; PPR without wrangler config fails with a clear error).

## Housekeeping

- [ ] `.gitignore`: the uncommitted line `tests/e2e/**/package.json` also ignores `tests/e2e/package.json`; narrow it. Add `tests/e2e/fixtures/**/netlify.toml` and `.vercel` / `.netlify` if the adapter fixtures are added.
- [ ] Root `package.json`: add `"test:e2e": "pnpm --filter nlite-e2e test"`.
- [ ] Run the full suite in parallel (default 4 workers) and check for flakiness; then `pnpm lint` / `pnpm format`.
- [ ] Optional: a short README in `tests/e2e` describing the harness (`useFixture`, `useUpstream`, `useBrowser`, `it.fails` = known bug).

## Framework bugs found so far (recorded as `it.fails`)

1. **Build crash when a page awaits `searchParams`** (PPR and non-PPR). In `trackSearchParams()` (`internal/request-context.ts`), `then(onFulfilled, onRejected)` only forwards `onRejected` to the inner promise, so a rejected `markDynamicUsage()` is unhandled and kills the prerender worker. Fix: `markDynamicUsage(...).then(() => value).then(onFulfilled, onRejected)`.
2. Prerendered params that need encoding (`hello%20world.html`) are never served; preview decodes the path first and falls back to SSR.
3. Static `.rsc` files are served with an empty `Content-Type`.
4. A static page that calls `notFound()` answers 200.
5. `/_not-found` is publicly served with 200.
6. The segment `not-found.tsx` UI is missing from the server HTML (it only appears after hydration), and the 404 `<title>` is lost after hydration.
7. RSC error digest = raw `error.message`, which leaks server error text to the client.
8. An exported `OPTIONS` handler never runs under `nlite preview` (Vite CORS middleware answers first).

Behaviours noted but not treated as bugs: under PPR, fully dynamic routes return 200 for redirect/notFound/errors (the shell already started streaming); non-deterministic values in a PPR shell cause hydration mismatches unless wrapped in `"use cache"`; generateStaticParams paths are always force-prerendered, even with PPR.
