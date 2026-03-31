#!/usr/bin/env python3
"""
Gestor Nexus Security — Discord Report Sender
Reads security scan JSON reports and sends COMPLETE findings to Discord.
Splits long findings into multiple messages to respect Discord's limits.

Discord limits:
  - Embed description: 4096 chars
  - Total embed size: 6000 chars
  - Max 10 embeds per message

Strategy: Use embed description (not fields) for findings.
Split into multiple messages per agent if findings exceed ~3500 chars.
"""

import json
import re
import subprocess
import sys
import time
from datetime import datetime

DISCORD_WEBHOOK = (
    "https://discord.com/api/webhooks/1488484081518772416/"
    "8FZgXzx1lbir-ObLChAZnkhOZVE3-fi3RcX34v6jQjX282ks5ywbJOiFv2IgUSQU2dNz"
)

AGENTS = [
    {
        "emoji": "\U0001f6e1\ufe0f",
        "title": "Agent 1: CodeSentinel (SAST)",
        "desc": "An\u00e1lise est\u00e1tica de c\u00f3digo \u2014 secrets, injection, XSS, crypto",
        "report": "/tmp/security-report-code-sentinel.json",
    },
    {
        "emoji": "\U0001f3d7\ufe0f",
        "title": "Agent 2: InfraGuard (Infrastructure)",
        "desc": "Seguran\u00e7a de infraestrutura \u2014 deps, Docker, headers, network",
        "report": "/tmp/security-report-infra-guard.json",
    },
    {
        "emoji": "\U0001f510",
        "title": "Agent 3: AccessWatchdog (Auth & Access)",
        "desc": "Controle de acesso \u2014 RBAC, IDOR, tokens, webhooks, multi-tenancy",
        "report": "/tmp/security-report-access-watchdog.json",
    },
]

# Discord embed description max is 4096.
# Leave room for title line, agent desc, "Findings (N)" header.
# With formatted findings (emojis, bold, double newlines) we need a bit more room.
MAX_CHUNK_LEN = 3200

SEVERITY_MAP = {
    "CRITICAL": ("\U0001f534", "CRITICAL"),   # 🔴
    "HIGH":     ("\U0001f7e0", "HIGH"),        # 🟠
    "MEDIUM":   ("\U0001f7e1", "MEDIUM"),      # 🟡
    "LOW":      ("\U0001f535", "LOW"),          # 🔵
}

SEVERITY_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}

# Regex to parse: [SEVERITY] CATEGORY — location: detail
FINDING_RE = re.compile(r"^\[(\w+)\]\s+(\S+)\s*\u2014\s*(.+)$")


def load_report(path):
    """Load agent JSON report, handling malformed JSON gracefully."""
    try:
        with open(path) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"[WARN] Could not load {path}: {e}", file=sys.stderr)
        return {
            "summary": {"critical": 0, "high": 0, "medium": 0, "low": 0, "total": 0},
            "findings": "",
        }


def format_finding(raw_line):
    """Format a raw finding line with severity emoji and visual structure.

    Input:  [CRITICAL] JWT_FALLBACK_SECRET — file.ts: Linha 18: detail
    Output: 🔴 **CRITICAL** · `JWT_FALLBACK_SECRET`\n╰ file.ts: Linha 18: detail
    """
    match = FINDING_RE.match(raw_line)
    if not match:
        return raw_line  # Fallback: return as-is

    severity, category, rest = match.groups()
    emoji, label = SEVERITY_MAP.get(severity, ("\u2b1c", severity))

    # Split rest into location: detail (first colon after the file path)
    # rest = "apps/api/src/file.ts: Linha 18: detail text"
    colon_idx = rest.find(": ")
    if colon_idx > 0:
        location = rest[:colon_idx].strip()
        detail = rest[colon_idx + 2:].strip()
        return f"{emoji} **{label}** \u00b7 `{category}`\n\u2570 `{location}`: {detail}"
    else:
        return f"{emoji} **{label}** \u00b7 `{category}`\n\u2570 {rest}"


def get_severity_key(raw_line):
    """Extract severity from raw finding for sorting."""
    match = re.match(r"^\[(\w+)\]", raw_line)
    if match:
        return SEVERITY_ORDER.get(match.group(1), 99)
    return 99


def parse_findings(raw):
    """Convert pipe-separated findings string into list of formatted finding blocks, sorted by severity."""
    if not raw or raw == "0":
        return []
    raw_lines = [part.strip() for part in raw.split("|") if part.strip()]
    raw_lines.sort(key=get_severity_key)
    return [format_finding(line) for line in raw_lines]


def chunk_findings(findings):
    """Split formatted findings into chunks that fit Discord's embed description limit.

    Each finding is separated by a blank line (\\n\\n) in the final output.
    """
    if not findings:
        return []

    chunks = []
    current_items = []
    current_len = 0

    for finding in findings:
        # +2 for the \n\n separator between findings
        finding_len = len(finding) + 2
        if current_len + finding_len > MAX_CHUNK_LEN and current_items:
            chunks.append(current_items)
            current_items = [finding]
            current_len = finding_len
        else:
            current_items.append(finding)
            current_len += finding_len

    if current_items:
        chunks.append(current_items)

    return chunks


def send_discord(payload):
    """Send JSON payload to Discord webhook via curl (avoids Cloudflare blocks)."""
    data = json.dumps(payload)
    try:
        result = subprocess.run(
            [
                "curl", "-s", "-o", "/dev/null", "-w", "%{http_code}",
                "-X", "POST", DISCORD_WEBHOOK,
                "-H", "Content-Type: application/json",
                "-d", data,
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        status = int(result.stdout.strip() or "0")
        if status >= 400:
            print(f"[ERROR] Discord HTTP {status}", file=sys.stderr)
        return status
    except Exception as e:
        print(f"[ERROR] Discord send failed: {e}", file=sys.stderr)
        return 0


def get_brt_now():
    """Get current time in BRT (UTC-3)."""
    from datetime import timezone, timedelta

    brt = timezone(timedelta(hours=-3))
    return datetime.now(brt)


def main():
    now = get_brt_now()
    date_stamp = now.strftime("%Y-%m-%d")
    timestamp = now.strftime("%d/%m/%Y %H:%M:%S")

    # Load all reports
    reports = []
    for agent in AGENTS:
        reports.append(load_report(agent["report"]))

    # Calculate totals
    total_c = sum(r["summary"]["critical"] for r in reports)
    total_h = sum(r["summary"]["high"] for r in reports)
    total_m = sum(r["summary"]["medium"] for r in reports)
    total_l = sum(r["summary"]["low"] for r in reports)
    total_all = total_c + total_h + total_m + total_l

    # Determine severity
    if total_c > 0:
        color = 16711680  # Red
        status_emoji = "\U0001f534"
        status_text = "CRITICAL \u2014 A\u00e7\u00e3o imediata necess\u00e1ria"
    elif total_h > 0:
        color = 16744448  # Orange
        status_emoji = "\U0001f7e0"
        status_text = "HIGH \u2014 Corre\u00e7\u00f5es priorit\u00e1rias pendentes"
    elif total_m > 0:
        color = 16776960  # Yellow
        status_emoji = "\U0001f7e1"
        status_text = "MEDIUM \u2014 Melhorias recomendadas"
    else:
        color = 65280  # Green
        status_emoji = "\U0001f7e2"
        status_text = "CLEAN \u2014 Nenhuma vulnerabilidade significativa"

    # ── Message 1: Summary ──
    agent_icons = ["\U0001f6e1\ufe0f", "\U0001f3d7\ufe0f", "\U0001f510"]
    agent_names = ["CodeSentinel", "InfraGuard", "AccessWatchdog"]

    por_agente_lines = []
    for icon, name, r in zip(agent_icons, agent_names, reports):
        s = r["summary"]
        por_agente_lines.append(
            f"{icon} {name}: **{s['total']}** ({s['critical']}C/{s['high']}H/{s['medium']}M/{s['low']}L)"
        )

    summary_embed = {
        "title": f"{status_emoji} Security Scan \u2014 {date_stamp}",
        "description": f"**Status: {status_text}**",
        "color": color,
        "fields": [
            {
                "name": "\U0001f4ca Resumo Geral",
                "value": (
                    f"\U0001f534 Critical: **{total_c}**\n"
                    f"\U0001f7e0 High: **{total_h}**\n"
                    f"\U0001f7e1 Medium: **{total_m}**\n"
                    f"\U0001f535 Low: **{total_l}**\n"
                    f"\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n"
                    f"\U0001f4cb Total: **{total_all}**"
                ),
                "inline": True,
            },
            {
                "name": "\U0001f916 Por Agente",
                "value": "\n".join(por_agente_lines),
                "inline": True,
            },
        ],
        "footer": {
            "text": f"Gestor Nexus Security \u2014 Scan autom\u00e1tico di\u00e1rio | {timestamp} BRT"
        },
    }

    print(f"[1] Enviando resumo geral...")
    send_discord({"embeds": [summary_embed]})
    time.sleep(2)

    # ── Agent Detail Messages ──
    total_messages = 1

    for idx, agent in enumerate(AGENTS):
        report = reports[idx]
        total = report["summary"]["total"]
        findings = parse_findings(report.get("findings", ""))
        chunks = chunk_findings(findings)

        if not chunks:
            # No findings — send single message
            embed = {
                "title": f"{agent['emoji']} {agent['title']}",
                "description": (
                    f"{agent['desc']}\n\n"
                    f"Nenhuma vulnerabilidade encontrada \u2705"
                ),
                "color": color,
            }
            print(f"[{total_messages + 1}] Enviando {agent['title']} (0 findings)...")
            send_discord({"embeds": [embed]})
            total_messages += 1
            time.sleep(2)
            continue

        total_chunks = len(chunks)

        for chunk_idx, chunk_items in enumerate(chunks):
            part = f" ({chunk_idx + 1}/{total_chunks})" if total_chunks > 1 else ""
            findings_text = "\n\n".join(chunk_items)

            embed = {
                "title": f"{agent['emoji']} {agent['title']}{part}",
                "description": (
                    f"{agent['desc']}\n\n"
                    f"**Findings ({total})**\n"
                    f"\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n"
                    f"{findings_text}"
                ),
                "color": color,
            }

            total_messages += 1
            print(f"[{total_messages}] Enviando {agent['title']}{part}...")
            send_discord({"embeds": [embed]})
            time.sleep(2)

    # ── Final Message: Closing ──
    end_now = get_brt_now()
    end_timestamp = end_now.strftime("%d/%m/%Y %H:%M:%S")

    closing_embed = {
        "title": "\U0001f3c1 Scan Completo",
        "description": (
            f"\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n"
            f"\U0001f534 Critical: **{total_c}**  \u00b7  "
            f"\U0001f7e0 High: **{total_h}**  \u00b7  "
            f"\U0001f7e1 Medium: **{total_m}**  \u00b7  "
            f"\U0001f535 Low: **{total_l}**\n"
            f"\U0001f4cb **Total: {total_all} findings**\n\n"
            f"\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501"
        ),
        "color": color,
        "footer": {
            "text": f"Gestor Nexus Security \u2014 Fim do relat\u00f3rio | {end_timestamp} BRT"
        },
    }

    total_messages += 1
    print(f"[{total_messages}] Enviando encerramento...")
    send_discord({"embeds": [closing_embed]})

    print(
        f"\n[OK] Relat\u00f3rio completo enviado ao Discord: "
        f"{total_all} findings em {total_messages} mensagens"
    )


if __name__ == "__main__":
    main()
