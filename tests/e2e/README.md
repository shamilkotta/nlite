# nlite e2e tests

Each feature lives in its own folder with a small fixture app and a matching `*.test.ts`.
Overlapping features also have suites under `combined/`.

```
tests/e2e/
  helpers/server.ts          # createApp(fixtureDir)
  auto-ssg/                  # individual feature
    app/
    auto-ssg.test.ts
  force-ssr/
  ...
  combined/
    rendering-modes/         # auto + force-ssg + force-ssr together
    suspense-with-cookies/
    client-with-link/
    dynamic-with-request-apis/
```

## Commands

```bash
pnpm test:e2e:install   # once — Playwright Chromium
pnpm test:e2e           # all feature suites (sequential)
pnpm test:e2e auto-ssg  # filter by name if needed: vitest run --project e2e auto-ssg
```

## Adding a feature

1. Create `tests/e2e/<feature>/app/` with the minimal routes for that behavior.
2. Add `<feature>.test.ts` that calls `createApp(__dirname)` in `beforeAll`.
3. If it overlaps another feature, also add `combined/<a-with-b>/`.
