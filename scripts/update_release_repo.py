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

# ---- 2. prose that names the release ------------------------------------------
# docs/verify.md is the long form the README links to. It walked a reader
# through verifying 2.0.0 against 2.0.0's checksum: internally consistent, and
# two releases out of date, which sends anyone following it to an old image.
TARGETS = ["README.md", "docs/verify.md"]


def restate(text: str) -> str:
    """Rewrite every release fact in one pass, so none can drift from another."""
    # Filename everywhere: download URL, curl lines, gpg --verify, sha256sum -c.
    text = re.sub(r"shadowfetch-\d+\.\d+\.\d+-amd64\.iso", name, text)
    # The checksum, wherever it appears.
    text = re.sub(r"\b[0-9a-f]{64}\b", sha, text)
    # Byte count and human size are replaced together so they cannot part
    # company - which is exactly how 2.1.0's filename ended up beside 2.0.0's
    # size.
    text = re.sub(r"\b\d{1,3}(?:,\d{3})+ bytes \(\d+\.\d+ GiB\)",
                  f"{size:,} bytes ({gib:.2f} GiB)", text)
    text = re.sub(
        r"Current release: \*\*\d+\.\d+\.\d+ [“\"]Umbra[”\"]\*\* \(\d{4}-\d{2}-\d{2}\)",
        f'Current release: **{man["version"]} “{man["codename"]}”** ({man["date"]})',
        text)
    return text


changed = []
for rel in TARGETS:
    f = REPO / rel
    if not f.is_file():
        print(f"  NOTE: {rel} absent, skipped")
        continue
    orig = f.read_text()
    new = restate(orig)
    if new != orig:
        f.write_text(new)
        changed.append(rel)
print(f"rewritten: {changed or 'nothing needed changing'}")

# ---- 3. prove it ---------------------------------------------------------------
print("\nverification:")
ok = True
for rel in TARGETS:
    f = REPO / rel
    if not f.is_file():
        continue
    t = f.read_text()
    versions = sorted(set(re.findall(r"\b[12]\.\d+\.\d+\b", t)))
    stale_v = [x for x in versions if x != V]
    shas = sorted(set(re.findall(r"\b[0-9a-f]{64}\b", t)))
    stale_sha = [x for x in shas if x != sha]
    sizes = sorted(set(re.findall(r"\b\d{1,3}(?:,\d{3})+ bytes \(\d+\.\d+ GiB\)", t)))
    good = not stale_v and not stale_sha and len(sizes) <= 1
    ok = ok and good
    print(f"  {rel}")
    print(f"    versions        {versions or 'none'}")
    print(f"    stale versions  {stale_v or 'none'}")
    print(f"    checksums       {[s[:12] + '…' for s in shas] or 'none'}")
    print(f"    stale checksums {[s[:12] + '…' for s in stale_sha] or 'none'}")
    print(f"    size statements {sizes or 'none'}")
    print(f"    consistent      {'YES' if good else 'NO'}")
sys.exit(0 if ok else 1)
