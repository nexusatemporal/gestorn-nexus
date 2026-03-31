#!/bin/bash
# ============================================================================
# AGENT 2: INFRA GUARD — Infrastructure & Dependency Security
# ============================================================================
# Verifica segurança de infraestrutura:
# - npm audit (vulnerabilidades em dependências)
# - Docker security (non-root, exposed ports, secrets)
# - Security headers (helmet, CSP, HSTS)
# - CORS configuration
# - TLS/SSL verification
# - Firewall & network
# - Backup integrity
# ============================================================================

set -uo pipefail

PROJECT_DIR="/root/Gmnexus"
API_DIR="${PROJECT_DIR}/apps/api"
WEB_DIR="${PROJECT_DIR}/apps/web"
REPORT_FILE="/tmp/security-report-infra-guard.json"

CRITICAL=0
HIGH=0
MEDIUM=0
LOW=0
FINDINGS=""

add_finding() {
  local severity="$1"
  local category="$2"
  local location="$3"
  local detail="$4"

  case "$severity" in
    CRITICAL) CRITICAL=$((CRITICAL + 1)) ;;
    HIGH) HIGH=$((HIGH + 1)) ;;
    MEDIUM) MEDIUM=$((MEDIUM + 1)) ;;
    LOW) LOW=$((LOW + 1)) ;;
  esac

  FINDINGS="${FINDINGS}\n[${severity}] ${category} — ${location}: ${detail}"
}

echo "[InfraGuard] Iniciando scan em $(date '+%Y-%m-%d %H:%M:%S')..."

# ============================================================================
# 1. NPM AUDIT — Backend
# ============================================================================
echo "[1/8] Running npm audit (backend)..."

if [ -d "$API_DIR" ] && [ -f "$API_DIR/package-lock.json" ]; then
  AUDIT_OUTPUT=$(cd "$API_DIR" && npm audit --json 2>/dev/null || true)

  API_CRITICAL=$(echo "$AUDIT_OUTPUT" | jq -r '.metadata.vulnerabilities.critical // 0' 2>/dev/null || echo "0")
  API_HIGH=$(echo "$AUDIT_OUTPUT" | jq -r '.metadata.vulnerabilities.high // 0' 2>/dev/null || echo "0")
  API_MODERATE=$(echo "$AUDIT_OUTPUT" | jq -r '.metadata.vulnerabilities.moderate // 0' 2>/dev/null || echo "0")
  API_LOW_V=$(echo "$AUDIT_OUTPUT" | jq -r '.metadata.vulnerabilities.low // 0' 2>/dev/null || echo "0")
  API_TOTAL=$(echo "$AUDIT_OUTPUT" | jq -r '.metadata.vulnerabilities.total // 0' 2>/dev/null || echo "0")

  if [ "$API_CRITICAL" -gt 0 ] 2>/dev/null; then
    add_finding "CRITICAL" "NPM_VULN" "Backend" "${API_CRITICAL} vulnerabilidade(s) CRITICAL em dependências"
  fi
  if [ "$API_HIGH" -gt 0 ] 2>/dev/null; then
    add_finding "HIGH" "NPM_VULN" "Backend" "${API_HIGH} vulnerabilidade(s) HIGH em dependências"
  fi
  if [ "$API_MODERATE" -gt 0 ] 2>/dev/null; then
    add_finding "MEDIUM" "NPM_VULN" "Backend" "${API_MODERATE} vulnerabilidade(s) MODERATE em dependências"
  fi
  if [ "$API_LOW_V" -gt 0 ] 2>/dev/null; then
    add_finding "LOW" "NPM_VULN" "Backend" "${API_LOW_V} vulnerabilidade(s) LOW em dependências"
  fi
else
  add_finding "MEDIUM" "NPM_AUDIT" "Backend" "package-lock.json não encontrado — npm audit impossível"
fi

# ============================================================================
# 2. NPM/PNPM AUDIT — Frontend
# ============================================================================
echo "[2/8] Running pnpm audit (frontend)..."

if [ -d "$WEB_DIR" ] && [ -f "$WEB_DIR/pnpm-lock.yaml" ]; then
  PNPM_AUDIT=$(cd "$WEB_DIR" && pnpm audit --json 2>/dev/null || true)

  WEB_VULNS=$(echo "$PNPM_AUDIT" | jq -r '.metadata.vulnerabilities // empty' 2>/dev/null)
  if [ -n "$WEB_VULNS" ]; then
    WEB_CRITICAL=$(echo "$WEB_VULNS" | jq -r '.critical // 0' 2>/dev/null || echo "0")
    WEB_HIGH=$(echo "$WEB_VULNS" | jq -r '.high // 0' 2>/dev/null || echo "0")

    if [ "$WEB_CRITICAL" -gt 0 ] 2>/dev/null; then
      add_finding "CRITICAL" "NPM_VULN" "Frontend" "${WEB_CRITICAL} vulnerabilidade(s) CRITICAL em dependências"
    fi
    if [ "$WEB_HIGH" -gt 0 ] 2>/dev/null; then
      add_finding "HIGH" "NPM_VULN" "Frontend" "${WEB_HIGH} vulnerabilidade(s) HIGH em dependências"
    fi
  fi
fi

# ============================================================================
# 3. DOCKER SECURITY
# ============================================================================
echo "[3/8] Checking Docker security..."

# Check if containers run as root
RUNNING_CONTAINERS=$(docker ps --format "{{.Names}}" 2>/dev/null | grep -i "gestor-nexus" || true)
for container in $RUNNING_CONTAINERS; do
  USER=$(docker inspect --format '{{.Config.User}}' "$container" 2>/dev/null || echo "")
  if [ -z "$USER" ] || [ "$USER" = "root" ] || [ "$USER" = "0" ]; then
    add_finding "HIGH" "DOCKER_ROOT" "$container" "Container rodando como root"
  fi
done

# Check exposed ports
EXPOSED_PORTS=$(docker ps --format "{{.Names}} {{.Ports}}" 2>/dev/null | grep "gestor-nexus" | grep "0.0.0.0:" || true)
if [ -n "$EXPOSED_PORTS" ]; then
  while IFS= read -r line; do
    container_name=$(echo "$line" | awk '{print $1}')
    ports=$(echo "$line" | awk '{$1=""; print $0}' | xargs)
    add_finding "MEDIUM" "EXPOSED_PORTS" "$container_name" "Portas expostas externamente: ${ports}"
  done <<< "$EXPOSED_PORTS"
fi

# Check Docker Compose for secrets in environment
if [ -f "$PROJECT_DIR/docker-compose.yml" ]; then
  SECRET_ENVS=$(grep -n "KEY\|SECRET\|PASSWORD\|TOKEN" "$PROJECT_DIR/docker-compose.yml" 2>/dev/null | grep -v "^\s*#" | grep "=" | wc -l)
  if [ "$SECRET_ENVS" -gt 0 ]; then
    add_finding "HIGH" "DOCKER_SECRETS" "docker-compose.yml" "${SECRET_ENVS} secrets definidos como env vars (use Docker Secrets)"
  fi
fi

# Check if Docker images are up to date
for container in $RUNNING_CONTAINERS; do
  CREATED=$(docker inspect --format '{{.Created}}' "$container" 2>/dev/null | cut -d'T' -f1 || echo "")
  if [ -n "$CREATED" ]; then
    DAYS_OLD=$(( ($(date +%s) - $(date -d "$CREATED" +%s 2>/dev/null || echo "0")) / 86400 ))
    if [ "$DAYS_OLD" -gt 30 ] 2>/dev/null; then
      add_finding "MEDIUM" "STALE_CONTAINER" "$container" "Container criado há ${DAYS_OLD} dias (considere rebuild)"
    fi
  fi
done

# ============================================================================
# 4. SECURITY HEADERS CHECK
# ============================================================================
echo "[4/8] Checking security headers..."

# Check if helmet is installed
if [ -f "$API_DIR/package.json" ]; then
  if ! grep -q '"helmet"' "$API_DIR/package.json" 2>/dev/null; then
    add_finding "HIGH" "NO_HELMET" "Backend" "helmet não está instalado (security headers ausentes)"
  fi
fi

# Check main.ts for helmet usage
if [ -f "$API_DIR/src/main.ts" ]; then
  if ! grep -q 'helmet' "$API_DIR/src/main.ts" 2>/dev/null; then
    add_finding "HIGH" "NO_HELMET" "main.ts" "helmet não está configurado em main.ts"
  fi
fi

# Check nginx for security headers
if [ -f "$PROJECT_DIR/docker/nginx.conf" ]; then
  for header in "Content-Security-Policy" "Strict-Transport-Security" "Permissions-Policy"; do
    if ! grep -q "$header" "$PROJECT_DIR/docker/nginx.conf" 2>/dev/null; then
      add_finding "MEDIUM" "MISSING_HEADER" "nginx.conf" "Header ${header} não configurado"
    fi
  done
fi

# Live header check (if API is running)
if curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/api/v1/health" 2>/dev/null | grep -q "200"; then
  HEADERS=$(curl -sI "http://localhost:3001/api/v1/health" 2>/dev/null)

  for header in "x-content-type-options" "x-frame-options" "strict-transport-security" "content-security-policy"; do
    if ! echo "$HEADERS" | grep -qi "$header"; then
      add_finding "MEDIUM" "MISSING_HEADER" "API Response" "Header ${header} ausente na resposta HTTP"
    fi
  done
fi

# ============================================================================
# 5. RATE LIMITING
# ============================================================================
echo "[5/8] Checking rate limiting..."

if [ -f "$API_DIR/package.json" ]; then
  if ! grep -q '"@nestjs/throttler"' "$API_DIR/package.json" 2>/dev/null; then
    add_finding "HIGH" "NO_RATE_LIMIT" "Backend" "@nestjs/throttler não instalado (sem rate limiting)"
  fi
fi

if [ -f "$API_DIR/src/app.module.ts" ]; then
  if ! grep -q 'ThrottlerModule\|ThrottlerGuard' "$API_DIR/src/app.module.ts" 2>/dev/null; then
    add_finding "HIGH" "NO_RATE_LIMIT" "app.module.ts" "ThrottlerModule não configurado globalmente"
  fi
fi

# ============================================================================
# 6. CORS CONFIGURATION
# ============================================================================
echo "[6/8] Checking CORS configuration..."

if [ -f "$API_DIR/src/main.ts" ]; then
  if grep -q "origin.*['\"]\\*['\"]" "$API_DIR/src/main.ts" 2>/dev/null; then
    add_finding "CRITICAL" "CORS_WILDCARD" "main.ts" "CORS configurado com wildcard '*' (qualquer origin aceito)"
  fi

  if grep -q "credentials.*true" "$API_DIR/src/main.ts" 2>/dev/null && grep -q "origin.*\\*" "$API_DIR/src/main.ts" 2>/dev/null; then
    add_finding "CRITICAL" "CORS_CREDS_WILDCARD" "main.ts" "CORS com credentials:true + wildcard origin"
  fi
fi

# ============================================================================
# 7. SSL/TLS & NETWORK
# ============================================================================
echo "[7/8] Checking SSL/TLS and network security..."

# Check if database connection uses SSL
if [ -f "$API_DIR/.env" ]; then
  DB_URL=$(grep "^DATABASE_URL" "$API_DIR/.env" 2>/dev/null | head -1)
  if echo "$DB_URL" | grep -q "localhost\|127.0.0.1" 2>/dev/null; then
    # Local connection, SSL optional
    :
  elif ! echo "$DB_URL" | grep -qi "ssl\|sslmode" 2>/dev/null; then
    add_finding "MEDIUM" "NO_DB_SSL" "Database" "Conexão PostgreSQL sem SSL explícito"
  fi
fi

# Check Redis authentication
if [ -f "$PROJECT_DIR/docker-compose.yml" ]; then
  REDIS_CMD=$(grep -A5 "redis:" "$PROJECT_DIR/docker-compose.yml" 2>/dev/null | grep "command" || true)
  if echo "$REDIS_CMD" | grep -q "redis-server" 2>/dev/null && ! echo "$REDIS_CMD" | grep -q "requirepass" 2>/dev/null; then
    add_finding "MEDIUM" "REDIS_NO_AUTH" "Redis" "Redis sem autenticação (--requirepass não configurado)"
  fi
fi

# Check firewall
if command -v ufw >/dev/null 2>&1; then
  UFW_STATUS=$(ufw status 2>/dev/null | head -1)
  if echo "$UFW_STATUS" | grep -q "inactive"; then
    add_finding "MEDIUM" "FIREWALL_OFF" "System" "UFW firewall inativo"
  fi
elif command -v iptables >/dev/null 2>&1; then
  RULES=$(iptables -L INPUT -n 2>/dev/null | wc -l)
  if [ "$RULES" -le 3 ]; then
    add_finding "MEDIUM" "FIREWALL_MINIMAL" "System" "iptables com regras mínimas (possível falta de firewall)"
  fi
fi

# ============================================================================
# 8. BACKUP VERIFICATION
# ============================================================================
echo "[8/8] Checking backup status..."

# Check last backup
if [ -d "/root/backups/gmnexus" ]; then
  LATEST_BACKUP=$(ls -t /root/backups/gmnexus/backup_*.tar.gz 2>/dev/null | head -1)
  if [ -n "$LATEST_BACKUP" ]; then
    BACKUP_AGE_DAYS=$(( ($(date +%s) - $(stat -c %Y "$LATEST_BACKUP" 2>/dev/null || echo "0")) / 86400 ))
    if [ "$BACKUP_AGE_DAYS" -gt 2 ] 2>/dev/null; then
      add_finding "HIGH" "STALE_BACKUP" "Backup" "Último backup tem ${BACKUP_AGE_DAYS} dias (deveria ser diário)"
    fi
  else
    add_finding "HIGH" "NO_BACKUP" "Backup" "Nenhum backup local encontrado"
  fi
else
  add_finding "HIGH" "NO_BACKUP_DIR" "Backup" "Diretório de backup não existe"
fi

# Check S3 backup (read credentials from backup script if env vars not set)
BACKUP_SCRIPT="${PROJECT_DIR}/scripts/backup-project.sh"
if [ -z "${IDRIVE_ACCESS_KEY:-}" ] && [ -f "$BACKUP_SCRIPT" ]; then
  IDRIVE_ACCESS_KEY=$(grep 'AWS_ACCESS_KEY_ID=' "$BACKUP_SCRIPT" 2>/dev/null | head -1 | sed 's/.*="\(.*\)"/\1/')
  IDRIVE_SECRET_KEY=$(grep 'AWS_SECRET_ACCESS_KEY=' "$BACKUP_SCRIPT" 2>/dev/null | head -1 | sed 's/.*="\(.*\)"/\1/')
fi
if command -v aws >/dev/null 2>&1; then
  LATEST_S3=$(AWS_ACCESS_KEY_ID="${IDRIVE_ACCESS_KEY:-}" AWS_SECRET_ACCESS_KEY="${IDRIVE_SECRET_KEY:-}" \
    aws s3 ls s3://gestornexus/backups/project/ \
    --endpoint-url=https://o0m5.va.idrivee2-26.com \
    --region=us-east-1 2>/dev/null | tail -1 | awk '{print $1}')

  if [ -n "$LATEST_S3" ]; then
    S3_AGE=$(( ($(date +%s) - $(date -d "$LATEST_S3" +%s 2>/dev/null || echo "0")) / 86400 ))
    if [ "$S3_AGE" -gt 2 ] 2>/dev/null; then
      add_finding "HIGH" "STALE_S3_BACKUP" "S3 Backup" "Último backup S3 tem ${S3_AGE} dias"
    fi
  else
    add_finding "HIGH" "NO_S3_BACKUP" "S3" "Nenhum backup encontrado no S3"
  fi
fi

# ============================================================================
# OUTPUT
# ============================================================================
TOTAL=$((CRITICAL + HIGH + MEDIUM + LOW))

echo ""
echo "============================================"
echo " INFRA GUARD — Scan Completo"
echo "============================================"
echo " CRITICAL: ${CRITICAL}"
echo " HIGH:     ${HIGH}"
echo " MEDIUM:   ${MEDIUM}"
echo " LOW:      ${LOW}"
echo " TOTAL:    ${TOTAL}"
echo "============================================"

# Generate JSON report (use python3 for proper JSON escaping)
FINDINGS_PIPE=$(echo -e "$FINDINGS" | tr '\n' '|')
python3 -c "
import json, sys
findings = sys.stdin.read().strip()
report = {
    'agent': 'InfraGuard',
    'timestamp': '$(date -Iseconds)',
    'summary': {
        'critical': ${CRITICAL},
        'high': ${HIGH},
        'medium': ${MEDIUM},
        'low': ${LOW},
        'total': ${TOTAL}
    },
    'findings': findings
}
with open('$REPORT_FILE', 'w') as f:
    json.dump(report, f, ensure_ascii=False)
" <<< "$FINDINGS_PIPE"

echo "$REPORT_FILE"
