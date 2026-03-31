#!/bin/bash
# ============================================================================
# GESTOR NEXUS — Security Scan Orchestrator
# ============================================================================
# Executa os 3 agentes de segurança e envia relatório completo ao Discord
# Cron: Todos os dias às 03:00 BRT (06:00 UTC)
# ============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="/root/backups/gmnexus/security-scan.log"
DATE_STAMP=$(date +%Y-%m-%d)

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

mkdir -p "$(dirname "$LOG_FILE")"

log "========================================="
log "SECURITY SCAN INICIADO"
log "========================================="

# ============================================================================
# RUN AGENTS
# ============================================================================

log "Executando Agent 1: CodeSentinel..."
bash "$SCRIPT_DIR/agent-code-sentinel.sh" >> "$LOG_FILE" 2>&1
CS_REPORT="/tmp/security-report-code-sentinel.json"

log "Executando Agent 2: InfraGuard..."
bash "$SCRIPT_DIR/agent-infra-guard.sh" >> "$LOG_FILE" 2>&1
IG_REPORT="/tmp/security-report-infra-guard.json"

log "Executando Agent 3: AccessWatchdog..."
bash "$SCRIPT_DIR/agent-access-watchdog.sh" >> "$LOG_FILE" 2>&1
AW_REPORT="/tmp/security-report-access-watchdog.json"

# ============================================================================
# PARSE RESULTS
# ============================================================================

parse_report() {
  local file="$1"
  if [ -f "$file" ]; then
    jq -r "$2" "$file" 2>/dev/null || echo "0"
  else
    echo "0"
  fi
}

# CodeSentinel
CS_CRITICAL=$(parse_report "$CS_REPORT" '.summary.critical')
CS_HIGH=$(parse_report "$CS_REPORT" '.summary.high')
CS_MEDIUM=$(parse_report "$CS_REPORT" '.summary.medium')
CS_LOW=$(parse_report "$CS_REPORT" '.summary.low')
CS_TOTAL=$(parse_report "$CS_REPORT" '.summary.total')

# InfraGuard
IG_CRITICAL=$(parse_report "$IG_REPORT" '.summary.critical')
IG_HIGH=$(parse_report "$IG_REPORT" '.summary.high')
IG_MEDIUM=$(parse_report "$IG_REPORT" '.summary.medium')
IG_LOW=$(parse_report "$IG_REPORT" '.summary.low')
IG_TOTAL=$(parse_report "$IG_REPORT" '.summary.total')

# AccessWatchdog
AW_CRITICAL=$(parse_report "$AW_REPORT" '.summary.critical')
AW_HIGH=$(parse_report "$AW_REPORT" '.summary.high')
AW_MEDIUM=$(parse_report "$AW_REPORT" '.summary.medium')
AW_LOW=$(parse_report "$AW_REPORT" '.summary.low')
AW_TOTAL=$(parse_report "$AW_REPORT" '.summary.total')

# Totals
TOTAL_CRITICAL=$((CS_CRITICAL + IG_CRITICAL + AW_CRITICAL))
TOTAL_HIGH=$((CS_HIGH + IG_HIGH + AW_HIGH))
TOTAL_MEDIUM=$((CS_MEDIUM + IG_MEDIUM + AW_MEDIUM))
TOTAL_LOW=$((CS_LOW + IG_LOW + AW_LOW))
TOTAL_ALL=$((TOTAL_CRITICAL + TOTAL_HIGH + TOTAL_MEDIUM + TOTAL_LOW))

# ============================================================================
# SEND TO DISCORD — via Python (no truncation, multi-message support)
# ============================================================================
log "Enviando relatório completo para Discord via Python..."

python3 "$SCRIPT_DIR/send-discord-report.py" 2>&1 | tee -a "$LOG_FILE"

# ============================================================================
# CLEANUP
# ============================================================================
rm -f /tmp/security-report-*.json

log "========================================="
log "SECURITY SCAN COMPLETO"
log "Total: ${TOTAL_ALL} findings (${TOTAL_CRITICAL}C/${TOTAL_HIGH}H/${TOTAL_MEDIUM}M/${TOTAL_LOW}L)"
log "Relatório enviado ao Discord"
log "========================================="

exit 0
