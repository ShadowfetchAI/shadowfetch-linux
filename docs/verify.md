# Verifying your download

Two independent checks. The **checksum** proves the file arrived intact. The **signature**
proves Shadowfetch produced it. Do both — a checksum alone protects against a corrupt
download, not against a substituted one.

## The fingerprint

    8F13CE1535EE1F4A2916A1F73C5C900B7BE80CA1

Confirm this in at least two places before trusting it: this file, `SECURITY.md`, the
GitHub release page, and — on an installed Shadowfetch system — `/etc/apt/keyrings/shadowfetch.gpg`.
They are deliberately spread across providers.

## Linux / macOS

```sh
curl -O https://www.shadowfetch.com/linux/download/shadowfetch-2.0.0-amd64.iso
curl -O https://www.shadowfetch.com/linux/download/shadowfetch-2.0.0-amd64.iso.asc
curl -O https://raw.githubusercontent.com/ShadowfetchAI/shadowfetch-linux/main/keys/shadowfetch-release.asc

gpg --import shadowfetch-release.asc
gpg --fingerprint signing@shadowfetch.com          # compare with the fingerprint above
gpg --verify shadowfetch-2.0.0-amd64.iso.asc shadowfetch-2.0.0-amd64.iso
sha256sum -c <<< "0cbf9b90a4e561c57167cbac55d6fc4d02efc3dbd12a9c97c5034afc9fe6c671  shadowfetch-2.0.0-amd64.iso"
```

On macOS use `shasum -a 256 -c` in place of `sha256sum -c`, and install GnuPG first
(`brew install gnupg`).

Expected:

```
gpg: Good signature from "Shadowfetch Project <signing@shadowfetch.com>"
shadowfetch-2.0.0-amd64.iso: OK
```

**"Good signature" is what matters.** GnuPG will also print:

```
gpg: WARNING: This key is not certified with a trusted signature!
```

That is expected and not a problem. It means only that you have not personally signed the
key. The signature itself is valid. The warning disappears if you locally sign the key
after confirming the fingerprint out of band.

## Windows (PowerShell)

```powershell
Get-FileHash .\shadowfetch-2.0.0-amd64.iso -Algorithm SHA256
# compare the output with:
# 0cbf9b90a4e561c57167cbac55d6fc4d02efc3dbd12a9c97c5034afc9fe6c671
```

For the signature install Gpg4win, then run the `gpg --import` / `gpg --verify` commands above.

## If verification fails

A bad checksum is usually a truncated download — fetch it again. A **bad signature** on a
file whose checksum is correct is serious: do not install it, and email
support@shadowfetch.com with the URL you used.
