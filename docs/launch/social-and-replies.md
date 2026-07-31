# Shadowfetch Linux Social and Reply Playbook

## Launch posts

1. Shadowfetch Linux v1.2.8 “Umbra” is live: a Debian/KDE creative workstation with local AI tooling, signed ISO releases, and a signed APT update path. Start here: https://www.shadowfetch.com/linux

2. The important page is not the download button. It is the verification guide. If you try Shadowfetch Linux, verify the ISO before installing: https://www.shadowfetch.com/linux/verify

3. We publish known issues because trust beats polish theater. Secure Boot is not signed yet. Debian testing moves quickly. NVIDIA hybrid laptops vary. Read before installing: https://www.shadowfetch.com/linux/known-issues

4. Shadowfetch Linux is built on Debian testing and KDE Plasma 6. It adds the Umbra identity, creative defaults, local AI setup, privacy defaults, installer polish, and a signed update repo.

5. Local AI is included through Ollama/Open-WebUI. The point is simple: a private workstation should be useful before it talks to a cloud service.

6. The App Shelf is still here: 112 public iPhone and iPad tools. It is proof that Shadowfetch ships. The Linux workstation is now the front door.

7. Who should try Shadowfetch Linux: Linux users, creators, developers, AI tinkerers, and people comfortable testing a young Debian derivative.

8. Who should wait: anyone who needs Secure Boot signing, enterprise support, Debian stable behavior, or a zero-surprise production workstation.

9. v1.2.9 focus: better first-run diagnostics, hardware notes from real installs, NVIDIA/hybrid docs, and sharper local-AI model recommendations.

10. If you test Shadowfetch Linux, send hardware reports with ISO filename, checksum result, CPU/GPU/RAM, Secure Boot state, and where anything failed.

## Reply playbook

### “Is this just Debian?”
It is a Debian-testing derivative. Debian is the base. Shadowfetch adds the curated creative workstation layer, Umbra identity, installer defaults, local-AI setup, privacy defaults, signed ISO, and signed APT repo.

### “Why another distro?”
Because the target is specific: a private, AI-ready creative workstation that is useful immediately after install, without pretending to replace Debian or KDE.

### “Is it private?”
The OS does not add a Shadowfetch telemetry daemon or account requirement. Local AI runs on-device. Model downloads still come from the model host you choose. Website/CDN logs are ordinary hosting-layer logs.

### “Does NVIDIA work?”
The proprietary NVIDIA stack is included, and hybrid laptops use PRIME offload, but laptop firmware varies. Read hardware notes and known issues before installing.

### “Does Secure Boot work?”
Not yet. The ISO is not Secure-Boot-signed. Disable Secure Boot before booting the USB.

### “Who is this for?”
Creators, developers, local-AI users, and Linux people who want a pre-curated KDE workstation and are comfortable testing an active young distro.
