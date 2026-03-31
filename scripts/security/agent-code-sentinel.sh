#!/bin/bash
# ============================================================================
# AGENT 1: CODE SENTINEL — Static Application Security Testing (SAST)
# ============================================================================
# Varre o código fonte por vulnerabilidades estáticas:
# - Secrets hardcoded (API keys, passwords, tokens)
# - SQL/Command injection vectors
# - XSS patterns
# - JWT security issues
# - Prisma raw query risks
# - Insecure crypto usage
# - Missing auth guards
# - Prototype pollution vectors
# ============================================================================

set -uo pipefail

PROJECT_DIR="/root/Gmnexus"
API_DIR="${PROJECT_DIR}/apps/api/src"
WEB_DIR="${PROJECT_DIR}/apps/web/src"
REPORT_FILE="/tmp/security-report-code-sentinel.json"

CRITICAL=0
HIGH=0
MEDIUM=0
LOW=0
FINDINGS=""

add_finding() {
  local severity="$1"
  local category="$2"
  local file="$3"
  local detail="$4"

  case "$severity" in
    CRITICAL) CRITICAL=$((CRITICAL + 1)) ;;
    HIGH) HIGH=$((HIGH + 1)) ;;
    MEDIUM) MEDIUM=$((MEDIUM + 1)) ;;
    LOW) LOW=$((LOW + 1)) ;;
  esac

  local short_file="${file#$PROJECT_DIR/}"
  FINDINGS="${FINDINGS}\n[${severity}] ${category} — ${short_file}: ${detail}"
}

echo "[CodeSentinel] Iniciando scan em $(date '+%Y-%m-%d %H:%M:%S')..."

# ============================================================================
# 1. HARDCODED SECRETS
# ============================================================================
echo "[1/10] Scanning for hardcoded secrets..."

# API keys, passwords, tokens in source code (not .env)
while IFS= read -r file; do
  if grep -qiP '(api[_-]?key|secret[_-]?key|password|token)\s*[:=]\s*["\x27][A-Za-z0-9_\-]{16,}' "$file" 2>/dev/null; then
    matches=$(grep -ciP '(api[_-]?key|secret[_-]?key|password|token)\s*[:=]\s*["\x27][A-Za-z0-9_\-]{16,}' "$file" 2>/dev/null)
    add_finding "CRITICAL" "HARDCODED_SECRET" "$file" "${matches} possível(is) secret(s) hardcoded"
  fi
done < <(find "$API_DIR" "$WEB_DIR" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \) ! -path "*/node_modules/*" ! -path "*/dist/*" 2>/dev/null)

# JWT fallback secrets
if grep -rn "fallback.*secret\|default.*secret\|change.*in.*prod" "$API_DIR" --include="*.ts" 2>/dev/null | grep -v "node_modules" | grep -q .; then
  while IFS=: read -r file line _; do
    add_finding "CRITICAL" "JWT_FALLBACK_SECRET" "$file" "Linha ${line}: JWT secret com fallback hardcoded"
  done < <(grep -rn "fallback.*secret\|default.*secret\|change.*in.*prod" "$API_DIR" --include="*.ts" 2>/dev/null | grep -v "node_modules")
fi

# ============================================================================
# 2. SQL/COMMAND INJECTION
# ============================================================================
echo "[2/10] Scanning for injection vulnerabilities..."

# Prisma $queryRawUnsafe
if grep -rn '\$queryRawUnsafe\|\$executeRawUnsafe' "$API_DIR" --include="*.ts" 2>/dev/null | grep -v "node_modules" | grep -q .; then
  while IFS=: read -r file line _; do
    add_finding "CRITICAL" "SQL_INJECTION" "$file" "Linha ${line}: Uso de queryRawUnsafe (SQL injection risk)"
  done < <(grep -rn '\$queryRawUnsafe\|\$executeRawUnsafe' "$API_DIR" --include="*.ts" 2>/dev/null | grep -v "node_modules")
fi

# String interpolation in raw queries
if grep -rn '\$queryRaw.*\${' "$API_DIR" --include="*.ts" 2>/dev/null | grep -v "node_modules" | grep -q .; then
  while IFS=: read -r file line _; do
    add_finding "HIGH" "SQL_INJECTION" "$file" "Linha ${line}: Interpolação em raw query Prisma"
  done < <(grep -rn '\$queryRaw.*\${' "$API_DIR" --include="*.ts" 2>/dev/null | grep -v "node_modules")
fi

# Command injection via exec/spawn
if grep -rn 'child_process\|\.exec(\|\.execSync(' "$API_DIR" --include="*.ts" 2>/dev/null | grep -v "node_modules" | grep -q .; then
  while IFS=: read -r file line _; do
    add_finding "HIGH" "COMMAND_INJECTION" "$file" "Linha ${line}: Uso de child_process (command injection risk)"
  done < <(grep -rn 'child_process\|\.exec(\|\.execSync(' "$API_DIR" --include="*.ts" 2>/dev/null | grep -v "node_modules")
fi

# ============================================================================
# 3. XSS PATTERNS
# ============================================================================
echo "[3/10] Scanning for XSS vulnerabilities..."

# dangerouslySetInnerHTML in React
if grep -rn 'dangerouslySetInnerHTML' "$WEB_DIR" --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "node_modules" | grep -q .; then
  while IFS=: read -r file line _; do
    add_finding "HIGH" "XSS" "$file" "Linha ${line}: dangerouslySetInnerHTML (XSS risk)"
  done < <(grep -rn 'dangerouslySetInnerHTML' "$WEB_DIR" --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "node_modules")
fi

# eval() usage
if grep -rn '\beval\s*(' "$API_DIR" "$WEB_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "node_modules" | grep -q .; then
  while IFS=: read -r file line _; do
    add_finding "CRITICAL" "CODE_INJECTION" "$file" "Linha ${line}: Uso de eval() (code injection)"
  done < <(grep -rn '\beval\s*(' "$API_DIR" "$WEB_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "node_modules")
fi

# ============================================================================
# 4. INSECURE CRYPTO
# ============================================================================
echo "[4/10] Scanning for insecure cryptography..."

# MD5/SHA1 for security
if grep -rn "createHash.*['\"]md5['\"\|createHash.*['\"]sha1['\"]" "$API_DIR" --include="*.ts" 2>/dev/null | grep -v "node_modules" | grep -q .; then
  while IFS=: read -r file line _; do
    add_finding "MEDIUM" "WEAK_CRYPTO" "$file" "Linha ${line}: Hash inseguro (MD5/SHA1)"
  done < <(grep -rn "createHash.*['\"]md5['\"\|createHash.*['\"]sha1['\"]" "$API_DIR" --include="*.ts" 2>/dev/null | grep -v "node_modules")
fi

# Math.random for security
if grep -rn 'Math\.random()' "$API_DIR" --include="*.ts" 2>/dev/null | grep -v "node_modules" | grep -q .; then
  while IFS=: read -r file line _; do
    add_finding "MEDIUM" "INSECURE_RANDOM" "$file" "Linha ${line}: Math.random() (não é criptograficamente seguro)"
  done < <(grep -rn 'Math\.random()' "$API_DIR" --include="*.ts" 2>/dev/null | grep -v "node_modules")
fi

# ============================================================================
# 5. MISSING AUTH GUARDS
# ============================================================================
echo "[5/10] Scanning for missing auth guards..."

# Controllers without @UseGuards (skip if global guard is registered in app.module)
HAS_GLOBAL_GUARD=$(grep -c 'APP_GUARD' "$API_DIR/app.module.ts" 2>/dev/null || echo "0")
if [ "$HAS_GLOBAL_GUARD" -lt 1 ]; then
  for controller_file in $(find "$API_DIR" -name "*.controller.ts" ! -path "*/node_modules/*" 2>/dev/null); do
    if ! grep -q '@UseGuards\|@Public()' "$controller_file" 2>/dev/null; then
      add_finding "HIGH" "MISSING_AUTH" "$controller_file" "Controller sem @UseGuards ou @Public()"
    fi
  done
fi

# ============================================================================
# 6. SENSITIVE DATA EXPOSURE
# ============================================================================
echo "[6/10] Scanning for sensitive data exposure..."

# Password hash in API responses (return user without filtering)
if grep -rn 'return user;' "$API_DIR/modules/users" --include="*.ts" 2>/dev/null | grep -v "node_modules" | grep -q .; then
  count=$(grep -cn 'return user;' "$API_DIR/modules/users/users.service.ts" 2>/dev/null || echo "0")
  if [ "$count" -gt 0 ]; then
    add_finding "CRITICAL" "DATA_EXPOSURE" "$API_DIR/modules/users/users.service.ts" "${count} retorno(s) de objeto User completo (pode incluir passwordHash)"
  fi
fi

# Returning full Prisma objects without select
if grep -rn 'findMany()\|findMany({[^}]*})' "$API_DIR" --include="*.ts" 2>/dev/null | grep -v "select\|node_modules" | head -5 | grep -q .; then
  count=$(grep -rn 'findMany()\|findMany({' "$API_DIR" --include="*.ts" 2>/dev/null | grep -v "select\|node_modules" | wc -l)
  if [ "$count" -gt 0 ]; then
    add_finding "MEDIUM" "DATA_EXPOSURE" "$API_DIR" "${count} query(ies) findMany sem select (possível over-fetching)"
  fi
fi

# ============================================================================
# 7. TIMING-UNSAFE COMPARISONS
# ============================================================================
echo "[7/10] Scanning for timing-unsafe comparisons..."

# Secret/token/signature comparisons with === instead of timingSafeEqual
for pattern in "signature ===" "token ===" "secret ===" "apiKey ==="; do
  if grep -rn "$pattern" "$API_DIR" --include="*.ts" 2>/dev/null | grep -v "node_modules\|timingSafeEqual" | grep -q .; then
    while IFS=: read -r file line _; do
      add_finding "HIGH" "TIMING_ATTACK" "$file" "Linha ${line}: Comparação de secret com === (timing-unsafe)"
    done < <(grep -rn "$pattern" "$API_DIR" --include="*.ts" 2>/dev/null | grep -v "node_modules\|timingSafeEqual")
  fi
done

# ============================================================================
# 8. PROTOTYPE POLLUTION
# ============================================================================
echo "[8/10] Scanning for prototype pollution..."

# __proto__ or constructor.prototype access
if grep -rn '__proto__\|constructor\[' "$API_DIR" --include="*.ts" 2>/dev/null | grep -v "node_modules" | grep -q .; then
  while IFS=: read -r file line _; do
    add_finding "HIGH" "PROTOTYPE_POLLUTION" "$file" "Linha ${line}: Possível vetor de prototype pollution"
  done < <(grep -rn '__proto__\|constructor\[' "$API_DIR" --include="*.ts" 2>/dev/null | grep -v "node_modules")
fi

# Object spread from request body without validation
# Skip if global ValidationPipe with whitelist is configured (strips unknown fields)
HAS_WHITELIST=$(grep -c 'whitelist.*true\|forbidNonWhitelisted' "$API_DIR/main.ts" 2>/dev/null || echo "0")
if [ "$HAS_WHITELIST" -lt 1 ]; then
  if grep -rn '\.\.\.req\.body\|\.\.\.body\b' "$API_DIR" --include="*.ts" 2>/dev/null | grep -v "node_modules\|dto\|DTO" | grep -q .; then
    while IFS=: read -r file line _; do
      add_finding "MEDIUM" "MASS_ASSIGNMENT" "$file" "Linha ${line}: Spread de request body (mass assignment risk)"
    done < <(grep -rn '\.\.\.req\.body\|\.\.\.body\b' "$API_DIR" --include="*.ts" 2>/dev/null | grep -v "node_modules\|dto\|DTO")
  fi
fi

# ============================================================================
# 9. INSECURE DEPENDENCIES PATTERNS
# ============================================================================
echo "[9/10] Scanning for insecure code patterns..."

# jwt.decode without verify
if grep -rn 'jwt\.decode\b' "$API_DIR" --include="*.ts" 2>/dev/null | grep -v "node_modules\|verify" | grep -q .; then
  while IFS=: read -r file line _; do
    add_finding "HIGH" "JWT_NO_VERIFY" "$file" "Linha ${line}: jwt.decode() sem verificação"
  done < <(grep -rn 'jwt\.decode\b' "$API_DIR" --include="*.ts" 2>/dev/null | grep -v "node_modules\|verify")
fi

# Disabled SSL verification
if grep -rn 'rejectUnauthorized.*false\|NODE_TLS_REJECT_UNAUTHORIZED' "$API_DIR" --include="*.ts" 2>/dev/null | grep -v "node_modules" | grep -q .; then
  while IFS=: read -r file line _; do
    add_finding "HIGH" "SSL_DISABLED" "$file" "Linha ${line}: Verificação SSL desabilitada"
  done < <(grep -rn 'rejectUnauthorized.*false\|NODE_TLS_REJECT_UNAUTHORIZED' "$API_DIR" --include="*.ts" 2>/dev/null | grep -v "node_modules")
fi

# ============================================================================
# 10. .ENV EXPOSURE
# ============================================================================
echo "[10/10] Scanning for .env exposure..."

# .env files tracked by git (gitignored .env on disk is expected)
while IFS= read -r envfile; do
  if [ -f "$envfile" ]; then
    # Only flag if tracked by git (committed or staged)
    if git -C "$PROJECT_DIR" ls-files --cached --error-unmatch "$envfile" >/dev/null 2>&1; then
      secret_count=$(grep -ciP '(KEY|SECRET|PASSWORD|TOKEN)=' "$envfile" 2>/dev/null || echo "0")
      if [ "$secret_count" -gt 0 ]; then
        add_finding "CRITICAL" "ENV_EXPOSURE" "$envfile" "${secret_count} secrets em arquivo .env commitado no git"
      fi
    fi
  fi
done < <(find "$PROJECT_DIR" -name ".env" -not -path "*/node_modules/*" 2>/dev/null)

# Secrets in committed files (CLAUDE.md, BACKUP.md, etc)
# Match real credential values (at least 10 chars after = or :), not empty placeholders
for docfile in "$PROJECT_DIR/CLAUDE.md" "$PROJECT_DIR/BACKUP.md" "$PROJECT_DIR/CHANGELOG.md"; do
  if [ -f "$docfile" ] && grep -qiP '(AWS_SECRET_ACCESS_KEY|API_KEY|SECRET_KEY)\s*[=:]\s*"[A-Za-z0-9_/+\-]{10,}"' "$docfile" 2>/dev/null; then
    add_finding "CRITICAL" "SECRETS_IN_DOCS" "$docfile" "Credenciais reais em arquivo de documentação"
  fi
done

# ============================================================================
# OUTPUT
# ============================================================================
TOTAL=$((CRITICAL + HIGH + MEDIUM + LOW))

echo ""
echo "============================================"
echo " CODE SENTINEL — Scan Completo"
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
    'agent': 'CodeSentinel',
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
