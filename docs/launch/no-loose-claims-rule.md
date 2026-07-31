# No Loose Claims Rule

Every public Shadowfetch claim must be one of:

1. **Verified** — backed by current tool output, live URL checks, release files, or source files.
2. **Sourced** — linked to an upstream source or public reference.
3. **Roadmap-labeled** — clearly marked as planned, target, or candidate work.
4. **Removed** — if it cannot be verified, sourced, or labeled as roadmap.

## Examples

### Good

- “Shadowfetch Linux v1.2.8 is available as an amd64 ISO.”
- “The ISO has a SHA-256 checksum and detached GPG signature.”
- “Secure Boot signing is planned later and is not available today.”
- “Shadowfetch Linux is independent and not endorsed by Debian.”

### Bad

- “Military-grade privacy.”
- “Works on all laptops.”
- “Enterprise-ready.”
- “Debian-approved.”
- “Runs every AI model locally.”

## Enforcement

If a phrase sounds impressive but cannot survive a skeptical Linux reviewer, cut it.
