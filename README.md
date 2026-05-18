# Shadowfetch Linux

A creative workstation Linux distribution built on Debian testing, with KDE Plasma 6, baked-in NVIDIA support, and a curated toolchain for visual artists, musicians, and video creators.

## Status

`v1.0 "Umbra"` — initial scaffolding. Not yet built or tested on hardware.

## Philosophy

- **Debian under the hood.** Security updates and the bulk of the package archive come from upstream Debian. We layer on top, we don't fork the world.
- **Opinionated defaults, escape hatches everywhere.** Dark theme, signature accent, curated apps, but everything is replaceable.
- **Creative-first.** GIMP, Krita, Inkscape, Blender, Ardour, Kdenlive, OBS, color management, PipeWire — installed and working out of the box.
- **Modern hardware works.** Proprietary NVIDIA, recent Mesa, modern kernel, Wayland-first.

## Repository layout

```
shadowfetch/
├── live-build/             # ISO build configuration
│   ├── auto/               # live-build entry-point scripts
│   └── config/
│       ├── package-lists/  # what gets installed
│       ├── hooks/live/     # chroot setup scripts
│       └── includes.*/     # files to drop into the ISO
├── packages/               # custom .deb sources
│   ├── shadowfetch-meta
│   ├── shadowfetch-welcome
│   ├── shadowfetch-themes
│   ├── shadowfetch-defaults
│   ├── shadowfetch-branding
│   ├── shadowfetch-creative-base
│   ├── shadowfetch-desktop
│   └── shadowfetch-nvidia
├── repo/                   # generated APT repo (after `make repo`)
├── .github/workflows/      # CI builds ISOs on push
├── Makefile                # build orchestration
└── README.md
```

## Building

You need a Debian (or Ubuntu) host. Other distros may work but are untested.

```sh
make deps        # install required tooling
make packages    # build custom .deb files
make repo        # build local APT repo
sudo make iso    # build a bootable ISO (takes 20–60 min)
make qemu        # test the ISO in QEMU
```

The finished ISO lands at `shadowfetch-<version>-amd64.iso` in the repo root.

## What's included by default

**System**: KDE Plasma 6, SDDM, PipeWire, NetworkManager, Flatpak (Flathub preconfigured), zram, earlyoom, tuned

**2D/Vector**: GIMP, Krita, Inkscape, Scribus

**3D**: Blender, FreeCAD, OpenSCAD

**Photo**: darktable, RawTherapee, digiKam, Hugin

**Audio**: Ardour, Audacity, LMMS, Hydrogen, Carla, full LV2 plugin set (LSP, x42, Calf)

**Video**: Kdenlive, Shotcut, OpenShot, OBS Studio, HandBrake

**Color**: ArgyllCMS, DisplayCAL, colord

**GPU**: Proprietary NVIDIA + CUDA (auto-removed at first boot if no NVIDIA detected)

## Roadmap

- [ ] Finish flesh-out of theme, defaults, branding packages
- [ ] Custom Plymouth boot splash
- [ ] Calamares installer theming
- [ ] First successful ISO build
- [ ] QEMU boot verification
- [ ] Real-hardware install test
- [ ] Public APT repo for incremental updates
