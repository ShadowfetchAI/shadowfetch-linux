// shadowfetch.com/linux/* — landing + download + APT repo proxy
// Bindings: RELEASES (R2 bucket "shadowfetch-linux")
//
// R2 layout:
//   releases/shadowfetch-<version>-amd64.iso
//   releases/shadowfetch-<version>-amd64.iso.sha256
//   releases/shadowfetch-<version>-amd64.iso.asc       (detached signature)
//   apt/dists/umbra/...                                (reprepro output)
//   apt/pool/main/s/shadowfetch-*/...                  (the .debs)
//   shadowfetch.gpg.asc                                (public signing key)

const GPG_FINGERPRINT = "8F13CE1535EE1F4A2916A1F73C5C900B7BE80CA1";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Strip trailing slash for routing consistency, except for root and obvious dirs
    const route = path === "/linux" ? "/linux/" : path;

    try {
      // -------- HTML pages --------
      if (route === "/linux/")                return html(landingPage(await latestRelease(env)));
      if (route === "/linux/install")         return html(installPage(await latestRelease(env)));
      if (route === "/linux/docs" ||
          route === "/linux/docs/")           return html(docsIndex());
      if (route === "/linux/changelog")       return html(changelogPage());

      // -------- Static asset: the GPG public key (also at /linux/apt/ for apt) --------
      if (route === "/linux/shadowfetch.gpg.asc")    return r2Stream(env, "shadowfetch.gpg.asc", request);
      if (route === "/linux/apt/shadowfetch.gpg.asc") return r2Stream(env, "shadowfetch.gpg.asc", request);

      // -------- ISO + checksum downloads --------
      if (route.startsWith("/linux/download/")) {
        const filename = route.slice("/linux/download/".length);
        if (!filename || filename.includes("..") || filename.includes("/")) return notFound();
        return r2Stream(env, `releases/${filename}`, request, { download: true });
      }
      if (route === "/linux/download")        return html(downloadPage(await latestRelease(env)));

      // -------- APT repo proxy (passes through reprepro structure) --------
      if (route.startsWith("/linux/apt/")) {
        const key = "apt/" + route.slice("/linux/apt/".length);
        if (key.includes("..")) return notFound();
        return r2Stream(env, key, request);
      }

      return notFound();
    } catch (err) {
      return new Response(`Server error: ${err.message}`, { status: 500 });
    }
  },
};

// ---------- R2 streaming with Range + HEAD ----------

async function r2Stream(env, key, request, opts = {}) {
  const range = request.headers.get("range");
  const r2opts = {};
  if (range) {
    const m = /bytes=(\d+)-(\d+)?/.exec(range);
    if (m) {
      const offset = parseInt(m[1], 10);
      const end = m[2] ? parseInt(m[2], 10) : undefined;
      r2opts.range = end !== undefined ? { offset, length: end - offset + 1 } : { offset };
    }
  }

  // HEAD: just check existence/metadata
  if (request.method === "HEAD") {
    const head = await env.RELEASES.head(key);
    if (!head) return notFound();
    const headers = baseHeaders(head, opts);
    return new Response(null, { status: 200, headers });
  }

  if (request.method !== "GET") return new Response("method not allowed", { status: 405 });

  const obj = await env.RELEASES.get(key, r2opts);
  if (!obj) return notFound();

  const headers = baseHeaders(obj, opts);
  let status = 200;
  if (range && obj.range) {
    status = 206;
    const total = obj.size;
    const start = obj.range.offset || 0;
    const len = obj.range.length || (total - start);
    headers.set("content-range", `bytes ${start}-${start + len - 1}/${total}`);
    headers.set("content-length", String(len));
  }
  return new Response(obj.body, { status, headers });
}

function baseHeaders(obj, opts) {
  const h = new Headers();
  h.set("accept-ranges", "bytes");
  if (obj.httpEtag) h.set("etag", obj.httpEtag);
  if (obj.size != null) h.set("content-length", String(obj.size));
  const ct = guessContentType(obj.key || "");
  h.set("content-type", ct);
  if (opts.download) {
    const filename = (obj.key || "download").split("/").pop();
    h.set("content-disposition", `attachment; filename="${filename}"`);
  }
  // Encourage CDN caching of large immutable artifacts
  if (/\.iso$|\.deb$|\.tar\.|\.gpg$|\.asc$/.test(obj.key || "")) {
    h.set("cache-control", "public, max-age=86400, immutable");
  } else {
    h.set("cache-control", "public, max-age=300");
  }
  return h;
}

function guessContentType(key) {
  if (key.endsWith(".iso"))   return "application/x-iso9660-image";
  if (key.endsWith(".sha256")) return "text/plain; charset=utf-8";
  if (key.endsWith(".asc"))   return "application/pgp-signature";
  if (key.endsWith(".gpg"))   return "application/pgp-keys";
  if (key.endsWith(".deb"))   return "application/vnd.debian.binary-package";
  if (key.endsWith(".gz"))    return "application/gzip";
  if (key.endsWith(".xz"))    return "application/x-xz";
  if (key.endsWith(".html"))  return "text/html; charset=utf-8";
  if (key.endsWith(".txt") || key === "Release" || key === "InRelease" || key.endsWith("Packages")) {
    return "text/plain; charset=utf-8";
  }
  return "application/octet-stream";
}

function notFound() {
  return html(notFoundPage(), 404);
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=60",
    },
  });
}

// ---------- Release discovery ----------

async function latestRelease(env) {
  try {
    const list = await env.RELEASES.list({ prefix: "releases/", limit: 100 });
    const isos = list.objects.filter(o => o.key.endsWith(".iso"));
    if (!isos.length) return null;
    isos.sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded));
    const iso = isos[0];
    const base = iso.key.slice("releases/".length);

    // Try to fetch the sha256 alongside (small, ~80 bytes)
    let sha256 = null;
    try {
      const shaObj = await env.RELEASES.get(`releases/${base}.sha256`);
      if (shaObj) {
        const txt = await shaObj.text();
        const m = /([a-f0-9]{64})/i.exec(txt);
        if (m) sha256 = m[1];
      }
    } catch (_) {}

    return {
      filename: base,
      size: iso.size,
      sizeHuman: humanBytes(iso.size),
      uploaded: iso.uploaded,
      sha256,
      hasSignature: list.objects.some(o => o.key === `releases/${base}.asc`),
    };
  } catch {
    return null;
  }
}

function humanBytes(n) {
  if (n == null) return "?";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 10 ? 0 : 1)} ${u[i]}`;
}

// ---------- HTML pages ----------

function shell({ title, head = "", body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="Shadowfetch Linux — a creative workstation Linux built on Debian. KDE Plasma 6, baked-in NVIDIA support, curated tools for visual artists, musicians, video creators.">
<style>${styles()}</style>
${head}
</head>
<body>
<header class="topbar">
  <a href="/linux/" class="brand">
    <span class="mark">◐</span>
    <span class="wordmark">Shadowfetch <em>Linux</em></span>
  </a>
  <nav>
    <a href="/linux/download">Download</a>
    <a href="/linux/install">Install</a>
    <a href="/linux/docs">Docs</a>
    <a href="/linux/changelog">Changelog</a>
    <a href="/" class="ghost">Apps&nbsp;Studio →</a>
  </nav>
</header>
<main>${body}</main>
<footer>
  <div class="foot-grid">
    <div>
      <strong>Shadowfetch Linux</strong><br>
      A creative workstation Linux, built on Debian.<br>
      <span class="muted">Part of the <a href="/">Shadowfetch</a> family.</span>
    </div>
    <div>
      <strong>Get it</strong><br>
      <a href="/linux/download">ISO download</a><br>
      <a href="/linux/apt/">APT repo</a><br>
      <a href="/linux/shadowfetch.gpg.asc">GPG signing key</a>
    </div>
    <div>
      <strong>Learn</strong><br>
      <a href="/linux/install">Install guide</a><br>
      <a href="/linux/docs">Documentation</a><br>
      <a href="/linux/changelog">Release notes</a>
    </div>
  </div>
  <p class="muted small">Debian is a registered trademark of Software in the Public Interest, Inc. Shadowfetch Linux is an independent derivative and is not affiliated with or endorsed by the Debian project.</p>
</footer>
</body>
</html>`;
}

function landingPage(release) {
  const dlButton = release
    ? `<a class="btn primary" href="/linux/download/${escapeAttr(release.filename)}">Download ${escapeHtml(release.sizeHuman)} ISO</a>`
    : `<a class="btn primary muted-btn" href="/linux/download">Build in progress — check back shortly</a>`;
  const meta = release
    ? `<p class="release-meta">v1.0 "Umbra" · ${escapeHtml(release.filename)} · <a href="/linux/download">checksum + signature</a></p>`
    : `<p class="release-meta">v1.0 "Umbra" — first ISO build in flight</p>`;

  return shell({
    title: "Shadowfetch Linux — a creative workstation, built on Debian",
    body: `
<section class="hero">
  <div class="hero-copy">
    <h1>A creative workstation Linux, built on Debian.</h1>
    <p class="lede">KDE Plasma 6. Baked-in NVIDIA support that disables itself if you don't need it. Every creative tool you'd otherwise spend a weekend installing — GIMP, Krita, Inkscape, Blender, darktable, Ardour, Kdenlive, OBS — already there, working, themed.</p>
    <div class="cta-row">
      ${dlButton}
      <a class="btn ghost" href="/linux/install">How to install →</a>
    </div>
    ${meta}
  </div>
  <div class="hero-side">
    <pre class="ascii-eclipse">                    ░░░░░░░
                ░░░░░░░░░░░░░░░
             ░░░░░░░░░░░░░░░░░░░░░
           ░░░░░░░░░░░░░░░░░░░░░░░░░
          ░░░░░░░░░░░░░░░░░░░░░░░░░░░
         ░░░░░░░░ ░░░░░░░░░░░░░ ░░░░░░░
        ░░░░░░    ░░░░░░░░░░░░░   ░░░░░░
        ░░░░░     SHADOWFETCH      ░░░░░
        ░░░░░        LINUX         ░░░░░
        ░░░░░     UMBRA  1.0       ░░░░░
        ░░░░░░    ░░░░░░░░░░░░░   ░░░░░░
         ░░░░░░░░ ░░░░░░░░░░░░░ ░░░░░░░
          ░░░░░░░░░░░░░░░░░░░░░░░░░░░
           ░░░░░░░░░░░░░░░░░░░░░░░░░
             ░░░░░░░░░░░░░░░░░░░░░
                ░░░░░░░░░░░░░░░
                    ░░░░░░░</pre>
  </div>
</section>

<section class="band">
  <h2>What you get out of the box</h2>
  <div class="grid-4">
    <div class="card">
      <h3>2D / Vector</h3>
      <p>GIMP, Krita, Inkscape, Scribus</p>
    </div>
    <div class="card">
      <h3>Photo</h3>
      <p>darktable, RawTherapee, digiKam, Hugin</p>
    </div>
    <div class="card">
      <h3>Audio</h3>
      <p>Ardour, Audacity, Hydrogen, qtractor, full LV2 plugin set (LSP, x42, Calf)</p>
    </div>
    <div class="card">
      <h3>Video / Streaming</h3>
      <p>Kdenlive, Shotcut, OBS Studio, HandBrake</p>
    </div>
    <div class="card">
      <h3>3D / CAD</h3>
      <p>FreeCAD, OpenSCAD, MeshLab</p>
    </div>
    <div class="card">
      <h3>Color</h3>
      <p>ArgyllCMS, DisplayCAL, colord</p>
    </div>
    <div class="card">
      <h3>GPU</h3>
      <p>Proprietary NVIDIA + CUDA, auto-removed at first boot if no NVIDIA detected</p>
    </div>
    <div class="card">
      <h3>System</h3>
      <p>PipeWire, zram, earlyoom, tuned, Flatpak (Flathub pre-configured)</p>
    </div>
  </div>
</section>

<section class="band alt">
  <h2>Built honestly on Debian</h2>
  <div class="two-col">
    <div>
      <p>Shadowfetch is a Debian-testing derivative. Security updates and 99% of the package archive come from upstream Debian. We layer on top — a curated default stack, a dark theme, a first-boot wizard, opinionated PipeWire/zram/earlyoom config — and that's it. We don't fork anything we don't have to.</p>
      <p>If you've used Debian, you already know how to use Shadowfetch. <code>apt</code> works. <code>dpkg</code> works. Everything you can install on Debian, you can install here.</p>
    </div>
    <div>
      <h4>System requirements</h4>
      <ul>
        <li>64-bit x86 CPU (Intel or AMD)</li>
        <li>4 GB RAM minimum, 8 GB+ recommended</li>
        <li>40 GB disk minimum, 100 GB+ recommended for creative workflows</li>
        <li>UEFI or legacy BIOS boot</li>
        <li>NVIDIA, AMD, or Intel GPU (NVIDIA gets the proprietary stack out of the box)</li>
      </ul>
    </div>
  </div>
</section>
`,
  });
}

function downloadPage(release) {
  const hasRelease = !!release;
  const dl = release ? `/linux/download/${escapeAttr(release.filename)}` : "#";
  const shaLine = release && release.sha256
    ? `<code>${escapeHtml(release.sha256)}</code>  <span class="muted">${escapeHtml(release.filename)}</span>`
    : `<span class="muted">checksum will appear here once the first build completes</span>`;

  return shell({
    title: "Download — Shadowfetch Linux",
    body: `
<section class="narrow">
  <h1>Download Shadowfetch Linux</h1>
  ${hasRelease
    ? `<p class="lede">v1.0 "Umbra" — built ${escapeHtml(formatDate(release.uploaded))}. ${escapeHtml(release.sizeHuman)}, amd64, hybrid ISO (BIOS + UEFI).</p>`
    : `<p class="lede">The first Shadowfetch Linux ISO is currently being built. Subscribe to the <a href="/">apps studio blog</a> for the launch announcement, or check back here in a bit.</p>`}

  <div class="dl-card ${hasRelease ? "" : "disabled"}">
    <div>
      <div class="dl-name">${hasRelease ? escapeHtml(release.filename) : "shadowfetch-1.0.0-amd64.iso"}</div>
      <div class="dl-meta">${hasRelease ? escapeHtml(release.sizeHuman) + " · amd64 · hybrid ISO" : "Build pending"}</div>
    </div>
    <a class="btn primary" href="${dl}">${hasRelease ? "Download ISO" : "Pending"}</a>
  </div>

  <h2>Verify your download</h2>
  <p>Every release is checksummed and signed with the Shadowfetch GPG key.</p>
  <h4>SHA-256</h4>
  <pre class="kv">${shaLine}</pre>
  <h4>GPG signing key</h4>
  <p>Fingerprint: <code>${GPG_FINGERPRINT}</code></p>
  <p><a class="btn ghost" href="/linux/shadowfetch.gpg.asc">Download public key (.asc)</a></p>
  <p class="muted small">Verify on Linux/macOS with:<br>
  <code>gpg --import shadowfetch.gpg.asc</code><br>
  <code>gpg --verify ${hasRelease ? escapeHtml(release.filename) : "shadowfetch-*.iso"}.asc</code><br>
  <code>shasum -a 256 ${hasRelease ? escapeHtml(release.filename) : "shadowfetch-*.iso"}</code></p>

  <h2>Write the ISO to a USB stick</h2>
  <p>On macOS / Linux:</p>
  <pre><code>sudo dd if=${hasRelease ? escapeHtml(release.filename) : "shadowfetch-*.iso"} of=/dev/sdX bs=4M status=progress conv=fdatasync</code></pre>
  <p class="muted small">Replace <code>/dev/sdX</code> with your USB stick's device (use <code>lsblk</code> or <code>diskutil list</code> to find it). <strong>Double-check the device — <code>dd</code> will destroy whatever it's pointed at.</strong></p>
  <p>Or use a GUI tool: <a href="https://etcher.balena.io/" rel="noreferrer noopener">balenaEtcher</a>, <a href="https://github.com/Karmaz95/Diskie" rel="noreferrer noopener">Diskie</a>, or KDE's own ISO Image Writer.</p>

  <p><a class="btn ghost" href="/linux/install">Next: install guide →</a></p>
</section>
`,
  });
}

function installPage(release) {
  const fn = release?.filename || "shadowfetch-*.iso";
  return shell({
    title: "Install — Shadowfetch Linux",
    body: `
<section class="narrow">
  <h1>Installing Shadowfetch Linux</h1>
  <p class="lede">It's the standard Debian live-install experience — boot the ISO, click through Calamares, reboot. About 15 minutes start to finish.</p>

  <ol class="steps">
    <li>
      <h3>Boot from the USB stick</h3>
      <p>Plug in the USB, power on, hit your system's boot-menu key (usually <kbd>F12</kbd>, <kbd>F11</kbd>, <kbd>F2</kbd>, or <kbd>Del</kbd>), select the USB device. You'll land in a live session — you can try Shadowfetch before installing.</p>
    </li>
    <li>
      <h3>Launch the installer</h3>
      <p>From the desktop, double-click <strong>"Install Shadowfetch Linux"</strong> (or run <code>calamares</code> from a terminal). Calamares walks you through region, keyboard, partitioning, user account, and a final summary.</p>
    </li>
    <li>
      <h3>Partition</h3>
      <p>For most users, pick "Erase disk" with default options. If you're dual-booting, use "Manual partitioning" and shrink an existing partition. Shadowfetch defaults to ext4; pick btrfs if you want snapshots.</p>
    </li>
    <li>
      <h3>Wait ~10 minutes</h3>
      <p>The installer copies the live system to disk, installs the bootloader (GRUB), and configures your user. Make a coffee.</p>
    </li>
    <li>
      <h3>Reboot into your installed system</h3>
      <p>Remove the USB when prompted, boot back up. On first login the <strong>Shadowfetch Welcome</strong> wizard runs — pick your accent color, optionally install Flatpak extras (Bitwig demo, REAPER, Signal, Spotify), and you're done.</p>
    </li>
  </ol>

  <h2>First-boot notes</h2>
  <ul>
    <li><strong>NVIDIA:</strong> If your system has an NVIDIA GPU, the proprietary driver is already installed. If not, a first-boot service detects this and removes the NVIDIA stack to reclaim ~2 GB.</li>
    <li><strong>Multi-GPU laptops:</strong> PRIME is set to on-demand mode automatically. Run apps with <code>__NV_PRIME_RENDER_OFFLOAD=1 __GLX_VENDOR_LIBRARY_NAME=nvidia &lt;app&gt;</code> to use the discrete GPU.</li>
    <li><strong>Updates:</strong> Run <code>sudo apt update && sudo apt upgrade</code>, or use Discover (KDE's app/update store). Shadowfetch updates flow from <code>https://shadowfetch.com/linux/apt/</code>; Debian updates flow from the usual mirrors.</li>
    <li><strong>Flathub:</strong> Pre-configured. Open Discover, search, install — works.</li>
  </ul>

  <h2>Add the Shadowfetch APT repo to an existing Debian system</h2>
  <p>If you already run Debian and just want the Shadowfetch metapackages without reinstalling, you can pull them via apt:</p>
  <pre><code>curl -fsSL https://shadowfetch.com/linux/apt/shadowfetch.gpg.asc \\
  | sudo gpg --dearmor -o /etc/apt/keyrings/shadowfetch.gpg

echo "deb [signed-by=/etc/apt/keyrings/shadowfetch.gpg] https://shadowfetch.com/linux/apt/ umbra main" \\
  | sudo tee /etc/apt/sources.list.d/shadowfetch.list

sudo apt update
sudo apt install shadowfetch-desktop      # full creative workstation
# or pick à la carte:
sudo apt install shadowfetch-themes shadowfetch-defaults
sudo apt install shadowfetch-creative-base</code></pre>
</section>
`,
  });
}

function docsIndex() {
  return shell({
    title: "Docs — Shadowfetch Linux",
    body: `
<section class="narrow">
  <h1>Documentation</h1>
  <p class="lede">Docs are still being written. Here's what's solid today:</p>
  <ul>
    <li><a href="/linux/install">Installation guide</a> — get Shadowfetch onto a machine</li>
    <li><a href="/linux/download">Download &amp; verify</a> — checksums, signatures, USB writing</li>
    <li><a href="/linux/changelog">Changelog</a> — what's in each release</li>
  </ul>
  <p>More guides coming: building Shadowfetch from source, customizing the creative app set, adding your own packages to the APT repo, color management workflow, audio low-latency tuning.</p>
  <p class="muted">Want to contribute a guide? Open a PR on the <a href="https://github.com/RobertCorbin/shadowfetch">project repo</a> (link will go live once we publish).</p>
</section>
`,
  });
}

function changelogPage() {
  return shell({
    title: "Changelog — Shadowfetch Linux",
    body: `
<section class="narrow">
  <h1>Changelog</h1>

  <article class="release">
    <h2>1.0.0 "Umbra" <span class="muted">— 2026-05</span></h2>
    <ul>
      <li>Initial release of Shadowfetch Linux.</li>
      <li>KDE Plasma 6 desktop on Debian testing.</li>
      <li>Full creative workstation stack: GIMP, Krita, Inkscape, darktable, RawTherapee, Ardour, Audacity, Kdenlive, OBS Studio.</li>
      <li>Proprietary NVIDIA driver baked in, auto-removed on non-NVIDIA hardware at first boot.</li>
      <li>Shadowfetch Dark color scheme and signature violet accent.</li>
      <li>First-boot welcome wizard with accent picker and optional Flatpak installs.</li>
      <li>PipeWire audio with the full LV2 plugin baseline (LSP, x42, Calf).</li>
      <li>APT repo at <code>shadowfetch.com/linux/apt/</code> for incremental updates.</li>
    </ul>
  </article>
</section>
`,
  });
}

function notFoundPage() {
  return shell({
    title: "Not found — Shadowfetch Linux",
    body: `
<section class="narrow center">
  <h1>404</h1>
  <p class="lede">Whatever you were looking for, we don't have it.</p>
  <p><a class="btn primary" href="/linux/">Back to Shadowfetch Linux</a></p>
</section>
`,
  });
}

// ---------- utilities ----------

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
function formatDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toISOString().slice(0, 10);
}

// ---------- styles ----------

function styles() {
  return `
:root {
  --bg: #0a0a10;
  --bg-2: #14141d;
  --bg-3: #1a1a23;
  --line: #2a2a35;
  --ink: #e8e8f2;
  --ink-dim: #a0a0b0;
  --ink-mute: #6f6f80;
  --accent: #8b5cf6;
  --accent-2: #a78bfa;
  --accent-warm: #fbbf24;
  --max: 1100px;
  --radius: 14px;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--bg);
  color: var(--ink);
  font: 16px/1.6 -apple-system, "SF Pro Text", "Segoe UI", Inter, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
a { color: var(--accent); text-decoration: none; }
a:hover { color: var(--accent-2); text-decoration: underline; }
code, pre, kbd { font-family: "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace; }
code { background: var(--bg-3); padding: 2px 6px; border-radius: 4px; font-size: 0.92em; }
pre {
  background: var(--bg-3);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 14px 16px;
  overflow-x: auto;
  font-size: 0.92em;
}
pre code { background: transparent; padding: 0; }
kbd {
  background: var(--bg-3); border: 1px solid var(--line); border-bottom-width: 2px;
  padding: 2px 6px; border-radius: 5px; font-size: 0.85em;
}
.muted { color: var(--ink-dim); }
.small { font-size: 0.88em; }

/* Top bar */
.topbar {
  position: sticky; top: 0; z-index: 10;
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 24px;
  background: rgba(10,10,16,0.92);
  border-bottom: 1px solid var(--line);
  backdrop-filter: blur(8px);
}
.brand { display: flex; align-items: center; gap: 10px; font-weight: 700; color: var(--ink); }
.brand:hover { text-decoration: none; color: var(--accent-2); }
.brand .mark { color: var(--accent); font-size: 1.5em; line-height: 1; }
.brand .wordmark em { font-style: normal; color: var(--accent); font-weight: 600; }
.topbar nav { display: flex; gap: 18px; flex-wrap: wrap; }
.topbar nav a { color: var(--ink-dim); font-size: 0.95em; }
.topbar nav a:hover { color: var(--ink); text-decoration: none; }
.topbar nav a.ghost { color: var(--ink-mute); }

main { max-width: var(--max); margin: 0 auto; padding: 32px 24px 64px; }

/* Hero */
.hero {
  display: grid; grid-template-columns: 1.4fr 1fr; gap: 40px;
  align-items: center;
  padding: 56px 0 64px;
}
.hero h1 { font-size: clamp(28px, 4.4vw, 48px); line-height: 1.15; margin: 0 0 16px; letter-spacing: -0.02em; }
.lede { font-size: 1.12em; color: var(--ink-dim); margin: 0 0 24px; }
.cta-row { display: flex; gap: 12px; flex-wrap: wrap; }
.release-meta { margin-top: 18px; color: var(--ink-mute); font-size: 0.92em; }
.hero-side { display: flex; justify-content: center; }
.ascii-eclipse {
  font-size: 9px; line-height: 1.05; color: var(--accent);
  background: transparent; border: none; padding: 0;
  user-select: none;
}

/* Buttons */
.btn {
  display: inline-block;
  padding: 12px 22px;
  border-radius: 10px;
  font-weight: 700;
  border: 1px solid transparent;
  transition: transform 0.05s ease, background 0.2s ease;
}
.btn:hover { text-decoration: none; transform: translateY(-1px); }
.btn.primary { background: var(--accent); color: #0a0a10; }
.btn.primary:hover { background: var(--accent-2); color: #0a0a10; }
.btn.ghost { background: transparent; color: var(--ink); border-color: var(--line); }
.btn.ghost:hover { border-color: var(--accent); color: var(--accent); }
.btn.muted-btn { background: var(--bg-3); color: var(--ink-dim); cursor: not-allowed; }

/* Bands / sections */
.band { padding: 56px 0; border-top: 1px solid var(--line); }
.band.alt { background: var(--bg-2); margin: 0 -9999px; padding-left: 9999px; padding-right: 9999px; }
.band h2 { font-size: 1.7em; margin: 0 0 28px; letter-spacing: -0.01em; }
.grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.card {
  background: var(--bg-3); border: 1px solid var(--line); border-radius: var(--radius);
  padding: 18px;
}
.card h3 { margin: 0 0 6px; font-size: 1em; color: var(--accent); }
.card p { margin: 0; color: var(--ink-dim); font-size: 0.93em; }
.two-col { display: grid; grid-template-columns: 1.4fr 1fr; gap: 40px; align-items: start; }
.two-col h4 { margin: 0 0 8px; font-size: 1em; color: var(--accent); text-transform: uppercase; letter-spacing: 0.04em; }
.two-col ul { margin: 0; padding-left: 20px; color: var(--ink-dim); }
.two-col li { margin: 4px 0; }

/* Narrow content (download/install/docs/changelog) */
.narrow { max-width: 760px; margin: 0 auto; }
.narrow.center { text-align: center; }
.narrow h1 { font-size: 2.2em; margin: 0 0 12px; letter-spacing: -0.01em; }
.narrow h2 { margin-top: 40px; font-size: 1.4em; color: var(--accent); }
.narrow h4 { margin-top: 18px; margin-bottom: 6px; font-size: 0.95em; color: var(--ink-dim); text-transform: uppercase; letter-spacing: 0.04em; }

/* Download card */
.dl-card {
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; flex-wrap: wrap;
  background: var(--bg-3); border: 1px solid var(--line); border-radius: var(--radius);
  padding: 18px 22px; margin: 24px 0 32px;
}
.dl-card.disabled { opacity: 0.7; }
.dl-name { font-weight: 700; font-size: 1.05em; }
.dl-meta { color: var(--ink-dim); font-size: 0.9em; margin-top: 4px; }
.kv { background: var(--bg-3); padding: 12px 16px; word-break: break-all; }

/* Install steps */
.steps { list-style: none; padding: 0; counter-reset: step; }
.steps > li {
  position: relative; padding: 18px 18px 18px 70px; margin: 14px 0;
  background: var(--bg-3); border: 1px solid var(--line); border-radius: var(--radius);
  counter-increment: step;
}
.steps > li::before {
  content: counter(step);
  position: absolute; left: 18px; top: 18px;
  width: 36px; height: 36px; border-radius: 50%;
  display: grid; place-items: center;
  background: var(--accent); color: #0a0a10; font-weight: 800;
}
.steps h3 { margin: 0 0 6px; font-size: 1.05em; }
.steps p { margin: 0; color: var(--ink-dim); }

/* Release entries (changelog) */
.release { padding: 22px 0; border-bottom: 1px solid var(--line); }
.release h2 { margin: 0 0 12px; color: var(--ink); }
.release ul { color: var(--ink-dim); }

/* Footer */
footer {
  max-width: var(--max);
  margin: 0 auto;
  padding: 32px 24px 48px;
  border-top: 1px solid var(--line);
  color: var(--ink-dim);
  font-size: 0.92em;
}
.foot-grid { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 32px; margin-bottom: 24px; }
footer strong { color: var(--ink); }
footer a { color: var(--ink-dim); }
footer a:hover { color: var(--accent); }

/* Responsive */
@media (max-width: 760px) {
  .topbar { flex-wrap: wrap; gap: 10px; padding: 12px 16px; }
  .hero { grid-template-columns: 1fr; gap: 24px; padding: 32px 0; }
  .hero-side { display: none; }
  .grid-4 { grid-template-columns: 1fr 1fr; }
  .two-col { grid-template-columns: 1fr; gap: 24px; }
  .foot-grid { grid-template-columns: 1fr; gap: 20px; }
}
@media (max-width: 460px) {
  .grid-4 { grid-template-columns: 1fr; }
}
`;
}
