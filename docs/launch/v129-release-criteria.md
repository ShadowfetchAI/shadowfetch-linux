# Shadowfetch Linux v1.2.9 Release Criteria

## Required before cutting v1.2.9

- [ ] Review all reports from v1.2.8 installs.
- [ ] Update `/linux/known-issues` with any confirmed recurring issue.
- [ ] Add tested-machine notes to `/linux/hardware` or a linked matrix.
- [ ] Confirm ISO checksum and detached signature generation.
- [ ] Confirm APT repo update path after fresh install.
- [ ] Run install smoke test in VM.
- [ ] Run live-boot smoke test on at least one physical machine if available.
- [ ] Confirm Welcome/local-AI flow does not download a model too large for disk.
- [ ] Confirm non-NVIDIA system removes NVIDIA stack after first boot as intended.
- [ ] Confirm changelog entry is ready before public upload.

## Candidate improvements

- Better first-run diagnostics output.
- Clearer local-AI model recommendations.
- NVIDIA/hybrid laptop documentation improvements.
- Secure Boot status note in installer docs and FAQ.
- Hardware report helper script.

## Release blockers

- Broken ISO boot.
- Broken Calamares install on basic VM target.
- Missing checksum or detached signature.
- Broken APT repo metadata.
- Any stale public version string.
