"""Agents — local AI status, models and workspaces.

Status comes from two sources only: the hardware fact file
(/var/lib/shadowfetch/hwscan.json — capabilities at rest, always shown with
its scan timestamp) and org.shadowfetch.Firewatch1 (all live numbers).
When firewatchd is down the page shows a "Firewatch not running" tile —
never stale numbers.  Workspaces are user-scope only: plain directories
under ~/Workspaces joined with shadowfetch-llama@<name> user units, every
one of which serves on 127.0.0.1 only (hard-coded in the unit template).
"""

import datetime
import subprocess
from pathlib import Path

from PyQt6.QtCore import Qt, QTimer
from PyQt6.QtWidgets import (
    QGridLayout,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QScrollArea,
    QVBoxLayout,
    QWidget,
)

from sfcc import busutil, theme
from sfcc.theme import Card, label

WORKSPACES_DIR = Path.home() / "Workspaces"


def _pick(d, *keys, default=None):
    if not isinstance(d, dict):
        return default
    for k in keys:
        if k in d and d[k] is not None:
            return d[k]
    return default


class WorkspaceRow(Card):
    def __init__(self, name: str, active: bool, on_start, on_stop):
        super().__init__()
        lay = QHBoxLayout(self)
        lay.setContentsMargins(14, 10, 14, 10)
        lay.setSpacing(10)
        col = QVBoxLayout()
        col.setSpacing(2)
        col.addWidget(label(name, "cardTitle"))
        state = "running" if active else "stopped"
        col.addWidget(label(f"{state} · serves on 127.0.0.1 only", "detail"))
        lay.addLayout(col, 1)
        if active:
            btn = QPushButton("Stop")
            btn.setObjectName("quiet")
            btn.clicked.connect(lambda: on_stop(name))
        else:
            btn = QPushButton("Start")
            btn.clicked.connect(lambda: on_start(name))
        btn.setFixedHeight(28)
        lay.addWidget(btn)


class AgentsPage(QWidget):
    """The Agents section."""

    def __init__(self, firewatch: busutil.FirewatchClient, open_route):
        super().__init__()
        self._firewatch = firewatch
        self._open_route = open_route
        firewatch.updated.connect(self._on_firewatch)

        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        outer.addWidget(scroll)
        body = QWidget()
        scroll.setWidget(body)
        root = QVBoxLayout(body)
        root.setContentsMargins(24, 18, 24, 18)
        root.setSpacing(14)

        # ---- hardware verdict banner --------------------------------------
        banner = Card()
        b_lay = QVBoxLayout(banner)
        b_lay.setContentsMargins(16, 13, 16, 13)
        b_lay.setSpacing(6)
        head = QHBoxLayout()
        head.addWidget(label("What this machine can run", "cardTitle"))
        head.addStretch(1)
        rescan = QPushButton("Re-scan")
        rescan.setObjectName("quiet")
        rescan.setFixedHeight(28)
        rescan.clicked.connect(self._rescan)
        head.addWidget(rescan)
        b_lay.addLayout(head)
        self.verdict = label("", "subtitle", wrap=True)
        b_lay.addWidget(self.verdict)
        self.verdict_extra = label("", "detail", wrap=True)
        b_lay.addWidget(self.verdict_extra)
        self.scan_stamp = label("", "detail")
        b_lay.addWidget(self.scan_stamp)
        root.addWidget(banner)

        # ---- live models (Firewatch1 is the only live source) -------------
        root.addWidget(label("Running models", "subtitle"))
        self.models_area = QVBoxLayout()
        self.models_area.setSpacing(8)
        root.addLayout(self.models_area)
        self._model_widgets: list[QWidget] = []

        # ---- workspaces ---------------------------------------------------
        ws_head = QHBoxLayout()
        ws_head.addWidget(label("Workspaces", "subtitle"))
        ws_head.addStretch(1)
        new_ws = QPushButton("New workspace (Welcome)")
        new_ws.setObjectName("quiet")
        new_ws.setFixedHeight(28)
        new_ws.clicked.connect(
            lambda: busutil.start_detached(["shadowfetch-welcome", "--catalog", "ai"]))
        ws_head.addWidget(new_ws)
        root.addLayout(ws_head)
        self.ws_area = QVBoxLayout()
        self.ws_area.setSpacing(8)
        root.addLayout(self.ws_area)
        self._ws_widgets: list[QWidget] = []

        # ---- classic agent tools (preserved from 2.1.1) -------------------
        root.addWidget(label("Agent tools", "subtitle"))
        tools = QGridLayout()
        tools.setSpacing(12)
        for index, (title, detail, button, command) in enumerate([
            ("Agent Studio",
             "Private workspaces with tasks, memory, artifacts and matching "
             "agent profiles.", "Open Agent Studio", "shadowfetch-agent-workspace"),
            ("Agent Tools",
             "Set up browser automation, local sandboxes and agent "
             "diagnostics.", "Configure tools", "shadowfetch-agent-tools"),
        ]):
            card = Card()
            lay = QVBoxLayout(card)
            lay.setContentsMargins(14, 11, 14, 11)
            lay.setSpacing(5)
            lay.addWidget(label(title, "cardTitle"))
            lay.addWidget(label(detail, "detail", wrap=True))
            lay.addStretch(1)
            btn = QPushButton(button)
            btn.setFixedHeight(30)
            btn.clicked.connect(lambda _=False, c=command: busutil.terminal_command(c))
            lay.addWidget(btn, alignment=Qt.AlignmentFlag.AlignLeft)
            tools.addWidget(card, index // 2, index % 2)
        root.addLayout(tools)
        root.addStretch(1)

        self._ws_timer = QTimer(self)
        self._ws_timer.setInterval(5000)
        self._ws_timer.timeout.connect(self._reload_workspaces)

        self._render_hwscan(busutil.load_hwscan())
        self._reload_workspaces()

    # ---- lifecycle --------------------------------------------------------
    def showEvent(self, event) -> None:
        super().showEvent(event)
        self._firewatch.acquire()
        self._reload_workspaces()
        self._ws_timer.start()

    def hideEvent(self, event) -> None:
        super().hideEvent(event)
        self._firewatch.release()
        self._ws_timer.stop()

    # ---- hwscan -----------------------------------------------------------
    def _rescan(self) -> None:
        self.setCursor(Qt.CursorShape.WaitCursor)
        try:
            self._render_hwscan(busutil.load_hwscan(rescan=True))
        finally:
            self.unsetCursor()

    def _render_hwscan(self, hw: dict | None) -> None:
        if not hw:
            self.verdict.setText("Hardware scan not available yet.")
            self.verdict_extra.setText(
                "The scan runs at boot; Re-scan runs it now. It reads local "
                "hardware facts only.")
            self.scan_stamp.setText("")
            return
        verdict = hw.get("verdict") or {}
        self.verdict.setText(verdict.get("sentence")
                             or "Scan completed, no verdict recorded.")
        suffixes = verdict.get("suffixes") or []
        self.verdict_extra.setText(" ".join(str(s) for s in suffixes))
        stamp = hw.get("scanned_at")
        cpu = hw.get("cpu") or {}
        ram = hw.get("ram_gb")
        bits = []
        if cpu.get("model"):
            bits.append(str(cpu["model"]))
        if ram:
            bits.append(f"{ram} GB RAM")
        if stamp:
            bits.append(f"scanned {stamp}")
        self.scan_stamp.setText(" · ".join(bits))

    # ---- live models ------------------------------------------------------
    def _on_firewatch(self, data: dict) -> None:
        for widget in self._model_widgets:
            widget.setParent(None)
            widget.deleteLater()
        self._model_widgets = []

        def add(widget: QWidget) -> None:
            self.models_area.addWidget(widget)
            self._model_widgets.append(widget)

        if not data.get("available", False):
            tile = Card()
            lay = QVBoxLayout(tile)
            lay.setContentsMargins(14, 10, 14, 10)
            lay.addWidget(label("Firewatch not running", "cardTitle"))
            lay.addWidget(label(
                "Live model telemetry comes from shadowfetch-firewatchd; no "
                "stale numbers are shown while it is down.", "detail", wrap=True))
            add(tile)
            return
        models = data.get("models")
        rows = models if isinstance(models, list) else []
        if isinstance(models, dict):
            rows = models.get("servers") or models.get("models") or []
        if not rows:
            add(label("No model is running right now.", "detail"))
            return
        for row in rows:
            if not isinstance(row, dict):
                continue
            tile = Card()
            lay = QVBoxLayout(tile)
            lay.setContentsMargins(14, 10, 14, 10)
            lay.setSpacing(2)
            name = str(_pick(row, "name", "workspace", "model", default="model"))
            lay.addWidget(label(name, "cardTitle"))
            predict = _pick(row, "predict_tps", "predicted_tokens_seconds")
            prompt = _pick(row, "prompt_tps", "prompt_tokens_seconds")
            parts = []
            if predict is not None:
                parts.append(f"generating {float(predict):.1f} tok/s")
            if prompt is not None:
                parts.append(f"prompt {float(prompt):.1f} tok/s")
            parts.append("127.0.0.1 only")
            lay.addWidget(label(" · ".join(parts), "detail"))
            add(tile)

    # ---- workspaces -------------------------------------------------------
    def _reload_workspaces(self) -> None:
        for widget in self._ws_widgets:
            widget.setParent(None)
            widget.deleteLater()
        self._ws_widgets = []

        names = []
        if WORKSPACES_DIR.is_dir():
            names = sorted(p.name for p in WORKSPACES_DIR.iterdir() if p.is_dir())
        if not names:
            note = label(
                "No workspaces yet. A workspace is a folder under "
                "~/Workspaces with its own model, jobs and notes — create "
                "one from Welcome.", "detail")
            note.setWordWrap(True)
            self.ws_area.addWidget(note)
            self._ws_widgets.append(note)
            return
        for name in names:
            active = busutil.user_unit_active(f"shadowfetch-llama@{name}.service")
            row = WorkspaceRow(name, active, self._start_ws, self._stop_ws)
            self.ws_area.addWidget(row)
            self._ws_widgets.append(row)

    def _start_ws(self, name: str) -> None:
        subprocess.Popen(["systemctl", "--user", "start",
                          f"shadowfetch-llama@{name}.service"])
        QTimer.singleShot(1500, self._reload_workspaces)

    def _stop_ws(self, name: str) -> None:
        subprocess.Popen(["systemctl", "--user", "stop",
                          f"shadowfetch-llama@{name}.service"])
        QTimer.singleShot(1500, self._reload_workspaces)
