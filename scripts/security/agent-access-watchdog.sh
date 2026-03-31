#!/bin/bash
# ============================================================================
# AGENT 3: ACCESS WATCHDOG — Auth, Authorization & Data Exposure
# ============================================================================
# Monitora controle de acesso:
# - RBAC enforcement (roles em todos os endpoints)
# - IDOR vulnerabilities (object-level authorization)
# - Sensitive data exposure em responses
# - Token security (JWT config, refresh tokens)
# - Webhook signature validation
# - Session management
# - Multi-tenancy isolation
# - Logging & audit trail
# ============================================================================

set -uo pipefail

PROJECT_DIR="/root/Gmnexus"
API_DIR="${PROJECT_DIR}/apps/api/src"
WEB_DIR="${PROJECT_DIR}/apps/web/src"
REPORT_FILE="/tmp/security-report-access-watchdog.json"

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

echo "[AccessWatchdog] Iniciando scan em $(date '+%Y-%m-%d %H:%M:%S')..."

# ============================================================================
# 1. RBAC ENFORCEMENT
# ============================================================================
echo "[1/10] Checking RBAC enforcement..."

# Check all controllers have @Roles or @Public
for controller in $(find "$API_DIR/modules" -name "*.controller.ts" 2>/dev/null); do
  short=$(echo "$controller" | sed "s|$PROJECT_DIR/||")

  # Count endpoints without @Roles and without @Public
  METHODS=$(grep -c '@Get\|@Post\|@Put\|@Patch\|@Delete' "$controller" 2>/dev/null || echo "0")
  ROLES=$(grep -c '@Roles\|@Public' "$controller" 2>/dev/null || echo "0")
  CLASS_GUARD=$(grep -c '@UseGuards.*RolesGuard\|@Roles' "$controller" 2>/dev/null || echo "0")

  if [ "$METHODS" -gt 0 ] && [ "$ROLES" -eq 0 ] && [ "$CLASS_GUARD" -eq 0 ]; then
    add_finding "HIGH" "MISSING_RBAC" "$short" "${METHODS} endpoint(s) sem @Roles ou @Public definido"
  fi
done

# Check global guards in app.module
if [ -f "$API_DIR/app.module.ts" ]; then
  HAS_JWT_GUARD=$(grep -c 'APP_GUARD\|JwtAuthGuard' "$API_DIR/app.module.ts" 2>/dev/null || echo "0")
  if [ "$HAS_JWT_GUARD" -lt 2 ]; then
    add_finding "CRITICAL" "NO_GLOBAL_AUTH" "app.module.ts" "JwtAuthGuard não está registrado como global guard"
  fi
  HAS_ROLES_GUARD=$(grep -c 'APP_GUARD\|RolesGuard' "$API_DIR/app.module.ts" 2>/dev/null || echo "0")
  if [ "$HAS_ROLES_GUARD" -lt 2 ]; then
    add_finding "CRITICAL" "NO_GLOBAL_RBAC" "app.module.ts" "RolesGuard não está registrado como global guard"
  fi
fi

# ============================================================================
# 2. IDOR VULNERABILITIES
# ============================================================================
echo "[2/10] Checking for IDOR vulnerabilities..."

# Service methods that take an ID but don't check userId/role
# Skip services that are admin-only or internal (no user-facing IDOR risk)
IDOR_SKIP="finance\|status-configs\|push\.service\|mail\|audit\|dashboard\|subscriptions"
for service in $(find "$API_DIR/modules" -name "*.service.ts" 2>/dev/null | grep -v "$IDOR_SKIP"); do
  short=$(echo "$service" | sed "s|$PROJECT_DIR/||")

  # Check findOne/findById that only use { where: { id } } without userId
  UNSAFE_FIND=$(grep -n 'findUnique.*where.*id\b' "$service" 2>/dev/null | grep -v 'userId\|vendedorId\|gestorId\|creatorId\|assignedTo' | wc -l)
  if [ "$UNSAFE_FIND" -gt 0 ]; then
    add_finding "MEDIUM" "POTENTIAL_IDOR" "$short" "${UNSAFE_FIND} query(ies) findUnique por ID sem filtro de ownership"
  fi

  # Check update/delete without ownership verification
  UNSAFE_MUTATE=$(grep -n 'update.*where.*id\b\|delete.*where.*id\b' "$service" 2>/dev/null | grep -v 'userId\|vendedorId\|gestorId\|creatorId' | wc -l)
  if [ "$UNSAFE_MUTATE" -gt 0 ]; then
    add_finding "HIGH" "IDOR_MUTATION" "$short" "${UNSAFE_MUTATE} operação(ões) update/delete sem verificação de ownership"
  fi
done

# ============================================================================
# 3. SENSITIVE DATA IN RESPONSES
# ============================================================================
echo "[3/10] Checking for sensitive data exposure..."

# Check if User model returns passwordHash
for service in $(find "$API_DIR/modules" -name "*.service.ts" 2>/dev/null); do
  short=$(echo "$service" | sed "s|$PROJECT_DIR/||")

  # Methods returning User without excluding sensitive fields
  if grep -q 'prisma\.user\.' "$service" 2>/dev/null; then
    UNSAFE_RETURNS=$(grep -n 'return.*user\b\|return.*result\b' "$service" 2>/dev/null | head -20 | wc -l)
    HAS_SELECT=$(grep -c 'select:' "$service" 2>/dev/null || echo "0")
    HAS_EXCLUDE=$(grep -c 'passwordHash\|refreshToken.*delete\|omit.*password' "$service" 2>/dev/null || echo "0")

    if [ "$UNSAFE_RETURNS" -gt 2 ] && [ "$HAS_SELECT" -lt 2 ] && [ "$HAS_EXCLUDE" -lt 2 ]; then
      add_finding "HIGH" "SENSITIVE_DATA" "$short" "User service retorna objetos possivelmente sem filtrar campos sensíveis"
    fi
  fi
done

# Check for sensitive fields in Prisma include
SENSITIVE_INCLUDES=$(grep -rn "include.*password\|include.*refreshToken\|include.*tokenVersion" "$API_DIR" --include="*.ts" 2>/dev/null | grep -v "node_modules" | wc -l)
if [ "$SENSITIVE_INCLUDES" -gt 0 ]; then
  add_finding "HIGH" "SENSITIVE_INCLUDE" "API" "${SENSITIVE_INCLUDES} Prisma include com campos sensíveis"
fi

# ============================================================================
# 4. JWT TOKEN SECURITY
# ============================================================================
echo "[4/10] Checking JWT token security..."

# Check JWT algorithm explicitly set
if [ -f "$API_DIR/modules/auth/strategies/jwt.strategy.ts" ]; then
  if ! grep -q "algorithms\|algorithm" "$API_DIR/modules/auth/strategies/jwt.strategy.ts" 2>/dev/null; then
    add_finding "MEDIUM" "JWT_NO_ALGORITHM" "jwt.strategy.ts" "JWT algorithm não definido explicitamente (algorithm confusion risk)"
  fi
fi

# Check token expiration
if [ -f "$API_DIR/modules/auth/auth.service.ts" ]; then
  ACCESS_EXPIRY=$(grep -oP "expiresIn.*?['\"](\d+[smhd])['\"]" "$API_DIR/modules/auth/auth.service.ts" 2>/dev/null | head -1)
  if echo "$ACCESS_EXPIRY" | grep -q "24h\|7d\|30d" 2>/dev/null; then
    add_finding "HIGH" "JWT_LONG_EXPIRY" "auth.service.ts" "Access token com expiração muito longa: ${ACCESS_EXPIRY}"
  fi
fi

# Check token version implementation
if [ -f "$API_DIR/modules/auth/auth.service.ts" ]; then
  if ! grep -q "tokenVersion" "$API_DIR/modules/auth/auth.service.ts" 2>/dev/null; then
    add_finding "HIGH" "NO_TOKEN_VERSION" "auth.service.ts" "Token version não implementado (impossível invalidar sessões)"
  fi
fi

# ============================================================================
# 5. REFRESH TOKEN SECURITY
# ============================================================================
echo "[5/10] Checking refresh token security..."

# Check frontend token storage
if [ -f "$WEB_DIR/contexts/AuthContext.tsx" ]; then
  if grep -q "localStorage.*refresh\|localStorage.*token" "$WEB_DIR/contexts/AuthContext.tsx" 2>/dev/null; then
    add_finding "HIGH" "TOKEN_LOCALSTORAGE" "AuthContext.tsx" "Refresh token armazenado em localStorage (XSS pode roubar)"
  fi
fi

# Check Zustand persist with auth data
if [ -f "$WEB_DIR/stores/useAuthStore.ts" ]; then
  if grep -q "persist.*auth\|persist.*token\|persist.*user" "$WEB_DIR/stores/useAuthStore.ts" 2>/dev/null; then
    add_finding "MEDIUM" "AUTH_PERSIST" "useAuthStore.ts" "Dados de auth persistidos em localStorage via Zustand"
  fi
fi

# Check if refresh token rotation is implemented
if [ -f "$API_DIR/modules/auth/auth.service.ts" ]; then
  if ! grep -q "refreshToken.*rotation\|rotate.*refresh\|invalidate.*old" "$API_DIR/modules/auth/auth.service.ts" 2>/dev/null; then
    # Check if old refresh token is invalidated on use
    if ! grep -q "update.*refreshToken\|refreshToken.*null" "$API_DIR/modules/auth/auth.service.ts" 2>/dev/null; then
      add_finding "MEDIUM" "NO_TOKEN_ROTATION" "auth.service.ts" "Refresh token rotation possivelmente não implementado"
    fi
  fi
fi

# ============================================================================
# 6. WEBHOOK SECURITY
# ============================================================================
echo "[6/10] Checking webhook signature validation..."

for webhook_file in $(find "$API_DIR" -name "*webhook*" -name "*.ts" 2>/dev/null); do
  short=$(echo "$webhook_file" | sed "s|$PROJECT_DIR/||")

  # Check if webhook validates signature
  if grep -q '@Post\|@public\|handleWebhook\|handleEvent' "$webhook_file" 2>/dev/null; then
    if ! grep -q 'validateSignature\|verifySignature\|hmac\|timingSafeEqual\|signature' "$webhook_file" 2>/dev/null; then
      add_finding "HIGH" "WEBHOOK_NO_SIG" "$short" "Webhook endpoint sem validação de assinatura"
    fi
  fi

  # Check for timing-safe comparison
  if grep -q 'signature\s*===\|token\s*===' "$webhook_file" 2>/dev/null; then
    add_finding "HIGH" "TIMING_ATTACK" "$short" "Webhook usa === para comparar secret (timing-unsafe)"
  fi
done

# ============================================================================
# 7. MULTI-TENANCY ISOLATION
# ============================================================================
echo "[7/10] Checking tenant isolation..."

# Check for queries without tenant/user scoping
# Skip admin-only services (SUPERADMIN/ADMINISTRATIVO have full access by design)
SCOPE_SKIP="finance\|dashboard\|status-configs\|plans\|audit\|subscriptions"
for service in $(find "$API_DIR/modules" -name "*.service.ts" 2>/dev/null | grep -v "$SCOPE_SKIP"); do
  short=$(echo "$service" | sed "s|$PROJECT_DIR/||")

  # findMany without user filtering
  UNSCOPED=$(grep -n 'findMany()' "$service" 2>/dev/null | wc -l)
  if [ "$UNSCOPED" -gt 0 ]; then
    add_finding "MEDIUM" "UNSCOPED_QUERY" "$short" "${UNSCOPED} findMany() sem filtro de escopo (possível vazamento cross-tenant)"
  fi
done

# Check @Public endpoints that return data
# Skip known intentional public endpoints (OAuth callback, public forms, VAPID key, webhooks, health)
PUBLIC_SKIP="calendar-google\|forms\|notifications\|webhooks\|health"
for controller in $(find "$API_DIR/modules" -name "*.controller.ts" 2>/dev/null | grep -v "$PUBLIC_SKIP"); do
  short=$(echo "$controller" | sed "s|$PROJECT_DIR/||")

  PUBLIC_WITH_DATA=$(grep -A3 '@Public' "$controller" 2>/dev/null | grep '@Get' | wc -l)
  if [ "$PUBLIC_WITH_DATA" -gt 0 ]; then
    add_finding "MEDIUM" "PUBLIC_DATA_ENDPOINT" "$short" "${PUBLIC_WITH_DATA} endpoint(s) @Public com @Get (retorna dados sem auth)"
  fi
done

# ============================================================================
# 8. INPUT VALIDATION
# ============================================================================
echo "[8/10] Checking input validation..."

# Check ValidationPipe configuration
if [ -f "$API_DIR/main.ts" ]; then
  if ! grep -q 'ValidationPipe\|ZodValidationPipe' "$API_DIR/main.ts" 2>/dev/null; then
    add_finding "HIGH" "NO_VALIDATION_PIPE" "main.ts" "ValidationPipe não configurado globalmente"
  fi

  if grep -q 'whitelist.*true' "$API_DIR/main.ts" 2>/dev/null; then
    : # Good - whitelist enabled
  else
    if grep -q 'ValidationPipe' "$API_DIR/main.ts" 2>/dev/null; then
      add_finding "MEDIUM" "NO_WHITELIST" "main.ts" "ValidationPipe sem whitelist:true (aceita campos extras)"
    fi
  fi

  if grep -q 'enableImplicitConversion.*true' "$API_DIR/main.ts" 2>/dev/null; then
    add_finding "MEDIUM" "IMPLICIT_CONVERSION" "main.ts" "enableImplicitConversion:true pode causar type confusion"
  fi
fi

# Check for controllers without Zod/DTO validation
for controller in $(find "$API_DIR/modules" -name "*.controller.ts" 2>/dev/null); do
  short=$(echo "$controller" | sed "s|$PROJECT_DIR/||")

  POST_COUNT=$(grep -c '@Post\|@Put\|@Patch' "$controller" 2>/dev/null || echo "0")
  VALIDATION_COUNT=$(grep -c 'ZodValidation\|ValidationPipe\|@Body.*Dto\|UsePipes' "$controller" 2>/dev/null || echo "0")

  if [ "$POST_COUNT" -gt 0 ] && [ "$VALIDATION_COUNT" -eq 0 ]; then
    add_finding "MEDIUM" "NO_DTO_VALIDATION" "$short" "${POST_COUNT} endpoint(s) de escrita possivelmente sem validação de DTO"
  fi
done

# ============================================================================
# 9. LOGGING & AUDIT
# ============================================================================
echo "[9/10] Checking security logging..."

# Check if auth failures are logged
if [ -f "$API_DIR/modules/auth/auth.service.ts" ]; then
  if ! grep -q 'logger\|Logger\|console.warn\|console.error' "$API_DIR/modules/auth/auth.service.ts" 2>/dev/null; then
    add_finding "MEDIUM" "NO_AUTH_LOGGING" "auth.service.ts" "Falhas de autenticação não são logadas"
  fi
fi

# Check for security event logging
AUTH_LOGS=$(grep -rn 'failed.*login\|Login failed\|Refresh failed\|unauthorized\|forbidden\|invalid.*token\|brute.*force' "$API_DIR" --include="*.ts" 2>/dev/null | grep -v "node_modules" | wc -l)
if [ "$AUTH_LOGS" -lt 3 ]; then
  add_finding "MEDIUM" "INSUFFICIENT_LOGGING" "API" "Logging de eventos de segurança insuficiente (${AUTH_LOGS} referências)"
fi

# Check verbose logging in production
if [ -f "$API_DIR/main.ts" ]; then
  if grep -q "'debug'" "$API_DIR/main.ts" 2>/dev/null && grep -q "'verbose'" "$API_DIR/main.ts" 2>/dev/null && ! grep -q "NODE_ENV.*production\|production.*error" "$API_DIR/main.ts" 2>/dev/null; then
    add_finding "LOW" "VERBOSE_LOGGING" "main.ts" "Logging verbose habilitado (pode vazar dados sensíveis)"
  fi
fi

# ============================================================================
# 10. SOURCE MAP & BUILD SECURITY
# ============================================================================
echo "[10/10] Checking build security..."

# Check if source maps are enabled in production
if [ -f "$PROJECT_DIR/apps/web/vite.config.ts" ]; then
  if grep -q "sourcemap.*true" "$PROJECT_DIR/apps/web/vite.config.ts" 2>/dev/null; then
    add_finding "MEDIUM" "SOURCE_MAPS" "vite.config.ts" "Source maps habilitados (código fonte exposto em produção)"
  fi
fi

# Check for debug/dev endpoints (ignore comments, logger.debug, and functional test endpoints)
for controller in $(find "$API_DIR" -name "*.controller.ts" 2>/dev/null); do
  short=$(echo "$controller" | sed "s|$PROJECT_DIR/||")

  if grep -v '^\s*//\|^\s*\*\|logger\.debug' "$controller" 2>/dev/null | grep -q "dev-only\|swagger" 2>/dev/null; then
    add_finding "LOW" "DEBUG_ENDPOINT" "$short" "Possível endpoint de debug/dev-only em produção"
  fi
done

# ============================================================================
# OUTPUT
# ============================================================================
TOTAL=$((CRITICAL + HIGH + MEDIUM + LOW))

echo ""
echo "============================================"
echo " ACCESS WATCHDOG — Scan Completo"
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
    'agent': 'AccessWatchdog',
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
