# Shadowfetch Linux Reviewer Kit

## One-line description

Shadowfetch Linux is a Debian/KDE creative workstation with local AI tooling, signed ISO releases, and a signed APT update path.

## Current release

- Release: Shadowfetch Linux v1.2.8 “Umbra”
- Architecture: amd64
- ISO: `shadowfetch-1.2.8-amd64.iso`
- Verify: https://www.shadowfetch.com/linux/verify
- Known issues: https://www.shadowfetch.com/linux/known-issues
- Hardware notes: https://www.shadowfetch.com/linux/hardware
- Security model: https://www.shadowfetch.com/linux/security
- Roadmap: https://www.shadowfetch.com/linux/roadmap
- FAQ: https://www.shadowfetch.com/linux/faq

## What to test

1. Boot the live ISO.
2. Verify the checksum and GPG signature.
3. Install with Calamares.
4. Run first-boot Welcome.
5. Try local AI setup through Ollama/Open-WebUI.
6. Open creative tools: Krita, GIMP, Inkscape, Kdenlive, OBS, Blender.
7. Run `sudo apt update && sudo apt upgrade` and confirm the Shadowfetch APT repo works.
8. Check NVIDIA/hybrid behavior if testing on NVIDIA hardware.

## Honest caveats

- Secure Boot is not signed yet.
- Debian testing moves faster than Debian stable.
- NVIDIA hybrid laptops vary by firmware and may need tuning.
- Local AI models need real disk and RAM headroom.
- Shadowfetch is independent and not endorsed by Debian.

## Reviewer pitch

Shadowfetch Linux is a young but real Debian/KDE creative workstation with local AI tooling, signed ISO releases, a signed APT repo, and a public known-issues page. It is early enough that serious reviewer feedback can still shape it, but complete enough to boot, install, update, and use as a creative desktop.

## Requested feedback

- Did the ISO verify cleanly?
- Did the live session boot?
- Did Calamares finish?
- Did networking, audio, graphics, sleep/wake, and updates work?
- Did the Welcome/local-AI flow make sense?
- What hardware failed or needed manual tuning?
- What copy overclaimed or underspecified the experience?
