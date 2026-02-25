#!/bin/bash
# ============================================================================
# GESTOR NEXUS - Script de Backup Completo
# ============================================================================
# Faz backup completo do sistema e envia para IDrive e2 (S3-compatible)
# ============================================================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variáveis
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
BACKUP_NAME="gestor-nexus-${TIMESTAMP}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"
PROJECT_DIR="/app"

# IDrive e2 S3 Configuration
S3_BUCKET="${IDRIVE_BUCKET:-gestor-nexus-backups}"
S3_ENDPOINT="${IDRIVE_ENDPOINT:-https://o0m5.va.idrivee2-26.com}"
S3_REGION="${IDRIVE_REGION:-us-east-1}"

# Retenção (dias)
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  GESTOR NEXUS - BACKUP COMPLETO${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Data: $(date '+%Y-%m-%d %H:%M:%S')"
echo -e "Backup: ${BACKUP_NAME}"
echo ""

# ============================================================================
# 1. CRIAR DIRETÓRIO DE BACKUP
# ============================================================================
echo -e "${YELLOW}[1/7]${NC} Criando diretório de backup..."
mkdir -p "${BACKUP_PATH}"

# ============================================================================
# 2. BACKUP DO BANCO DE DADOS POSTGRESQL
# ============================================================================
echo -e "${YELLOW}[2/7]${NC} Fazendo backup do PostgreSQL..."

DB_FILE="${BACKUP_PATH}/database.sql.gz"

PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
  -h "${POSTGRES_HOST:-postgres}" \
  -U "${POSTGRES_USER:-gestor}" \
  -d "${POSTGRES_DB:-gestor_nexus}" \
  --verbose \
  --no-owner \
  --no-privileges \
  | gzip > "${DB_FILE}"

DB_SIZE=$(du -h "${DB_FILE}" | cut -f1)
echo -e "${GREEN}✓${NC} Database backup: ${DB_SIZE}"

# ============================================================================
# 3. BACKUP DO CÓDIGO FONTE
# ============================================================================
echo -e "${YELLOW}[3/7]${NC} Fazendo backup do código fonte..."

CODE_FILE="${BACKUP_PATH}/code.tar.gz"

tar -czf "${CODE_FILE}" \
  -C "${PROJECT_DIR}" \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='dist' \
  --exclude='build' \
  --exclude='.next' \
  --exclude='.turbo' \
  --exclude='coverage' \
  --exclude='.env' \
  .

CODE_SIZE=$(du -h "${CODE_FILE}" | cut -f1)
echo -e "${GREEN}✓${NC} Code backup: ${CODE_SIZE}"

# ============================================================================
# 4. BACKUP DOS VOLUMES DOCKER
# ============================================================================
echo -e "${YELLOW}[4/7]${NC} Fazendo backup dos volumes Docker..."

# Postgres data volume (se montado)
if [ -d "/var/lib/postgresql/data" ]; then
  POSTGRES_VOL_FILE="${BACKUP_PATH}/postgres-volume.tar.gz"
  tar -czf "${POSTGRES_VOL_FILE}" -C /var/lib/postgresql/data .
  POSTGRES_VOL_SIZE=$(du -h "${POSTGRES_VOL_FILE}" | cut -f1)
  echo -e "${GREEN}✓${NC} Postgres volume: ${POSTGRES_VOL_SIZE}"
fi

# Redis data volume (se montado)
if [ -d "/data" ]; then
  REDIS_VOL_FILE="${BACKUP_PATH}/redis-volume.tar.gz"
  tar -czf "${REDIS_VOL_FILE}" -C /data .
  REDIS_VOL_SIZE=$(du -h "${REDIS_VOL_FILE}" | cut -f1)
  echo -e "${GREEN}✓${NC} Redis volume: ${REDIS_VOL_SIZE}"
fi

# ============================================================================
# 5. CRIAR MANIFESTO DO BACKUP
# ============================================================================
echo -e "${YELLOW}[5/7]${NC} Criando manifesto..."

cat > "${BACKUP_PATH}/manifest.json" <<EOF
{
  "backup_name": "${BACKUP_NAME}",
  "timestamp": "${TIMESTAMP}",
  "date": "$(date -Iseconds)",
  "hostname": "$(hostname)",
  "components": {
    "database": {
      "file": "database.sql.gz",
      "size": "${DB_SIZE}",
      "type": "PostgreSQL",
      "version": "$(psql --version | head -n1)"
    },
    "code": {
      "file": "code.tar.gz",
      "size": "${CODE_SIZE}",
      "project_dir": "${PROJECT_DIR}"
    }
  },
  "retention_days": ${RETENTION_DAYS}
}
EOF

echo -e "${GREEN}✓${NC} Manifesto criado"

# ============================================================================
# 6. COMPRIMIR BACKUP COMPLETO
# ============================================================================
echo -e "${YELLOW}[6/7]${NC} Comprimindo backup completo..."

FINAL_BACKUP="${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
tar -czf "${FINAL_BACKUP}" -C "${BACKUP_DIR}" "${BACKUP_NAME}"

FINAL_SIZE=$(du -h "${FINAL_BACKUP}" | cut -f1)
echo -e "${GREEN}✓${NC} Backup final: ${FINAL_SIZE}"

# Remover diretório temporário
rm -rf "${BACKUP_PATH}"

# ============================================================================
# 7. UPLOAD PARA IDRIVE E2
# ============================================================================
echo -e "${YELLOW}[7/7]${NC} Enviando para IDrive e2..."

aws s3 cp "${FINAL_BACKUP}" \
  "s3://${S3_BUCKET}/backups/${BACKUP_NAME}.tar.gz" \
  --endpoint-url="${S3_ENDPOINT}" \
  --region="${S3_REGION}" \
  --storage-class STANDARD

echo -e "${GREEN}✓${NC} Upload concluído"

# ============================================================================
# LIMPEZA DE BACKUPS ANTIGOS (LOCAL)
# ============================================================================
echo ""
echo -e "${YELLOW}Limpando backups locais antigos (>${RETENTION_DAYS} dias)...${NC}"

find "${BACKUP_DIR}" -name "gestor-nexus-*.tar.gz" -type f -mtime +${RETENTION_DAYS} -delete

# ============================================================================
# LIMPEZA DE BACKUPS ANTIGOS (IDRIVE E2)
# ============================================================================
echo -e "${YELLOW}Limpando backups remotos antigos (>${RETENTION_DAYS} dias)...${NC}"

# Listar e deletar backups antigos do S3
# Calcular data de corte (30 dias atrás)
CUTOFF_TIMESTAMP=$(($(date +%s) - RETENTION_DAYS * 86400))
CUTOFF_DATE=$(date -d "@${CUTOFF_TIMESTAMP}" +%Y%m%d 2>/dev/null || echo "19700101")

aws s3 ls "s3://${S3_BUCKET}/backups/" \
  --endpoint-url="${S3_ENDPOINT}" \
  --region="${S3_REGION}" \
  | awk '{print $4}' \
  | grep "gestor-nexus-" \
  | while read -r file; do
    FILE_DATE=$(echo "$file" | sed 's/gestor-nexus-\([0-9]\{8\}\).*/\1/')
    if [ "$FILE_DATE" -lt "$CUTOFF_DATE" ]; then
      echo "Deletando: $file"
      aws s3 rm "s3://${S3_BUCKET}/backups/$file" \
        --endpoint-url="${S3_ENDPOINT}" \
        --region="${S3_REGION}"
    fi
  done

# ============================================================================
# RESUMO FINAL
# ============================================================================
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  BACKUP CONCLUÍDO COM SUCESSO!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "Backup: ${BACKUP_NAME}.tar.gz"
echo -e "Tamanho: ${FINAL_SIZE}"
echo -e "Local: ${FINAL_BACKUP}"
echo -e "Remoto: s3://${S3_BUCKET}/backups/${BACKUP_NAME}.tar.gz"
echo ""

# Remover backup local após upload (opcional)
if [ "${KEEP_LOCAL_BACKUP}" != "true" ]; then
  echo -e "${YELLOW}Removendo backup local...${NC}"
  rm -f "${FINAL_BACKUP}"
  echo -e "${GREEN}✓${NC} Backup local removido"
fi

echo -e "${BLUE}Backup finalizado em: $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo ""

exit 0
