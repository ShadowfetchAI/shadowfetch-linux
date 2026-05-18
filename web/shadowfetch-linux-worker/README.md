# shadowfetch-linux Worker

Cloudflare Worker that serves the `shadowfetch.com/linux/*` subtree:

- `/linux/` — landing page (auto-detects latest ISO in R2 and surfaces it)
- `/linux/download` — download page with checksum + signature instructions
- `/linux/download/<filename>` — streams from R2 `releases/<filename>` (Range-supporting)
- `/linux/install` — install guide (Calamares walkthrough + add-to-existing-Debian flow)
- `/linux/docs` — docs index (stub for v1)
- `/linux/changelog` — release notes
- `/linux/shadowfetch.gpg.asc` — public signing key (also at `/linux/apt/shadowfetch.gpg.asc` for `signed-by=`)
- `/linux/apt/...` — APT repo proxy, passes through R2 `apt/...` (reprepro output)

The existing `shadowfetch-home` Worker handles `shadowfetch.com/` (the apps studio). It is **not modified** by this Worker — Cloudflare's most-specific route match means `/linux*` lands here and everything else still goes to shadowfetch-home.

## R2 layout

Bucket: `shadowfetch-linux` (bound as `RELEASES`).

```
releases/shadowfetch-1.0.0-amd64.iso
releases/shadowfetch-1.0.0-amd64.iso.sha256
releases/shadowfetch-1.0.0-amd64.iso.asc       (detached signature)
apt/dists/umbra/InRelease
apt/dists/umbra/Release
apt/dists/umbra/main/binary-amd64/Packages.gz
apt/pool/main/s/shadowfetch-*/...
shadowfetch.gpg.asc
```

## Deploy

From this directory on a machine with `wrangler` installed and logged into the Cloudflare account that owns shadowfetch.com:

```sh
wrangler deploy
```

That registers the Worker and binds the routes from `wrangler.toml`. First deploy will prompt for `wrangler login` if not authenticated.

## Local dev

```sh
wrangler dev
```

Visit `http://localhost:8787/linux/` — note that R2 binding may be empty unless you've uploaded objects. The landing page degrades gracefully ("Build in progress — check back shortly") when no ISO is present.
