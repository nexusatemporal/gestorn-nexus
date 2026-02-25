#!/bin/bash

# ════════════════════════════════════════════════════════════════════════════════
# 🚀 GESTOR NEXUS - Script de Deploy para Docker Swarm
# ════════════════════════════════════════════════════════════════════════════════
#
# Este script garante que todas as variáveis de ambiente sejam carregadas
# corretamente antes de fazer o deploy no Docker Swarm.
#
# USO:
#   chmod +x deploy-swarm.sh
#   ./deploy-swarm.sh
#
# ════════════════════════════════════════════════════════════════════════════════

set -e  # Aborta em caso de erro

echo "═══════════════════════════════════════════════════════════════"
echo "🚀 Gestor Nexus - Deploy para Docker Swarm"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Verifica se o arquivo .env existe
if [ ! -f ".env" ]; then
    echo "❌ Erro: Arquivo .env não encontrado!"
    exit 1
fi

echo "📦 Carregando variáveis de ambiente do .env..."

# Exporta variáveis do .env ignorando comentários e linhas vazias
while IFS= read -r line || [ -n "$line" ]; do
    # Remove espaços em branco no início e fim
    line=$(echo "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')

    # Ignora linhas vazias e comentários
    if [ -z "$line" ] || [[ "$line" =~ ^# ]]; then
        continue
    fi

    # Exporta a variável
    export "$line"

    # Mostra o nome da variável (sem o valor por segurança)
    var_name=$(echo "$line" | cut -d '=' -f 1)
    echo "  ✓ $var_name"
done < .env

echo ""
echo "✅ Todas as variáveis carregadas!"
echo ""
echo "🏗️  Fazendo deploy da stack gestor-nexus..."
echo ""

# Faz o deploy da stack
docker stack deploy -c docker-compose.yml gestor-nexus

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "✅ Deploy iniciado com sucesso!"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "📊 Para verificar o status dos serviços:"
echo "   docker service ls"
echo ""
echo "📋 Para verificar os logs:"
echo "   docker service logs gestor-nexus_api -f"
echo ""
echo "🔍 Para verificar as tasks:"
echo "   docker service ps gestor-nexus_api --no-trunc"
echo ""
