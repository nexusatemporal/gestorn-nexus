#!/bin/bash
# ════════════════════════════════════════════════════════════════════════════════
# 🔗 GESTOR NEXUS — Conector de Landing Pages
# ════════════════════════════════════════════════════════════════════════════════
#
# Conecta qualquer Landing Page ao pipeline de vendas do Gestor Nexus.
# Roda na VPS onde a LP está hospedada, escaneia o HTML, detecta o form,
# e injeta o código de integração automaticamente.
#
# USO:
#   curl -sL https://raw.githubusercontent.com/... | bash
#   — ou —
#   bash gestor-connect.sh [diretório-da-lp]
#
# ════════════════════════════════════════════════════════════════════════════════

set -e

# ── Cores ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── Config ──
GESTOR_API="https://apigestor.nexusatemporal.com/api/v1"
LP_DIR="${1:-.}"

echo ""
echo -e "${BOLD}════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}🔗 Gestor Nexus — Conector de Landing Pages${NC}"
echo -e "${BOLD}════════════════════════════════════════════════════════════${NC}"
echo ""

# ══════════════════════════════════════════════════════════════
# STEP 1: Detectar HTML da LP
# ══════════════════════════════════════════════════════════════

echo -e "${YELLOW}[1/5]${NC} Escaneando diretório: ${BOLD}$LP_DIR${NC}"

# Encontrar arquivos HTML (excluir node_modules, .git, etc.)
HTML_FILES=$(find "$LP_DIR" -maxdepth 3 -name "*.html" \
  ! -path "*/node_modules/*" \
  ! -path "*/.git/*" \
  ! -path "*/dist/*" \
  ! -path "*/build/*" \
  2>/dev/null | sort)

if [ -z "$HTML_FILES" ]; then
  echo -e "${RED}❌ Nenhum arquivo HTML encontrado em $LP_DIR${NC}"
  exit 1
fi

FILE_COUNT=$(echo "$HTML_FILES" | wc -l)
echo -e "   Encontrados: ${GREEN}$FILE_COUNT arquivo(s) HTML${NC}"

# Se múltiplos, deixar o usuário escolher
if [ "$FILE_COUNT" -gt 1 ]; then
  echo ""
  echo "   Qual arquivo contém o formulário?"
  i=1
  while IFS= read -r f; do
    echo -e "   ${BOLD}[$i]${NC} $(basename "$f")"
    i=$((i + 1))
  done <<< "$HTML_FILES"
  echo ""
  read -rp "   Escolha (1-$FILE_COUNT): " CHOICE
  HTML_FILE=$(echo "$HTML_FILES" | sed -n "${CHOICE}p")
else
  HTML_FILE="$HTML_FILES"
fi

if [ ! -f "$HTML_FILE" ]; then
  echo -e "${RED}❌ Arquivo não encontrado: $HTML_FILE${NC}"
  exit 1
fi

echo -e "   Arquivo: ${GREEN}$(basename "$HTML_FILE")${NC}"

# ══════════════════════════════════════════════════════════════
# STEP 2: Detectar form e campos
# ══════════════════════════════════════════════════════════════

echo ""
echo -e "${YELLOW}[2/5]${NC} Analisando formulário..."

# Extrair campos do form (input, select, textarea)
FIELDS=$(grep -oP '(?:id|name)="[^"]*"' "$HTML_FILE" | \
  grep -v 'lgpd\|csrf\|_token\|submit\|btn\|formOk' | \
  sed 's/.*="\(.*\)"/\1/' | \
  sort -u)

# Extrair labels para referência
LABELS=$(grep -oP '<label[^>]*>[^<]*' "$HTML_FILE" | \
  sed 's/<label[^>]*>//' | \
  sed 's/<[^>]*>//g' | \
  sed 's/[[:space:]]*\*[[:space:]]*//' | \
  grep -v '^$' | \
  head -20)

# Detectar form ID
FORM_ID=$(grep -oP '<form[^>]*id="([^"]*)"' "$HTML_FILE" | \
  head -1 | sed 's/.*id="\([^"]*\)"/\1/')

if [ -z "$FORM_ID" ]; then
  FORM_ID=$(grep -oP '<form' "$HTML_FILE" | head -1 > /dev/null && echo "form-detected")
fi

if [ -z "$FORM_ID" ] && [ -z "$FIELDS" ]; then
  echo -e "${RED}❌ Nenhum formulário detectado no HTML${NC}"
  exit 1
fi

echo -e "   Form ID: ${GREEN}${FORM_ID:-auto-detect}${NC}"
echo ""
echo "   Campos detectados:"

# Criar array de campos
declare -a FIELD_ARRAY
i=0
while IFS= read -r field; do
  [ -z "$field" ] && continue
  FIELD_ARRAY[$i]="$field"
  echo -e "   ${BOLD}[$i]${NC} $field"
  i=$((i + 1))
done <<< "$FIELDS"

echo ""
if [ -n "$LABELS" ]; then
  echo "   Labels encontradas:"
  echo "$LABELS" | while read -r label; do
    echo -e "   · $label"
  done
  echo ""
fi

# ══════════════════════════════════════════════════════════════
# STEP 3: Mapear campos → Lead
# ══════════════════════════════════════════════════════════════

echo -e "${YELLOW}[3/5]${NC} Mapeamento de campos para o Gestor Nexus"
echo ""
echo "   Para cada campo do lead, informe o ID/name do campo HTML."
echo -e "   Pressione ${BOLD}Enter${NC} para pular (campo não disponível na LP)."
echo ""

# Campos do Lead com descrição
declare -A LEAD_FIELDS
LEAD_FIELDS=(
  [nome]="Nome do contato"
  [whatsapp]="WhatsApp / Telefone"
  [email]="Email (se não tiver, será gerado automaticamente)"
  [clinica]="Nome da empresa/clínica"
  [cidade]="Cidade / UF"
)

# Campos opcionais extras
declare -A LEAD_EXTRAS
LEAD_EXTRAS=(
  [desafio]="Principal desafio"
  [atendimentos]="Volume de atendimentos/mês"
)

declare -A MAPPING

# Tentar auto-mapear por nomes comuns
auto_map() {
  local lead_field="$1"
  for f in "${FIELD_ARRAY[@]}"; do
    case "$lead_field" in
      nome)
        [[ "$f" =~ ^(nome|name|fullname|full_name|nome_completo)$ ]] && echo "$f" && return ;;
      whatsapp)
        [[ "$f" =~ ^(wapp|whatsapp|phone|telefone|tel|celular)$ ]] && echo "$f" && return ;;
      email)
        [[ "$f" =~ ^(email|e-mail|mail)$ ]] && echo "$f" && return ;;
      clinica)
        [[ "$f" =~ ^(clinica|empresa|company|clinic|companyName|nome_empresa)$ ]] && echo "$f" && return ;;
      cidade)
        [[ "$f" =~ ^(cidade|city|uf|estado|location|cidade_uf)$ ]] && echo "$f" && return ;;
      desafio)
        [[ "$f" =~ ^(desafio|challenge|problema|dor|pain)$ ]] && echo "$f" && return ;;
      atendimentos)
        [[ "$f" =~ ^(atend|atendimentos|volume|quantidade)$ ]] && echo "$f" && return ;;
    esac
  done
  echo ""
}

echo -e "   ${BOLD}Campos obrigatórios:${NC}"
for field in nome whatsapp email clinica cidade; do
  auto=$(auto_map "$field")
  desc="${LEAD_FIELDS[$field]}"

  if [ -n "$auto" ]; then
    echo -ne "   ${desc} → detectado: ${GREEN}${auto}${NC} (Enter p/ confirmar ou digite outro): "
    read -r input
    MAPPING[$field]="${input:-$auto}"
  else
    echo -ne "   ${desc} → campo HTML: "
    read -r input
    MAPPING[$field]="$input"
  fi
done

echo ""
echo -e "   ${BOLD}Campos extras (opcionais):${NC}"
for field in desafio atendimentos; do
  auto=$(auto_map "$field")
  desc="${LEAD_EXTRAS[$field]}"

  if [ -n "$auto" ]; then
    echo -ne "   ${desc} → detectado: ${GREEN}${auto}${NC} (Enter p/ confirmar ou digite outro): "
    read -r input
    MAPPING[$field]="${input:-$auto}"
  else
    echo -ne "   ${desc} → campo HTML (Enter p/ pular): "
    read -r input
    MAPPING[$field]="$input"
  fi
done

# Validar que pelo menos nome e whatsapp foram mapeados
if [ -z "${MAPPING[nome]}" ] || [ -z "${MAPPING[whatsapp]}" ]; then
  echo -e "\n${RED}❌ 'Nome' e 'WhatsApp' são obrigatórios para criar um lead.${NC}"
  exit 1
fi

echo ""
echo -e "   ${GREEN}✓ Mapeamento configurado:${NC}"
for key in nome whatsapp email clinica cidade desafio atendimentos; do
  val="${MAPPING[$key]}"
  if [ -n "$val" ]; then
    echo -e "   · ${key} ← ${BOLD}${val}${NC}"
  fi
done

# ══════════════════════════════════════════════════════════════
# STEP 4: Selecionar form slug no Gestor
# ══════════════════════════════════════════════════════════════

echo ""
echo -e "${YELLOW}[4/5]${NC} Configuração do Gestor Nexus"
echo ""

# Verificar conectividade com a API
if ! curl -sf "${GESTOR_API}/health" > /dev/null 2>&1; then
  echo -e "${RED}⚠ Não foi possível conectar ao Gestor Nexus API${NC}"
  echo -e "   URL: ${GESTOR_API}"
  echo ""
  echo -ne "   Deseja continuar mesmo assim? O slug do form será pedido manualmente. (s/N): "
  read -r cont
  [ "$cont" != "s" ] && [ "$cont" != "S" ] && exit 1
fi

echo -ne "   Slug do formulário no Gestor (ex: one-nexus): "
read -r FORM_SLUG

if [ -z "$FORM_SLUG" ]; then
  echo -e "${RED}❌ Slug é obrigatório${NC}"
  exit 1
fi

# Verificar se o form existe
FORM_CHECK=$(curl -sf "${GESTOR_API}/forms/public/${FORM_SLUG}" 2>/dev/null)
if [ $? -eq 0 ] && echo "$FORM_CHECK" | grep -q '"slug"'; then
  FORM_NAME=$(echo "$FORM_CHECK" | grep -oP '"name"\s*:\s*"[^"]*"' | head -1 | sed 's/"name"\s*:\s*"\([^"]*\)"/\1/')
  echo -e "   ${GREEN}✓ Formulário encontrado: ${FORM_NAME}${NC}"
else
  echo -e "${YELLOW}⚠ Formulário '${FORM_SLUG}' não encontrado ou API inacessível.${NC}"
  echo -ne "   Continuar mesmo assim? (s/N): "
  read -r cont
  [ "$cont" != "s" ] && [ "$cont" != "S" ] && exit 1
fi

# ══════════════════════════════════════════════════════════════
# STEP 5: Injetar código de integração
# ══════════════════════════════════════════════════════════════

echo ""
echo -e "${YELLOW}[5/5]${NC} Injetando código de integração..."

# Backup do arquivo original
BACKUP="${HTML_FILE}.bak.$(date +%Y%m%d%H%M%S)"
cp "$HTML_FILE" "$BACKUP"
echo -e "   Backup: ${GREEN}$(basename "$BACKUP")${NC}"

# Montar o payload JS
JS_FIELDS=""
for key in nome whatsapp email clinica cidade desafio atendimentos; do
  val="${MAPPING[$key]}"
  if [ -n "$val" ]; then
    # Para campos obrigatórios, pegar o valor direto
    # Para opcionais, usar spread condicional
    if [ "$key" = "desafio" ] || [ "$key" = "atendimentos" ]; then
      JS_FIELDS="${JS_FIELDS}
      const _gn_${key}=document.getElementById('${val}')?.value||document.querySelector('[name=\"${val}\"]')?.value||'';"
    else
      JS_FIELDS="${JS_FIELDS}
      const _gn_${key}=document.getElementById('${val}')?.value?.trim()||document.querySelector('[name=\"${val}\"]')?.value?.trim()||'';"
    fi
  fi
done

# Montar o body do fetch
BODY_PARTS="nome:_gn_nome,whatsapp:_gn_whatsapp"
[ -n "${MAPPING[email]}" ] && BODY_PARTS="${BODY_PARTS},email:_gn_email"
[ -n "${MAPPING[clinica]}" ] && BODY_PARTS="${BODY_PARTS},clinica:_gn_clinica"
[ -n "${MAPPING[cidade]}" ] && BODY_PARTS="${BODY_PARTS},cidade:_gn_cidade"
[ -n "${MAPPING[desafio]}" ] && BODY_PARTS="${BODY_PARTS},...(_gn_desafio?{desafio:_gn_desafio}:{})"
[ -n "${MAPPING[atendimentos]}" ] && BODY_PARTS="${BODY_PARTS},...(_gn_atendimentos?{atendimentos:_gn_atendimentos}:{})"

# Gerar snippet em arquivo temporário (evita problemas de escape com sed)
SNIPPET_FILE=$(mktemp)
cat > "$SNIPPET_FILE" <<JSEOF
<!-- ═══ Gestor Nexus — Pipeline Connector ═══ -->
<script>
(function(){
  var _gnReady=false;
  function _gnConnect(form){
    if(_gnReady)return;
    form.addEventListener('submit',function(){
      setTimeout(function(){${JS_FIELDS}
        if(!_gn_nome||!_gn_whatsapp)return;
        fetch('${GESTOR_API}/forms/public/${FORM_SLUG}/lp-submit',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({${BODY_PARTS}})
        }).catch(function(){});
      },50);
    });
    _gnReady=true;
  }
  var f=document.getElementById('${FORM_ID}');
  if(f){_gnConnect(f);}
  else{document.addEventListener('DOMContentLoaded',function(){
    var f=document.querySelector('form');
    if(f)_gnConnect(f);
  });}
})();
</script>
<!-- ═══ /Gestor Nexus ═══ -->
JSEOF

# Verificar se já tem integração Gestor Nexus
if grep -q "Gestor Nexus.*Pipeline Connector" "$HTML_FILE"; then
  echo -e "${YELLOW}⚠ Integração já detectada. Substituindo...${NC}"
  sed -i '/<!-- ═══ Gestor Nexus — Pipeline Connector ═══ -->/,/<!-- ═══ \/Gestor Nexus ═══ -->/d' "$HTML_FILE"
fi

# Injetar antes do </body> usando python (robusto com qualquer conteúdo)
if grep -q '</body>' "$HTML_FILE"; then
  python3 -c "
import sys
snippet = open('${SNIPPET_FILE}').read()
html = open('${HTML_FILE}').read()
html = html.replace('</body>', snippet + '</body>', 1)
open('${HTML_FILE}', 'w').write(html)
"
  echo -e "   ${GREEN}✓ Código injetado antes de </body>${NC}"
else
  cat "$SNIPPET_FILE" >> "$HTML_FILE"
  echo -e "   ${GREEN}✓ Código adicionado ao final do arquivo${NC}"
fi

rm -f "$SNIPPET_FILE"

# ══════════════════════════════════════════════════════════════
# RESULTADO
# ══════════════════════════════════════════════════════════════

echo ""
echo -e "${BOLD}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Landing Page conectada ao Gestor Nexus!${NC}"
echo -e "${BOLD}════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "   Arquivo:  ${BOLD}$(basename "$HTML_FILE")${NC}"
echo -e "   Backup:   $(basename "$BACKUP")"
echo -e "   Form:     ${FORM_SLUG}"
echo -e "   Endpoint: ${GESTOR_API}/forms/public/${FORM_SLUG}/lp-submit"
echo ""
echo -e "${YELLOW}📋 Próximos passos:${NC}"
echo ""
echo "   1. Rebuild e deploy da LP:"
echo -e "      ${BOLD}docker build --no-cache -t <image>:latest . && docker service update --force <service>${NC}"
echo ""
echo "   2. Verificar CORS no Gestor Nexus (docker-compose.yml):"
echo -e "      Adicione o domínio da LP em:"
echo "      · traefik accesscontrolalloworiginlist"
echo "      · CORS_ORIGINS env var"
echo ""
echo "   3. Testar: preencha o form na LP e verifique o pipeline no Gestor."
echo ""
echo -e "   ${BOLD}Para reverter:${NC} cp $(basename "$BACKUP") $(basename "$HTML_FILE")"
echo ""
