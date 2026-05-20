# Security

`@feedbakkr/sdk` follows the [Feedbakkr org dependency-scanning policy][org-policy].
This doc captures only the sdk-specific bits — refer to the org doc for tools,
policy, and exception process.

[org-policy]: https://github.com/feedbakkr/feedbakkr/blob/main/docs/security-dependency-scanning.md

## Workflows in this repo

- **`security-pr.yml`** — runs `npm audit --audit-level=high` on every PR
  against `main`. **Blocking.** Fails the PR if a high+ advisory is present.
- **`security-scheduled.yml`** — nightly (03:30 UTC) + `workflow_dispatch`.
  Runs `npm audit --audit-level=moderate` plus OSV-Scanner. Reporting-only;
  uploads the JSON OSV report as a 30-day artifact.
- **`publish.yml`** — fires on `v*.*.*` tags or manual dispatch. Runs the
  `verify:publish` gate (tests → typecheck → audit → build → `npm pack
  --dry-run`) before `npm publish --provenance`.

## Local scans

```bash
npm run security:audit            # high+ — mirrors the PR gate
npm run security:audit:moderate   # moderate+ — mirrors the scheduled scan
npm run security:scan             # equivalent to security:audit (npm flavor)
npm run security:scan:full        # audit:moderate + osv-scanner
```

Install osv-scanner locally (macOS): `brew install osv-scanner`.

## Pre-publish gate

`verify:publish` is wired into `prepublishOnly`, so a stray `npm publish`
without going through CI will still run the gate locally:

1. `npm test` — unit tests
2. `npm run typecheck` — `tsc --noEmit`
3. `npm run security:audit` — `npm audit --audit-level=high`
4. `npm run build` — produces `dist/`
5. `npm pack --dry-run` — lists exactly what would ship

Any failure aborts the publish.

## Snapshot at rollout

`npm audit --audit-level=high` exits clean as of 2026-05-19 (0 vulnerabilities
after the initial `npm audit fix`). The PR audit workflow ships as blocking
from day one.
