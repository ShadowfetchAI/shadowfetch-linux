# Deploying Shadowfetch Linux from your Mac

The ISO is built on `shadowfetch-linux` (the Pop!_OS box). To get it live at
https://shadowfetch.com/linux/, you run three commands from your Mac.

## One-time setup

```sh
# Install wrangler (Cloudflare's CLI)
brew install cloudflare-wrangler2

# Log into the same Cloudflare account that owns shadowfetch.com.
# Opens a browser, click approve.
wrangler login
```

That's it — wrangler stores credentials in `~/.config/.wrangler/`.

## Each release

From this directory on your Mac:

```sh
make ship
```

That single command does three things:

1. **`make sync-from-linux`** — rsyncs the freshly-built ISO, `.sha256`, `.asc`, and the reprepro APT repo from `shadowfetch-linux:~/projects/shadowfetch/` to this Mac.
2. **`make publish`** — uploads the ISO + APT repo files to the `shadowfetch-linux` R2 bucket via `wrangler r2 object put`.
3. **`make deploy-worker`** — deploys the `shadowfetch-linux` Cloudflare Worker (`cd web/shadowfetch-linux-worker && wrangler deploy`).

When it finishes, the latest ISO is available at:

- Landing: https://shadowfetch.com/linux/
- Direct download: https://shadowfetch.com/linux/download/shadowfetch-1.0.0-amd64.iso
- Checksum: https://shadowfetch.com/linux/download/shadowfetch-1.0.0-amd64.iso.sha256
- Signature: https://shadowfetch.com/linux/download/shadowfetch-1.0.0-amd64.iso.asc
- APT repo: https://shadowfetch.com/linux/apt/
- GPG key: https://shadowfetch.com/linux/shadowfetch.gpg.asc

## Individual steps (debug / partial deploys)

```sh
make sync-from-linux    # Pull artifacts from Linux box only
make publish            # Upload to R2 only (needs ISO local)
make deploy-worker      # Deploy Worker only (no ISO needed)
```

## Customizing the Linux build box

If the build box isn't reachable as `shadowfetch-linux` (e.g. you SSH it
differently), override:

```sh
make ship LINUX_HOST=rtx5060ti@192.168.32.2 LINUX_PATH=/home/rtx5060ti/projects/shadowfetch
```

## Troubleshooting

- **"wrangler not installed"** — `brew install cloudflare-wrangler2`
- **"You need to login first"** — `wrangler login`
- **"Could not find zone for shadowfetch.com"** — Wrangler is logged into the wrong Cloudflare account. Run `wrangler whoami` to check; if it's the wrong account, `wrangler logout && wrangler login`.
- **"R2 bucket does not exist"** — The bucket `shadowfetch-linux` should already exist (I provisioned it). Verify with `wrangler r2 bucket list`. If missing: `wrangler r2 bucket create shadowfetch-linux`.
- **Routes not registering** — Cloudflare's most-specific route wins. The shadowfetch-linux Worker routes are `shadowfetch.com/linux*` and `www.shadowfetch.com/linux*` — they take precedence over the shadowfetch-home Worker (which presumably has `shadowfetch.com/*` and similar). First deploy may take 30-60s to propagate.
