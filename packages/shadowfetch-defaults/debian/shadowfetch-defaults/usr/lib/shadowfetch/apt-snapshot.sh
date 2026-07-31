#!/bin/sh
# Shadowfetch 2.0.0 "Bedrock": snapshot the Btrfs root before an apt transaction
# so any change is one reboot away from rollback (grub-btrfs shows snapshots in
# the GRUB menu). No-op unless root is Btrfs and snapper is configured.
set -e
command -v snapper >/dev/null 2>&1 || exit 0
[ -f /etc/snapper/configs/root ] || exit 0
[ "$(stat -f -c %T / 2>/dev/null)" = "btrfs" ] || exit 0
snapper -c root create --type single --cleanup-algorithm number \
  --description "apt transaction" >/dev/null 2>&1 || true
