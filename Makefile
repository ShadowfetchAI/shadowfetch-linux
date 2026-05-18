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

R2_BUCKET ?= shadowfetch-linux
# Cloudflare R2 S3-compatible endpoint for this account.
# (wrangler can't PUT > 300 MiB; aws-cli with R2's S3 API handles multipart.)
R2_ENDPOINT ?= https://a290a9fad8cfb966c5507b490396acf7.r2.cloudflarestorage.com
R2_REGION   ?= auto

# Used by sync-from-linux (Mac-side flow): host + path to the build box.
LINUX_HOST ?= shadowfetch-linux
LINUX_PATH ?= ~/projects/shadowfetch

.PHONY: all help deps packages repo iso sign publish qemu clean distclean \
        sync-from-linux deploy-worker ship

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
		xorriso isolinux syslinux-common syslinux-utils \
		grub-pc-bin grub-efi-amd64-bin mtools \
		xz-utils python3

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
	@# Stage GPG key for live-build's archives/ system.
	@# apt expects .gpg files to be binary (dearmored) — armored keys with .gpg
	@# suffix are silently ignored.
	@mkdir -p $(LB_DIR)/config/archives
	@gpg --dearmor < $(REPO_DIR)/shadowfetch.gpg.asc > $(LB_DIR)/config/archives/shadowfetch.key.chroot
	@cp $(LB_DIR)/config/archives/shadowfetch.key.chroot $(LB_DIR)/config/archives/shadowfetch.key.binary
	@# Clean prior build
	@cd $(LB_DIR) && sudo lb clean
	@# Serve the local repo over HTTP so the chroot's apt can see it,
	@# then run lb config + lb build. lb 3.0~a57's binary_grub2 stage is broken
	@# (no EFI support, malformed BIOS image) so we tolerate its failure and assemble
	@# the final ISO via grub-mkrescue below.
	@bash -c 'cd "$(REPO_DIR)" && python3 -m http.server $(LOCAL_REPO_PORT) --bind 127.0.0.1 >/tmp/shadowfetch-repo-server.log 2>&1 & \
		SERVER_PID=$$! ; \
		trap "kill $$SERVER_PID 2>/dev/null || true" EXIT INT TERM ; \
		sleep 1 ; \
		echo ">>> Local repo server PID=$$SERVER_PID on :$(LOCAL_REPO_PORT)" ; \
		cd "$(LB_DIR)" && sudo lb config && (sudo lb build || echo "WARN: lb build exited non-zero; will check binary/ for usable artifacts and try grub-mkrescue")'
	@# Take ownership of lb's output so we can write into it as user.
	@# lb_binary_linux-image in lb 3.0~a57 silently fails to copy kernel+initrd
	@# from chroot to binary/live/ — we do it manually below.
	@sudo chown -R $$USER:$$USER $(LB_DIR)/binary
	@sudo chmod -R a+rX $(LB_DIR)/chroot/boot
	@# Sanity check: squashfs must exist
	@test -f $(LB_DIR)/binary/live/filesystem.squashfs || { echo "FATAL: no squashfs in $(LB_DIR)/binary/live/" >&2; exit 1; }
	@# Copy kernel + initrd from chroot/boot/ to binary/live/ with predictable names
	@KERNEL=$$(ls $(LB_DIR)/chroot/boot/vmlinuz-*-amd64 2>/dev/null | sort -V | tail -1) ; \
		INITRD=$$(ls $(LB_DIR)/chroot/boot/initrd.img-*-amd64 2>/dev/null | sort -V | tail -1) ; \
		[ -n "$$KERNEL" ] || { echo "FATAL: no kernel in $(LB_DIR)/chroot/boot/" >&2; exit 1; } ; \
		[ -n "$$INITRD" ] || { echo "FATAL: no initrd in $(LB_DIR)/chroot/boot/" >&2; exit 1; } ; \
		echo ">>> Found kernel: $$KERNEL" ; \
		echo ">>> Found initrd: $$INITRD" ; \
		cp "$$KERNEL" $(LB_DIR)/binary/live/vmlinuz ; \
		cp "$$INITRD" $(LB_DIR)/binary/live/initrd.img
	@# Write our grub.cfg (overrides whatever lb left behind)
	@mkdir -p $(LB_DIR)/binary/boot/grub
	@cp $(ROOT)/live-build/config/grub.cfg $(LB_DIR)/binary/boot/grub/grub.cfg
	@# Assemble the final hybrid (BIOS+UEFI) ISO with grub-mkrescue
	@echo ">>> Assembling final ISO with grub-mkrescue (BIOS + UEFI hybrid)"
	@rm -f $(ROOT)/$(ISO_NAME)
	@sudo grub-mkrescue \
		--output=$(ROOT)/$(ISO_NAME) \
		$(LB_DIR)/binary \
		-- -volid SHADOWFETCH
	@sudo chown $$USER:$$USER $(ROOT)/$(ISO_NAME)
	@echo ">>> Built $(ISO_NAME)"
	@ls -lh $(ROOT)/$(ISO_NAME)
	@sha256sum $(ROOT)/$(ISO_NAME) > $(ROOT)/$(ISO_NAME).sha256
	@echo ">>> SHA256: $$(cat $(ROOT)/$(ISO_NAME).sha256)"
	@$(MAKE) sign

# Detached GPG signature so downloaders can verify with: gpg --verify <iso>.asc
sign:
	@if [ ! -f $(ROOT)/$(ISO_NAME) ]; then echo "No ISO at $(ROOT)/$(ISO_NAME) — run 'make iso' first" >&2; exit 1; fi
	@rm -f $(ROOT)/$(ISO_NAME).asc
	@gpg --batch --yes --local-user $(REPO_KEY_ID) --armor --detach-sign --output $(ROOT)/$(ISO_NAME).asc $(ROOT)/$(ISO_NAME)
	@echo ">>> Signed: $(ROOT)/$(ISO_NAME).asc"

# Upload ISO + APT repo to R2 via aws-cli (R2's S3-compatible API).
# Requires: brew install awscli, and an R2 API token from the Cloudflare
# dashboard (R2 → Manage R2 API Tokens → Create) exported as:
#   AWS_ACCESS_KEY_ID=<R2 Access Key ID>
#   AWS_SECRET_ACCESS_KEY=<R2 Secret Access Key>
# aws-cli handles multipart automatically, so the 2.9 GB ISO uploads fine.
publish:
	@command -v aws >/dev/null || { echo "aws not installed. Run: brew install awscli" >&2; exit 1; }
	@test -n "$$AWS_ACCESS_KEY_ID" || { echo "AWS_ACCESS_KEY_ID not set (use your R2 API token Access Key ID)" >&2; exit 1; }
	@test -n "$$AWS_SECRET_ACCESS_KEY" || { echo "AWS_SECRET_ACCESS_KEY not set (use your R2 API token Secret Access Key)" >&2; exit 1; }
	@if [ ! -f $(ROOT)/$(ISO_NAME) ]; then echo "No ISO to publish ($(ROOT)/$(ISO_NAME))" >&2; exit 1; fi
	@if [ ! -f $(ROOT)/$(ISO_NAME).asc ]; then echo "No signature ($(ROOT)/$(ISO_NAME).asc) — run 'make sign'" >&2; exit 1; fi
	@echo ">>> Uploading small files first (sha256, signature, GPG key)"
	@aws --endpoint-url=$(R2_ENDPOINT) --region=$(R2_REGION) s3 cp $(ROOT)/$(ISO_NAME).sha256 s3://$(R2_BUCKET)/releases/$(ISO_NAME).sha256 --content-type "text/plain"
	@aws --endpoint-url=$(R2_ENDPOINT) --region=$(R2_REGION) s3 cp $(ROOT)/$(ISO_NAME).asc    s3://$(R2_BUCKET)/releases/$(ISO_NAME).asc    --content-type "application/pgp-signature"
	@aws --endpoint-url=$(R2_ENDPOINT) --region=$(R2_REGION) s3 cp $(REPO_DIR)/shadowfetch.gpg.asc s3://$(R2_BUCKET)/shadowfetch.gpg.asc --content-type "application/pgp-keys"
	@echo ">>> Mirroring APT repo (dists/ + pool/) to R2 apt/"
	@aws --endpoint-url=$(R2_ENDPOINT) --region=$(R2_REGION) s3 sync $(REPO_DIR)/dists s3://$(R2_BUCKET)/apt/dists --delete
	@aws --endpoint-url=$(R2_ENDPOINT) --region=$(R2_REGION) s3 sync $(REPO_DIR)/pool  s3://$(R2_BUCKET)/apt/pool  --delete
	@echo ">>> Uploading ISO ($(ISO_NAME), 2.9 GB, multipart). Progress below."
	@aws --endpoint-url=$(R2_ENDPOINT) --region=$(R2_REGION) s3 cp $(ROOT)/$(ISO_NAME) s3://$(R2_BUCKET)/releases/$(ISO_NAME) --content-type "application/x-iso9660-image"
	@echo ">>> Done. Verify:"
	@echo "    curl -I  https://shadowfetch.com/linux/download/$(ISO_NAME)"
	@echo "    curl -sI https://shadowfetch.com/linux/apt/dists/$(CODENAME)/InRelease"

qemu:
	qemu-system-x86_64 \
		-enable-kvm \
		-cpu host -smp 4 -m 8192 \
		-vga virtio -display gtk,gl=on \
		-device intel-hda -device hda-duplex \
		-net nic,model=virtio -net user \
		-drive file=$(ROOT)/$(ISO_NAME),media=cdrom,readonly=on \
		-boot d

# ---- Mac-side deploy flow ----
# Run these from your Mac (where wrangler is logged in) to ship a release
# that was built on $(LINUX_HOST).

# Pull the latest ISO + checksum + signature + reprepro repo back from the
# Linux build box. Idempotent.
sync-from-linux:
	@echo ">>> Pulling ISO + repo from $(LINUX_HOST):$(LINUX_PATH)"
	@rsync -avzhP $(LINUX_HOST):$(LINUX_PATH)/shadowfetch-*.iso $(ROOT)/ 2>/dev/null || echo "(no ISO yet on Linux box)"
	@rsync -avzhP $(LINUX_HOST):$(LINUX_PATH)/shadowfetch-*.iso.sha256 $(ROOT)/ 2>/dev/null || true
	@rsync -avzhP $(LINUX_HOST):$(LINUX_PATH)/shadowfetch-*.iso.asc $(ROOT)/ 2>/dev/null || true
	@rsync -avzh --delete $(LINUX_HOST):$(LINUX_PATH)/repo/ $(REPO_DIR)/
	@ls -lh $(ROOT)/shadowfetch-*.iso 2>/dev/null || echo "(no ISO present)"

# Deploy the shadowfetch-linux Worker. Requires `wrangler login` (one time) or CLOUDFLARE_API_TOKEN.
deploy-worker:
	@command -v wrangler >/dev/null || { echo "wrangler not installed. Run: brew install cloudflare-wrangler2" >&2; exit 1; }
	@cd $(ROOT)/web/shadowfetch-linux-worker && wrangler deploy

# Full Mac-side ship: pull artifacts, publish to R2, deploy Worker.
ship: sync-from-linux publish deploy-worker
	@echo ""
	@echo ">>> SHIPPED. Verify:"
	@echo "    open https://shadowfetch.com/linux/"
	@echo "    curl -I https://shadowfetch.com/linux/download/$(ISO_NAME)"
	@echo "    curl -sI https://shadowfetch.com/linux/apt/dists/$(CODENAME)/InRelease"

clean:
	-cd $(LB_DIR) && sudo lb clean
	-rm -rf $(BUILD_DIR)
	-rm -f $(LB_DIR)/config/archives/shadowfetch.key.*

distclean: clean
	-rm -rf $(REPO_DIR)/db $(REPO_DIR)/dists $(REPO_DIR)/pool $(REPO_DIR)/conf
	-rm -f $(REPO_DIR)/shadowfetch.gpg.asc
	-rm -f $(ROOT)/*.iso $(ROOT)/*.iso.sha256
