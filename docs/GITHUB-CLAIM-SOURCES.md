# GitHub front-door claim/source ledger

This ledger exists so the README, SECURITY.md, issue templates, and 2.1.1 release notes can be checked without relying on memory or stronger-than-source claims.

## Live verification run for this rebuild

Command run from task `t_ad765592` workspace:

`python3 /home/rtx5060ti/.hermes-shadowfetch/bin/linux_integrity_check.py --json`

Evidence file:

`/home/rtx5060ti/.hermes/kanban/boards/shadowfetch-company/workspaces/t_ad765592/linux_integrity_check.json`

Observed from that command in this session:

- release.version: 2.1.1
- release.iso: shadowfetch-2.1.1-amd64.iso
- release.sha256: f5fe0f20dd24176839d0443f75ac4110587dff1a369785abdbe2121e213afdba
- integrity.status: PASS
- integrity checks: 14 total, 0 failing
- ownerApproval.status: PENDING

## Draft source

Kaitlan handoff:

`/home/rtx5060ti/.hermes/kanban/boards/shadowfetch-company/workspaces/t_2c49418d/shadowfetch-linux-github-content.md`

That handoff states it was drafted from existing changelog, site, build, and generated-facts sources only and still requires Zuri accuracy approval.

## Claim ledger

| Repo claim | Source checked |
|---|---|
| Current release is 2.1.1; ISO filename and SHA-256; integrity PASS; owner approval PENDING | `linux_integrity_check.py --json` evidence file above |
| APT suite/codename `umbra`; signing fingerprint `8F13 CE15 35EE 1F4A 2916 A1F7 3C5C 900B 7BE8 0CA1` | Kaitlan handoff; `CURRENT_FACTS.md` source named there; public verification/security pages |
| Makefile source of truth: VERSION 2.1.1, CODENAME umbra; build targets and ISO output naming | `/home/rtx5060ti/projects/shadowfetch/Makefile` |
| 2.1.1 corrects system-reported version surfaces by stamping from Makefile | `packages/shadowfetch-defaults/debian/changelog`, `packages/shadowfetch-branding/debian/changelog`, and Kaitlan handoff |
| Local AI one-screen claim | Kaitlan handoff from `/linux/agents` source and `docs/RELEASE-2.0.0.md` |
| Hardware minimums, Secure Boot caveat, NVIDIA/hybrid caveat | Kaitlan handoff from site `hardwarePage()` and `knownIssuesPage()` |
| Verification wording and GPG trust-warning posture | Kaitlan handoff from site `verifyPage()` |
| Bug and hardware report fields | Kaitlan handoff support-surface section |
| Tip-jar link | Kaitlan handoff sidebar links: `https://www.shadowfetch.com/linux/donate` |

## Guardrails retained

- Do not say the release is owner-approved; the live collector reports owner approval PENDING.
- Do not claim installs, users, market share, or DistroWatch conversion.
- Do not claim Secure Boot support.
- Do not claim every hardware combination works.
- Do not claim cloud providers are impossible; say cloud providers are optional and the local Ollama path can run on the user's hardware.
- Do not claim historical ISO redirect work is live unless an authorized deploy owner has deployed and probed it.
