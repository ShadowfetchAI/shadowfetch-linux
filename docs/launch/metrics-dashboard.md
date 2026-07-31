# Shadowfetch Linux Metrics Dashboard

## Weekly numbers

| Metric | Target, first 30 days | Current | Notes |
| --- | ---: | ---: | --- |
| Linux landing visits | 500 | TBD | `/linux` |
| ISO download clicks/downloads | 100 | TBD | `/linux/download/*` |
| Verification page visits | 25 | TBD | `/linux/verify` |
| Known-issues visits | 25 | TBD | `/linux/known-issues` |
| Hardware page visits | 25 | TBD | `/linux/hardware` |
| App Shelf outbound clicks | 50 | TBD | App Store links |
| Blog/founder-note reads | 100 | TBD | `/blog/*` |
| Reviewer/directory replies | 5 | TBD | manual tracking |
| Qualified install reports | 10 | TBD | manual tracking |

## Cost/risk watchlist

| Area | Risk | Mitigation |
| --- | --- | --- |
| Cloudflare/R2 | bandwidth/storage cost from ISO downloads | monitor R2 and cache behavior |
| Release maintenance | stale ISO, repo, or checksums | keep verify/changelog pages aligned |
| Legal/claims | overclaiming privacy or Debian relationship | use precise independent-derivative language |
| Support burden | hardware issues from young distro | publish known issues and hardware report checklist |
| App Shelf distraction | iOS catalog competes with Linux identity | keep Shelf secondary and curated |

## Stop-doing list

- Random app promotion that does not support the Linux story.
- Vague AI claims.
- Unsupported privacy promises.
- Social posts with no concrete artifact.
- Redesign churn without traffic, trust, distribution, or feedback impact.
