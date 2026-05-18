# Shadowfetch Linux — top-level build orchestration
#
# Common targets:
#   make deps       Install build dependencies (Debian host required)
#   make packages   Build all custom .deb packages
#   make repo       Generate the local APT repo from built packages
#   make iso        Build the bootable ISO (uses sudo)
#   make qemu       Boot the built ISO in QEMU for testing
#   make clean      Clean the live-build tree
#   make distclean  Wipe everything regenerable

SHELL := /bin/bash
VERSION ?= 1.0.0
CODENAME ?= umbra
ISO_NAME := shadowfetch-$(VERSION)-amd64.iso

PACKAGES := shadowfetch-meta shadowfetch-welcome
# (themes, defaults, branding, creative-base, nvidia, desktop will be added
# as their packaging gets fleshed out)

ROOT := $(CURDIR)
BUILD_DIR := $(ROOT)/build
REPO_DIR := $(ROOT)/repo
LB_DIR := $(ROOT)/live-build

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
		grub-pc-bin grub-efi-amd64-bin mtools

packages:
	@mkdir -p $(BUILD_DIR)
	@for pkg in $(PACKAGES); do \
		echo ">>> Building $$pkg"; \
		cd $(ROOT)/packages/$$pkg && \
		dpkg-buildpackage -us -uc -b && \
		mv ../*.deb $(BUILD_DIR)/ && \
		mv ../*.changes ../*.buildinfo $(BUILD_DIR)/ 2>/dev/null || true; \
	done
	@echo ">>> Built packages:"
	@ls -1 $(BUILD_DIR)/*.deb

repo: packages
	@mkdir -p $(REPO_DIR)/conf
	@cat > $(REPO_DIR)/conf/distributions <<-EOF
		Origin: Shadowfetch
		Label: Shadowfetch
		Codename: $(CODENAME)
		Architectures: amd64 source
		Components: main
		Description: Shadowfetch Linux package repository
		SignWith: yes
	EOF
	@cd $(REPO_DIR) && for deb in $(BUILD_DIR)/*.deb; do \
		reprepro includedeb $(CODENAME) $$deb || true; \
	done

iso:
	@cd $(LB_DIR) && sudo lb clean && sudo lb config && sudo lb build
	@cp $(LB_DIR)/live-image-amd64.hybrid.iso $(ROOT)/$(ISO_NAME)
	@echo ">>> Built $(ISO_NAME)"
	@ls -lh $(ROOT)/$(ISO_NAME)

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

distclean: clean
	-rm -rf $(REPO_DIR)/db $(REPO_DIR)/dists $(REPO_DIR)/pool $(REPO_DIR)/conf
	-rm -f $(ROOT)/*.iso
