#!/usr/bin/env python3
"""Bring the public release repo in step with the release manifest.

Two things were wrong, both the same shape as the version bug:

1. README.md announced 2.1.0 with 2.1.0's filename and 2.1.0's sha256 - but the
   byte count and human size belonged to 2.0.0 (4,486,000,640 / 4.18 GiB against
   an image that is 4,509,110,272 / 4.20 GiB). Anyone checking the download
   against the stated size would have found a mismatch and reasonably concluded
   the file was corrupt.

2. releases/ held one manifest, 2.0.0.json, while three later releases had
   shipped. The directory claims to be the machine-readable record and was two
   releases short of being one.

Everything here is rewritten FROM the manifest, so re-running after the next
release is the whole update.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import sys
from pathlib import Path

# Self-locating: scripts/ sits one level below the repo root.
REPO = Path(__file__).resolve().parent.parent
# Canonical manifests live beside the site source; override for other checkouts.
SITE_RELEASES = Path(os.environ.get(
    "SF_SITE_RELEASES",
    Path.home() / ".sfbuild/release-sources/shadowfetch-astro-public/releases"))
V = os.environ.get("SF_VERSION", "2.1.1")

man = json.loads((SITE_RELEASES / f"{V}.json").read_text())
iso = man["iso"]
name, size, sha = iso["filename"], iso["sizeBytes"], iso["sha256"]
gib = size / 1024**3
print(f"manifest: {name}  {size:,} bytes ({gib:.2f} GiB)")
print(f"          sha256 {sha}")

# ---- 1. manifests -------------------------------------------------------------
dst = REPO / "releases"
dst.mkdir(exist_ok=True)
copied = []
for src in sorted(SITE_RELEASES.glob("*.json")):
    target = dst / src.name
    if not target.exists() or target.read_text() != src.read_text():
        shutil.copy2(src, target)
        copied.append(src.name)
print(f"manifests synced: {copied or 'already current'}")
print(f"  releases/ now holds: {sorted(p.name for p in dst.glob('*.json'))}")

# ---- 2. README ----------------------------------------------------------------
readme = REPO / "README.md"
t = readme.read_text()
before = t

# Filename everywhere (download URL, curl lines, gpg --verify, sha256sum -c).
t = re.sub(r"shadowfetch-\d+\.\d+\.\d+-amd64\.iso", name, t)
# The old checksum, wherever it appears.
t = re.sub(r"\b[0-9a-f]{64}\b", sha, t)
# The size line: byte count and binary size together, so they cannot part company.
t = re.sub(r"\b\d{1,3}(?:,\d{3})+ bytes \(\d+\.\d+ GiB\)",
           f"{size:,} bytes ({gib:.2f} GiB)", t)
# The headline.
t = re.sub(r"Current release: \*\*\d+\.\d+\.\d+ [“\"]Umbra[”\"]\*\* \(\d{4}-\d{2}-\d{2}\)",
           f'Current release: **{man["version"]} “{man["codename"]}”** ({man["date"]})', t)

readme.write_text(t)
print("README rewritten" if t != before else "README already current")

# ---- 3. prove it ---------------------------------------------------------------
stale_v = sorted(set(re.findall(r"\b[12]\.\d+\.\d+\b", t)) - {V})
stale_sha = sorted(set(re.findall(r"\b[0-9a-f]{64}\b", t)) - {sha})
sizes = sorted(set(re.findall(r"\b\d{1,3}(?:,\d{3})+ bytes \(\d+\.\d+ GiB\)", t)))
print("\nverification of the rewritten README:")
print(f"  versions present   : {sorted(set(re.findall(r'[12]\\.\\d+\\.\\d+', t)))}")
print(f"  stale versions     : {stale_v or 'none'}")
print(f"  stale checksums    : {stale_sha or 'none'}")
print(f"  size statements    : {sizes}")
ok = not stale_v and not stale_sha and len(sizes) == 1
print(f"  consistent         : {'YES' if ok else 'NO'}")
sys.exit(0 if ok else 1)
