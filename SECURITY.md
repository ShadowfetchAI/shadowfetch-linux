# Security

## Release signing key

    Shadowfetch Project <signing@shadowfetch.com>
    ed25519  8F13CE1535EE1F4A2916A1F73C5C900B7BE80CA1
    created 2026-05-18, expires 2031-05-17

Every release ISO carries a detached signature (`.asc`) made with this key. The same key
signs the Shadowfetch APT repository, so on an installed system you can compare against
`/etc/apt/keyrings/shadowfetch.gpg`.

The public key is in this repository at [keys/shadowfetch-release.asc](keys/shadowfetch-release.asc),
and is attached to every GitHub release. It is deliberately published here, separately
from shadowfetch.com, so that verification material and the image it verifies do not
share a single account.

Checksum files are signed with a **detached** signature over the exact bytes, never
clearsigned. Verify the signature on the checksum file before trusting the checksum.

## Reporting a vulnerability

Email **support@shadowfetch.com**. Please do not open a public issue for an unpatched
security problem. Include the release version, your hardware, and reproduction steps.
