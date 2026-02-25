#!/bin/bash
# ============================================================================
# GESTOR NEXUS - Script de Restore Completo
# ============================================================================
# Restaura backup completo do IDrive e2
# ============================================================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# IDrive e2 S3 Configuration
S3_BUCKET="${IDRIVE_BUCKET:-gestor-nexus-backups}"
S3_ENDPOINT="${IDRIVE_ENDPOINT:-https://o0m5.va.idrivee2-26.com}"
S3_REGION="${IDRIVE_REGION:-us-east-1}"

# Diretórios
BACKUP_DIR="/backups"
RESTORE_DIR="/restore"
PROJECT_DIR="/app"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  GESTOR NEXUS - RESTORE COMPLETO${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# ============================================================================
# 1. LISTAR BACKUPS DISPONÍVEIS
# ============================================================================
echo -e "${YELLOW}Backups disponíveis no IDrive e2:${NC}"
echo ""

aws s3 ls "s3://${S3_BUCKET}/backups/" \
  --endpoint-url="${S3_ENDPOINT}" \
  --region="${S3_REGION}" \
  | grep "gestor-nexus-" \
  | awk '{print NR". "$4" ("$3")"}'

echo ""
echo -e "${YELLOW}Digite o nome do backup para restaurar (ex: gestor-nexus-20260119_120000.tar.gz):${NC}"
read -r BACKUP_NAME

if [ -z "$BACKUP_NAME" ]; then
  echo -e "${RED}✗${NC} Nome do backup não informado"
  exit 1
fi

echo ""
echo -e "${YELLOW}⚠️  ATENÇÃO: Este processo irá SUBSTITUIR os dados atuais!${NC}"
echo -e "${YELLOW}Deseja continuar? (yes/no):${NC}"
read -r CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo -e "${RED}✗${NC} Restore cancelado"
  exit 0
fi

echo ""

# ============================================================================
# 2. DOWNLOAD DO BACKUP
# ============================================================================
echo -e "${YELLOW}[1/5]${NC} Baixando backup do IDrive e2..."

mkdir -p "${BACKUP_DIR}"
BACKUP_FILE="${BACKUP_DIR}/${BACKUP_NAME}"

aws s3 cp "s3://${S3_BUCKET}/backups/${BACKUP_NAME}" \
  "${BACKUP_FILE}" \
  --endpoint-url="${S3_ENDPOINT}" \
  --region="${S3_REGION}"

BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo -e "${GREEN}✓${NC} Download concluído: ${BACKUP_SIZE}"

# ============================================================================
# 3. EXTRAIR BACKUP
# ============================================================================
echo -e "${YELLOW}[2/5]${NC} Extraindo backup..."

mkdir -p "${RESTORE_DIR}"
tar -xzf "${BACKUP_FILE}" -C "${RESTORE_DIR}"

# Identificar diretório extraído
EXTRACTED_DIR=$(find "${RESTORE_DIR}" -maxdepth 1 -type d -name "gestor-nexus-*" | head -n1)

if [ -z "$EXTRACTED_DIR" ]; then
  echo -e "${RED}✗${NC} Diretório do backup não encontrado"
  exit 1
fi

echo -e "${GREEN}✓${NC} Backup extraído: ${EXTRACTED_DIR}"

# ============================================================================
# 4. RESTAURAR BANCO DE DADOS
# ============================================================================
echo -e "${YELLOW}[3/5]${NC} Restaurando banco de dados..."

DB_FILE="${EXTRACTED_DIR}/database.sql.gz"

if [ -f "$DB_FILE" ]; then
  # Drop e recreate database (CUIDADO!)
  echo -e "${YELLOW}  Recriando database...${NC}"

  PGPASSWORD="${POSTGRES_PASSWORD}" psql \
    -h "${POSTGRES_HOST:-postgres}" \
    -U "${POSTGRES_USER:-gestor}" \
    -d postgres \
    -c "DROP DATABASE IF EXISTS ${POSTGRES_DB:-gestor_nexus};"

  PGPASSWORD="${POSTGRES_PASSWORD}" psql \
    -h "${POSTGRES_HOST:-postgres}" \
    -U "${POSTGRES_USER:-gestor}" \
    -d postgres \
    -c "CREATE DATABASE ${POSTGRES_DB:-gestor_nexus};"

  # Restore
  echo -e "${YELLOW}  Importando dados...${NC}"
  gunzip -c "${DB_FILE}" | PGPASSWORD="${POSTGRES_PASSWORD}" psql \
    -h "${POSTGRES_HOST:-postgres}" \
    -U "${POSTGRES_USER:-gestor}" \
    -d "${POSTGRES_DB:-gestor_nexus}" \
    --quiet

  echo -e "${GREEN}✓${NC} Database restaurado"
else
  echo -e "${RED}✗${NC} Arquivo de database não encontrado: ${DB_FILE}"
fi

# ============================================================================
# 5. RESTAURAR CÓDIGO FONTE
# ============================================================================
echo -e "${YELLOW}[4/5]${NC} Restaurando código fonte..."

CODE_FILE="${EXTRACTED_DIR}/code.tar.gz"

if [ -f "$CODE_FILE" ]; then
  # Backup do código atual (segurança)
  if [ -d "$PROJECT_DIR" ]; then
    echo -e "${YELLOW}  Fazendo backup do código atual...${NC}"
    mv "$PROJECT_DIR" "${PROJECT_DIR}.backup.$(date +%s)"
  fi

  # Restore código
  mkdir -p "$PROJECT_DIR"
  tar -xzf "$CODE_FILE" -C "$PROJECT_DIR"

  echo -e "${GREEN}✓${NC} Código fonte restaurado"
else
  echo -e "${YELLOW}⚠${NC} Arquivo de código não encontrado: ${CODE_FILE}"
fi

# ============================================================================
# 6. RESTAURAR VOLUMES DOCKER (OPCIONAL)
# ============================================================================
echo -e "${YELLOW}[5/5]${NC} Restaurando volumes Docker..."

# Postgres volume
POSTGRES_VOL_FILE="${EXTRACTED_DIR}/postgres-volume.tar.gz"
if [ -f "$POSTGRES_VOL_FILE" ] && [ -d "/var/lib/postgresql/data" ]; then
  echo -e "${YELLOW}  Restaurando volume PostgreSQL...${NC}"
  tar -xzf "$POSTGRES_VOL_FILE" -C /var/lib/postgresql/data
  echo -e "${GREEN}✓${NC} Volume PostgreSQL restaurado"
fi

# Redis volume
REDIS_VOL_FILE="${EXTRACTED_DIR}/redis-volume.tar.gz"
if [ -f "$REDIS_VOL_FILE" ] && [ -d "/data" ]; then
  echo -e "${YELLOW}  Restaurando volume Redis...${NC}"
  tar -xzf "$REDIS_VOL_FILE" -C /data
  echo -e "${GREEN}✓${NC} Volume Redis restaurado"
fi

# ============================================================================
# LIMPEZA
# ============================================================================
echo ""
echo -e "${YELLOW}Limpando arquivos temporários...${NC}"
rm -rf "${RESTORE_DIR}"
rm -f "${BACKUP_FILE}"

# ============================================================================
# RESUMO FINAL
# ============================================================================
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  RESTORE CONCLUÍDO COM SUCESSO!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}⚠️  PRÓXIMOS PASSOS:${NC}"
echo -e "1. Reiniciar os serviços: docker stack deploy -c docker-compose.yml gestor-nexus"
echo -e "2. Verificar logs: docker service logs gestor-nexus_api -f"
echo -e "3. Testar aplicação: https://gestornx.nexusatemporal.com"
echo ""

exit 0
