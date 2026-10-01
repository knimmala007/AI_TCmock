# Coverage gaps

Running log of known blind spots, so later agents know what wasn't tested.

| Date | Area | Gap | Status |
|---|---|---|---|
| 2026-10-01 | UI | No automated browser tests; UI checks are manual walk-throughs | Open |
| 2026-10-01 | Sign-in | Real Clerk sign-in isn't covered by `npm test` (tests use fake sign-in) | Open |
| 2026-10-01 | Storage | Tests use the in-memory store, not Upstash Redis | Open |
| 2026-10-01 | `masters-project-moe` | No automated tests on that branch | Open |

> TODO (fill later): add gaps found in each run.
