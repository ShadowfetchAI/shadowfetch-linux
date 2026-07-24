# Shadowfetch Linux

A private, AI-ready creative workstation built on Debian — KDE Plasma 6, themed end to
end, with safe updates, recovery, local AI and the creative tools already working.

Current release: **2.0.0 "Umbra"** (2026-07-21) · Debian Testing derivative · amd64 hybrid ISO

## Download

    https://www.shadowfetch.com/linux/download/shadowfetch-2.0.0-amd64.iso

    4,486,000,640 bytes (4.18 GiB)
    sha256  0cbf9b90a4e561c57167cbac55d6fc4d02efc3dbd12a9c97c5034afc9fe6c671

The ISO is not hosted on GitHub: a GitHub release asset is capped at 2 GiB and this image
is more than twice that. Releases here carry the signing key, checksums, signatures and
release notes; the image itself is served from the project's own storage.

## Verify before you install

The signing key's full fingerprint is:

    8F13CE1535EE1F4A2916A1F73C5C900B7BE80CA1

```sh
curl -O https://www.shadowfetch.com/linux/download/shadowfetch-2.0.0-amd64.iso
curl -O https://www.shadowfetch.com/linux/download/shadowfetch-2.0.0-amd64.iso.asc
curl -O https://raw.githubusercontent.com/ShadowfetchAI/shadowfetch-linux/main/keys/shadowfetch-release.asc

gpg --import shadowfetch-release.asc
gpg --verify shadowfetch-2.0.0-amd64.iso.asc shadowfetch-2.0.0-amd64.iso
sha256sum -c <<< "0cbf9b90a4e561c57167cbac55d6fc4d02efc3dbd12a9c97c5034afc9fe6c671  shadowfetch-2.0.0-amd64.iso"
```

`gpg --verify` must print **Good signature**. A warning that the key is not certified is
normal — it only means you have not personally signed the key.

> The signing key and its fingerprint are published here on GitHub, on a different provider
> with different credentials from shadowfetch.com. Do not take the fingerprint from
> shadowfetch.com alone: the ISO, the checksum, the verify page and that site's TLS
> certificate are all under one account. Confirm it in at least two independent places —
> this README, `SECURITY.md`, the release page, and on an installed system
> `/etc/apt/keyrings/shadowfetch.gpg`, which is the same key.

See [docs/verify.md](docs/verify.md) for the long form.

## Licence

GPL-3.0-or-later. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

The Shadowfetch name, wordmark and emblem are trademarks and are **not** licensed for
reuse; the code, colour schemes and configuration behind the branding are GPL-3.0-or-later
like everything else.

Debian is a registered trademark of Software in the Public Interest, Inc. Shadowfetch Linux
is an independent derivative, not affiliated with or endorsed by the Debian project.
