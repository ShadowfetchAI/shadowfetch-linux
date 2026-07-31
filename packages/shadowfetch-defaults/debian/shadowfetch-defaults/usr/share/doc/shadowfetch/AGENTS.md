# Shadowfetch Linux — AI Agent Setup Guide

Shadowfetch is **agent-ready**: the system includes the development tools, local-model
on-ramp, workspace manager, diagnostics, and optional browser/sandbox setup needed for
serious agent work. Agents run **on your machine** — cloud providers are optional.

You have two first-class choices: **Hermes** and **OpenClaw**. Both are open source.

---

## Quick start

Open a terminal and run:

```
shadowfetch-agents
```

This shows the choice, confirms your prerequisites, and launches the agent you pick.
You can also use the graphical **Choose AI Agent** entry in the application menu.

For a complete workspace instead of an unstructured chat, run:

```
shadowfetch-agent-workspace
```

Agent Studio creates a private project folder with operating rules, active tasks,
durable memory, a work journal, artifacts, logs, and scratch space. If Hermes is
installed, it can also create a separate profile and point that profile at the new
workspace so project state does not bleed into another agent's work.

---

## Option 1 — Hermes Agent (Nous Research)

A **self-improving** agent: after it helps you with a task, it writes itself a reusable
skill, so it gets better the more you use it. One agent with many *profiles*, plus a
messaging *gateway* so you can reach it from Telegram, Discord, Slack, and more.

**Install + first run:**

```
shadowfetch-hermes
```

This installs or updates Hermes with the official Nous Research installer, falls back
to `pipx` if needed, then opens `hermes setup`.

**Useful commands afterwards:**

| Command | What it does |
|---|---|
| `hermes setup` | First-time setup: pick a model, sign in |
| `hermes` | Start chatting with your agent |
| `hermes model` | Pick or change your LLM provider/model |
| `hermes tools` | Configure which local and gateway tools are enabled |
| `hermes gateway setup` | Connect Telegram / Discord / Slack / Email |
| `hermes profile create <name>` | A second, separate agent persona |
| `hermes doctor` | Diagnose problems |
| `hermes dashboard` | Open the local profile and session dashboard |

Docs: <https://hermes-agent.nousresearch.com/docs>

---

## Option 2 — OpenClaw

A lightweight, friendly personal agent installed through npm. Great if you want a simple,
quick start. Drives your local Ollama models out of the box.

**Install + first run:**

```
shadowfetch-openclaw
```

This installs or updates OpenClaw into your own user account (no root needed) and opens
`openclaw onboard --install-daemon`.

**Useful commands afterwards:**

| Command | What it does |
|---|---|
| `openclaw onboard --install-daemon` | Setup wizard: choose a provider and keep the gateway running |
| `openclaw gateway status` | Check the background gateway |
| `openclaw` | Start the agent |
| `openclaw doctor` | Diagnose configuration and migrate old settings |
| `openclaw browser doctor` | Check the isolated managed browser |
| `openclaw sandbox explain` | Show the effective workspace and tool isolation |

When onboarding asks for a provider, choose **Ollama** to stay 100% local and private.

---

## Running 100% locally (no cloud, no API keys)

Both agents can run entirely on your own hardware using **Ollama**. Shadowfetch includes
a helper that picks a model matched to your machine and downloads it from Hugging Face:

```
shadowfetch-llm
```

It detects your RAM/VRAM and free disk, recommends a model that will actually fit, and
starts it locally. Then point your agent at the **Ollama** provider:

- **Hermes:** `hermes model` → add or choose the Ollama/OpenAI-compatible provider.
- **OpenClaw:** choose **Ollama** during `openclaw onboard`.

Ollama listens only on `127.0.0.1` (localhost) and the firewall blocks port 11434 from the
network — your models stay on your machine.

---

## Which should I choose?

- **Want the most capable agent that learns and grows, with messaging integrations?**
  → **Hermes**.
- **Want a quick, simple, lightweight start?**
  → **OpenClaw**.
- **Just want a private local chatbot, no agent?**
  → run **`shadowfetch-llm`**.

You can install both and switch freely; they don't conflict.

---

## Browser automation and sandboxes

Browser automation is installed on demand because a browser runtime is large and not
everyone wants an agent controlling one. Run:

```
shadowfetch-agent-tools
```

Hermes can configure a local browser or its supported tool gateway through the official
tool setup. OpenClaw can install Debian Chromium and use a separate managed browser
profile that does not touch your personal profile. The same helper checks rootless
Podman readiness for isolated command execution.

Use a dedicated browser profile for agent work. Do not sign an agent-controlled browser
into banking, password-manager, medical, government, or primary email accounts.

---

## Health and safety checks

Run `shadowfetch-agent-doctor` to verify agent versions, local model and dashboard
network exposure, container availability, upstream doctor checks, and credential-file
permissions. `shadowfetch-agent-doctor --fix-permissions` applies only the safe,
owner-only permission repair. The broader `shadowfetch-health --json` command provides
structured diagnostics that an agent can read without scraping terminal formatting.

---

## Troubleshooting

- **"command not found" right after install** — open a *new* terminal so your shell picks
  up the updated PATH, then try again.
- **Hermes install failed** — re-run `shadowfetch-hermes`; it falls back to `pipx`. See
  `hermes doctor` once installed.
- **OpenClaw install failed** — make sure you have network access; the helper retries with
  `sudo` automatically if the per-user install can't write.
- **Model too slow** — pick a smaller model in `shadowfetch-llm`; the recommended option is
  sized to your hardware.
- **Browser tools unavailable** — run `shadowfetch-agent-tools`, choose your agent, and
  follow its official browser doctor/setup flow.
- **A dashboard is visible on the network** — stop it and bind it to `127.0.0.1`, then
  rerun `shadowfetch-agent-doctor`.

Questions or issues: <https://www.shadowfetch.com/linux>
