# Shadowfetch Linux — top-level build orchestration
#
# Common targets:
#   make deps       Install build dependencies (Debian host required)
#   make packages   Build all custom .deb packages
#   make repo       Generate the local APT repo from built packages
#   make iso        Build the bootable ISO (uses sudo; needs local repo)
#   make qemu       Boot the built ISO in QEMU for testing
#   make clean      Clean the live-build tree
#   make distclean  Wipe everything regenerable

SHELL := /bin/bash
VERSION  ?= 1.0.0
CODENAME ?= umbra
ISO_NAME := shadowfetch-$(VERSION)-amd64.iso

# Real source packages — each has its own debian/ tree.
# shadowfetch-meta builds three binary metapackages internally
# (shadowfetch-desktop, shadowfetch-creative-base, shadowfetch-nvidia).
PACKAGES := \
	shadowfetch-meta \
	shadowfetch-welcome \
	shadowfetch-themes \
	shadowfetch-defaults \
	shadowfetch-branding

# GPG key the APT repo signs with. Override with `make REPO_KEY_ID=...` if
# you've regenerated the key. The default matches the key on shadowfetch-linux.
REPO_KEY_ID ?= 8F13CE1535EE1F4A2916A1F73C5C900B7BE80CA1

# Port used to serve the local repo to the chroot during ISO build.
LOCAL_REPO_PORT ?= 8089

ROOT      := $(CURDIR)
BUILD_DIR := $(ROOT)/build
REPO_DIR  := $(ROOT)/repo
LB_DIR    := $(ROOT)/live-build

.PHONY: all help deps packages repo iso qemu clean distclean

all: iso

help:
	@echo "Shadowfetch build system"
	@echo "  make deps       Install required build dependencies"
	@echo "  make packages   Build all .deb packages"
	@echo "  make repo       Build local APT repository"
	@echo "  make iso        Build the bootable ISO (requires sudo)"
	@echo "  make qemu       Boot ISO in QEMU for testing"
	@echo "  make clean      Clean live-build artifacts"
	@echo "  make distclean  Wipe all regenerable files"

deps:
	sudo apt-get update
	sudo apt-get install -y \
		live-build live-config live-boot \
		debhelper devscripts equivs dh-python \
		reprepro gnupg \
		qemu-system-x86 qemu-utils \
		xorriso isolinux syslinux-common \
		grub-pc-bin grub-efi-amd64-bin mtools \
		python3

packages:
	@mkdir -p $(BUILD_DIR)
	@for pkg in $(PACKAGES); do \
		echo ">>> Building $$pkg" ; \
		( cd $(ROOT)/packages/$$pkg && dpkg-buildpackage -us -uc -b ) || exit 1 ; \
		mv $(ROOT)/packages/*.deb $(BUILD_DIR)/ 2>/dev/null || true ; \
		mv $(ROOT)/packages/*.changes $(ROOT)/packages/*.buildinfo $(BUILD_DIR)/ 2>/dev/null || true ; \
	done
	@echo ">>> Built packages:"
	@ls -1 $(BUILD_DIR)/*.deb

repo: packages
	@mkdir -p $(REPO_DIR)/conf
	@printf '%s\n' \
		'Origin: Shadowfetch' \
		'Label: Shadowfetch' \
		'Codename: $(CODENAME)' \
		'Architectures: amd64 source' \
		'Components: main' \
		'Description: Shadowfetch Linux package repository' \
		'SignWith: $(REPO_KEY_ID)' \
		> $(REPO_DIR)/conf/distributions
	@# Clean any prior pool entries for these packages so reprepro accepts re-includes
	@for deb in $(BUILD_DIR)/*.deb; do \
		pkg=$$(dpkg-deb -f $$deb Package) ; \
		reprepro -b $(REPO_DIR) remove $(CODENAME) $$pkg >/dev/null 2>&1 || true ; \
	done
	@for deb in $(BUILD_DIR)/*.deb; do \
		reprepro -b $(REPO_DIR) includedeb $(CODENAME) $$deb ; \
	done
	@gpg --armor --export $(REPO_KEY_ID) > $(REPO_DIR)/shadowfetch.gpg.asc
	@echo ">>> Repo built at $(REPO_DIR). Contents:"
	@reprepro -b $(REPO_DIR) list $(CODENAME)

iso: repo
	@# Stage GPG key for live-build's archives/ system (chroot + binary trust)
	@mkdir -p $(LB_DIR)/config/archives
	@cp $(REPO_DIR)/shadowfetch.gpg.asc $(LB_DIR)/config/archives/shadowfetch.key.chroot
	@cp $(REPO_DIR)/shadowfetch.gpg.asc $(LB_DIR)/config/archives/shadowfetch.key.binary
	@# Clean prior build
	@cd $(LB_DIR) && sudo lb clean
	@# Serve the local repo over HTTP so the chroot's apt can see it,
	@# then run lb config + lb build. Trap ensures the server is killed on any exit.
	@bash -c 'set -e ; \
		cd "$(REPO_DIR)" && python3 -m http.server $(LOCAL_REPO_PORT) --bind 127.0.0.1 >/tmp/shadowfetch-repo-server.log 2>&1 & \
		SERVER_PID=$$! ; \
		trap "kill $$SERVER_PID 2>/dev/null || true" EXIT INT TERM ; \
		sleep 1 ; \
		echo ">>> Local repo server PID=$$SERVER_PID on :$(LOCAL_REPO_PORT)" ; \
		cd "$(LB_DIR)" && sudo lb config && sudo lb build'
	@cp $(LB_DIR)/live-image-amd64.hybrid.iso $(ROOT)/$(ISO_NAME)
	@echo ">>> Built $(ISO_NAME)"
	@ls -lh $(ROOT)/$(ISO_NAME)
	@sha256sum $(ROOT)/$(ISO_NAME) > $(ROOT)/$(ISO_NAME).sha256
	@echo ">>> SHA256: $$(cat $(ROOT)/$(ISO_NAME).sha256)"

qemu:
	qemu-system-x86_64 \
		-enable-kvm \
		-cpu host -smp 4 -m 8192 \
		-vga virtio -display gtk,gl=on \
		-device intel-hda -device hda-duplex \
		-net nic,model=virtio -net user \
		-drive file=$(ROOT)/$(ISO_NAME),media=cdrom,readonly=on \
		-boot d

clean:
	-cd $(LB_DIR) && sudo lb clean
	-rm -rf $(BUILD_DIR)
	-rm -f $(LB_DIR)/config/archives/shadowfetch.key.*

distclean: clean
	-rm -rf $(REPO_DIR)/db $(REPO_DIR)/dists $(REPO_DIR)/pool $(REPO_DIR)/conf
	-rm -f $(REPO_DIR)/shadowfetch.gpg.asc
	-rm -f $(ROOT)/*.iso $(ROOT)/*.iso.sha256
