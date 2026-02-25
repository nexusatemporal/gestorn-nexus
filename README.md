# 🚀 Gestor Nexus

<div align="center">

![Gestor Nexus Logo](https://via.placeholder.com/200x80/FF7300/FFFFFF?text=Gestor+Nexus)

**Sistema Interno de Gestão Comercial e Financeira**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10+-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5+-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Docker](https://img.shields.io/badge/Docker-Swarm-2496ED?logo=docker&logoColor=white)](https://docs.docker.com/engine/swarm/)

[Documentação](#-documentação) •
[Instalação](#-instalação) •
[Desenvolvimento](#-desenvolvimento) •
[Deploy](#-deploy) •
[Contribuição](#-contribuição)

</div>

---

## 📋 Visão Geral

O **Gestor Nexus** é o sistema interno de gestão comercial e financeira da **Nexus Atemporal**. Ele centraliza a administração de clientes, leads, pagamentos, chat e analytics de IA para dois produtos SaaS:

| Produto | Descrição | Público-Alvo |
|---------|-----------|--------------|
| **One Nexus** | CRM/ERP completo para clínicas de estética | Clínicas premium |
| **Locadoras** | Sistema de gestão de locação de equipamentos | Empresas de locação |

### 🎯 Principais Funcionalidades

```
📊 Dashboard         → Métricas em tempo real, MRR/ARR, insights IA
👥 Clientes          → Gestão completa, fichas detalhadas, impersonate
🎯 Leads             → Funil Kanban, lead scoring IA, conversão
💰 Financeiro        → Pagamentos, inadimplência, aging report
💬 Chat              → Integração Chatwoot (WhatsApp/Instagram/Web)
📅 Calendário        → Agenda, sync Google Calendar
🤖 Nexus Sales AI    → Copiloto de vendas com IA (Gemini/Groq)
⚙️ Configurações     → RBAC granular, integrações, auditoria
```

### 📈 Status do Desenvolvimento

---

## ⚠️ CRITICAL BUG ALERT

### 🚨 VENCIMENTO Field Off by 1 Day (UNRESOLVED)

**Status**: 🔴 **CRITICAL** - Multiple fix attempts failed (v2.39.3, v2.39.4, v2.39.5)

**Problem**: When converting lead to client, the VENCIMENTO (next payment due date) displays 1 day earlier than expected across ALL billing cycles.

**Example**:
- Input: firstPaymentDate = 10/02/2026 (MONTHLY plan)
- Expected: VENCIMENTO = 10/03/2026
- Actual: VENCIMENTO = 09/03/2026 ❌

**Impact**: Affects 100% of client conversions, causes incorrect billing dates

**For complete technical details**, see:
- `CLAUDE.md` → "Known Critical Issues" section
- `CHANGELOG.md` → v2.39.3, v2.39.4, v2.39.5 entries

**Files Involved**:
- `/apps/api/src/modules/leads/leads.service.ts` (payment creation)
- `/apps/api/src/modules/clients/clients.service.ts` (VENCIMENTO calculation)

---

#### ✅ Backend Core (Janeiro 2026)
| Módulo | Status | Endpoints | Features |
|--------|--------|-----------|----------|
| **Health** | ✅ Completo | 1 | Health checks, readiness probe |
| **Plans** | ✅ Completo | 3 | CRUD planos, filtro por produto |
| **Users** | ✅ Completo | 10 | CRUD usuários, soft delete, hierarquia |
| **Leads** | ✅ Completo | 5 | Funil vendas, conversão tracking |
| **Clients** | ✅ Completo | 7 | Gestão clientes, conversão de lead |
| **Payments** | ✅ Completo | 7 | Financeiro, stats, validação status |
| **Tenants** | ✅ Completo | 11 | Multi-tenancy, métricas, status management |
| **Webhooks** | ✅ Completo | 3 | Clerk, Asaas, AbacatePay, idempotência |
| **Dashboard** | ✅ Completo | 1 | KPIs, gráficos, métricas agregadas |
| **Calendar** | ✅ Completo | 8 | Eventos recorrentes, Google Calendar sync |

**Total**: 57 endpoints REST implementados

**Build Status**:
- ✅ **API Build**: 0 erros TypeScript (corrigidos 102 erros em 16/01/2026)
- ✅ **Web Build**: 0 erros TypeScript
- ✅ **Docker Images**: Buildadas e prontas para deploy

#### ✅ Frontend Base (Janeiro 2026)
| Módulo | Status | Features |
|--------|--------|----------|
| **Setup** | ✅ Completo | Vite + React 18 + TypeScript |
| **Autenticação** | ✅ Completo | Clerk SDK, pt-BR, UserButton |
| **Layout** | ✅ Completo | AppLayout, Sidebar, Header |
| **Estado** | ✅ Completo | Zustand (global), TanStack Query (server) |
| **Roteamento** | ✅ Completo | React Router, rotas protegidas |
| **Estilização** | ✅ Completo | Tailwind CSS, tema customizado |
| **Dashboard** | ✅ Completo | KPIs, gráficos Recharts, métricas reais |
| **Clientes** | ⏳ Básico | Lista e formulário (sem detalhes) |
| **Leads** | ✅ Completo | Kanban drag-and-drop, estágios customizados, conversão |
| **Financeiro** | ⏳ Básico | Dashboard de pagamentos |
| **Calendar** | ✅ Completo | 4 views, recorrência, Google sync |

**Progresso Frontend**: 35% completo

**Próximo**: Completar módulos de Clientes, Leads e Financeiro

#### 🎯 Features Implementadas
- ✅ **RBAC completo** - 5 roles com scoping automático
- ✅ **Validação Zod** - Todos os DTOs validados
- ✅ **Soft Delete** - Dados críticos preservados
- ✅ **Transações Prisma** - Operações atômicas (conversão lead → cliente)
- ✅ **Status Transitions** - Validação de fluxos (payments)
- ✅ **Audit Logging** - Logger com emojis indicativos
- ✅ **Retry Logic** - Resiliência em operações críticas
- ✅ **CPF/CNPJ Validation** - Com auto-cleanup de formatação
- ✅ **Hierarchical Access** - GESTOR → VENDEDOR relationships
- ✅ **Statistics Aggregation** - Dashboards financeiros
- ✅ **Webhooks Integration** - Clerk, Asaas, AbacatePay com idempotência
- ✅ **Signature Validation** - SVIX, access token, HMAC SHA256
- ✅ **User Sync** - Sincronização automática Clerk → Database
- ✅ **Calendar Module** - Eventos recorrentes (RRULE), 4 visualizações
- ✅ **Google Calendar Sync** - OAuth2, sincronização bidirecional
- ✅ **Docker Stack** - Infraestrutura completa para deploy

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GESTOR NEXUS                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │   Frontend      │    │   Backend       │    │   Database      │         │
│  │   (React)       │───▶│   (NestJS)      │───▶│   (PostgreSQL)  │         │
│  │                 │    │                 │    │                 │         │
│  │  • Vite         │    │  • REST API     │    │  • Prisma ORM   │         │
│  │  • TypeScript   │    │  • Clerk Auth   │    │  • Migrations   │         │
│  │  • Tailwind     │    │  • Zod Valid.   │    │  • Soft Delete  │         │
│  │  • Zustand      │    │  • RBAC         │    │  • Audit Log    │         │
│  │  • React Query  │    │  • Webhooks     │    │                 │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│           │                      │                      │                   │
│           └──────────────────────┼──────────────────────┘                   │
│                                  │                                          │
│  ┌───────────────────────────────┴───────────────────────────────┐         │
│  │                      INTEGRAÇÕES EXTERNAS                      │         │
│  ├───────────────────┬───────────────────┬───────────────────────┤         │
│  │   Clerk Auth      │   Pagamentos      │   Inteligência IA     │         │
│  │   • SSO/MFA       │   • AbacatePay    │   • Groq Analytics    │         │
│  │   • RBAC          │   • Asaas         │   • Gemini Sales AI   │         │
│  │   • Webhooks      │   • Webhooks      │   • OpenRouter        │         │
│  └───────────────────┴───────────────────┴───────────────────────┘         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Stack Tecnológico

### Backend
| Tecnologia | Versão | Uso | Status |
|------------|--------|-----|--------|
| Node.js | 20+ | Runtime | ✅ |
| NestJS | 10+ | Framework API | ✅ |
| TypeScript | 5+ | Tipagem | ✅ |
| Prisma | 5+ | ORM | ✅ |
| PostgreSQL | 16+ | Banco de dados | ✅ |
| Zod | 3+ | Validação | ✅ |
| Clerk | Latest | Autenticação | ✅ |

### Frontend
| Tecnologia | Versão | Uso | Status |
|------------|--------|-----|--------|
| React | 18+ | UI Framework | ✅ |
| Vite | 6+ | Build tool | ✅ |
| TypeScript | 5+ | Tipagem | ✅ |
| Tailwind CSS | 3+ | Estilização | ✅ |
| Zustand | 5+ | Estado global | ✅ |
| TanStack Query | 5+ | Server state | ✅ |
| React Router | 7+ | Roteamento | ✅ |
| Clerk React | 5+ | Autenticação | ✅ |
| Axios | 1+ | HTTP client | ✅ |
| React Hook Form | 7+ | Formulários | ⏳ |

### Infraestrutura
| Tecnologia | Uso |
|------------|-----|
| Docker Swarm | Orquestração |
| Traefik | Proxy reverso / SSL |
| Hostinger VPS | Hospedagem |
| GitHub Actions | CI/CD |

---

## 📦 Instalação

### Pré-requisitos

```bash
# Node.js 20+
node --version  # v20.x.x

# pnpm 8+
pnpm --version  # 8.x.x

# Docker (para produção)
docker --version  # 24.x.x

# PostgreSQL 16+ (ou via Docker)
psql --version  # 16.x
```

### Setup Local

```bash
# 1. Clonar repositório
git clone https://github.com/nexus-atemporal/gestor-nexus.git
cd gestor-nexus

# 2. Instalar dependências
pnpm install

# 3. Configurar variáveis de ambiente
cp .env.example .env.local
# Editar .env.local com suas credenciais

# 4. Subir banco de dados (Docker)
docker compose up -d postgres

# 5. Rodar migrations
pnpm db:migrate

# 6. Seed inicial (dados de exemplo)
pnpm db:seed

# 7. Iniciar desenvolvimento
pnpm dev
```

### Variáveis de Ambiente

```env
# Banco de Dados
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/gestor_nexus"

# Clerk (Autenticação)
CLERK_SECRET_KEY="sk_test_..."
CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_WEBHOOK_SECRET="whsec_..."

# Pagamentos (Produção)
ABACATEPAY_API_KEY=""
ABACATEPAY_WEBHOOK_SECRET=""
ASAAS_API_KEY=""
ASAAS_WEBHOOK_TOKEN=""

# IA (Produção)
GROQ_API_KEY=""
GEMINI_API_KEY=""
OPENROUTER_API_KEY=""

# SMTP (Zoho)
SMTP_HOST="smtp.zoho.com"
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""

# App
NODE_ENV="development"
API_URL="http://localhost:3000"
WEB_URL="http://localhost:5173"
```

> ⚠️ **IMPORTANTE**: As credenciais de produção (VPS, IAs, Pagamentos) devem ser solicitadas ao responsável no momento de configuração do ambiente.

---

## 💻 Desenvolvimento

### Comandos Principais

```bash
# Desenvolvimento
pnpm dev              # Inicia API + Frontend
pnpm dev:api          # Apenas API (porta 3000)
pnpm dev:web          # Apenas Frontend (porta 5173)

# Banco de Dados
pnpm db:migrate       # Aplicar migrations
pnpm db:seed          # Popular com dados iniciais
pnpm db:studio        # Abrir Prisma Studio
pnpm db:reset         # Reset completo (⚠️ APENAS DEV)

# Qualidade
pnpm lint             # ESLint
pnpm lint:fix         # Corrigir lint automaticamente
pnpm typecheck        # TypeScript check
pnpm format           # Prettier

# Testes
pnpm test             # Testes unitários
pnpm test:watch       # Watch mode
pnpm test:cov         # Coverage
pnpm test:e2e         # Testes E2E

# Build
pnpm build            # Build completo
pnpm build:api        # Build apenas API
pnpm build:web        # Build apenas Frontend
```

### Estrutura de Commits

```bash
feat(module): add new feature
fix(module): fix bug description
refactor(module): refactor code
docs(module): update documentation
test(module): add tests
chore(module): maintenance task
```

### Fluxo de Branches

```
main           → Produção (protegida)
├── develop    → Desenvolvimento
    ├── feat/xxx    → Nova feature
    ├── fix/xxx     → Correção de bug
    └── hotfix/xxx  → Correção urgente
```

---

## 🚀 Deploy

### Docker Swarm via Portainer (Produção - Recomendado)

**Imagens prontas para deploy:**
- ✅ `gestor-nexus-api:latest`
- ✅ `gestor-nexus-web:latest`

**Guia completo de deploy**: Consulte [DEPLOY_PORTAINER.md](./DEPLOY_PORTAINER.md)

**Resumo do processo:**

1. **Acesse o Portainer** → Stacks → Add stack
2. **Nome da stack**: `gestor-nexus`
3. **Cole o docker-compose.yml** do arquivo raiz
4. **Configure variáveis de ambiente OBRIGATÓRIAS:**
   ```bash
   DATABASE_URL=postgresql://gestor:SENHA@postgres:5432/gestor_nexus
   POSTGRES_PASSWORD=SENHA_SEGURA
   CLERK_SECRET_KEY=sk_live_XXXXXXXXXX_REDACTED
   CLERK_PUBLISHABLE_KEY=pk_live_XXXXXXXXXX_REDACTED
   CLERK_WEBHOOK_SECRET=whsec_xxxxx
   ```
5. **Deploy the stack**
6. **Verifique os serviços** (API, Web, Postgres, Redis)

### Deploy Manual via CLI (Alternativa)

```bash
# 1. Build (SEMPRE com --no-cache)
docker compose build --no-cache api web

# 2. Deploy stack
docker stack deploy -c docker-compose.yml gestor-nexus

# 3. Verificar containers (CRÍTICO!)
docker ps --format "table {{.Names}}\t{{.CreatedAt}}\t{{.Status}}"
# ⚠️ A data DEVE ser recente! Se antiga, o deploy não foi aplicado!

# 4. Forçar update se necessário
docker service update --force gestor-nexus_api
docker service update --force gestor-nexus_web

# 5. Verificar logs
docker service logs gestor-nexus_api --tail 100 -f

# 6. Health check
curl -s https://apigestor.nexusatemporal.com/api/v1/health | jq
```

### Domínios de Produção

- **Frontend**: https://gestornx.nexusatemporal.com
- **API**: https://apigestor.nexusatemporal.com

### Checklist de Deploy

- [ ] Testes passando (`pnpm test`)
- [ ] Lint limpo (`pnpm lint`)
- [ ] TypeCheck ok (`pnpm typecheck`)
- [ ] Build bem-sucedido (`pnpm build`)
- [ ] Migrations aplicadas
- [ ] CHANGELOG atualizado
- [ ] Build Docker com `--no-cache`
- [ ] Data do container verificada
- [ ] Logs sem erros
- [ ] Health check respondendo

---

## ⚠️ Known Issues (v2.33.1)

### 🐛 Problemas no Módulo de Leads

**Status Atual**: ✅ **CNPJ validation UX melhorada na v2.33.1** | ✅ **CNPJ duplicate check corrigido na v2.33.0** | ✅ **Drag-and-drop corrigido na v2.23.0** | ⚠️ **1 issue de UX pendente**

#### ✅ ~~Issue #0: 400 Bad Request ao Criar Lead~~ (RESOLVIDO em v2.15.3)
- ~~**Sintoma**: Criação de lead retornava erro "Validation failed" com 400 status code~~
- ~~**Causa**: `vendedorId` e `interestPlanId` eram obrigatórios mas frontend enviava nomes de display~~
- ✅ **CORRIGIDO**: Campos tornados opcionais, backend auto-atribui vendedor
- ✅ **RESULTADO**: Criação de leads funcionando normalmente
- 📄 **Commit**: v2.15.3 - "enhance(leads): mandatory fields + ClientRole enum"

#### ✅ ~~Issue #1: PATCH /leads/:id Retornando 500 Error~~ (RESOLVIDO em v2.15.2)
- ~~**Sintoma**: Drag-and-drop, edição de leads e mudança de stage retornavam 500 error~~
- ~~**Causa**: Campo `origin` no DTO sendo enviado para Prisma (campo não existe no schema)~~
- ~~**Causa #2**: UUID validation falhando em strings vazias~~
- ✅ **CORRIGIDO**: Removido campo `origin` antes do update + preprocessing de strings vazias
- ✅ **RESULTADO**: Drag-and-drop, edição e mudança de stage funcionando corretamente
- 📄 **Commit**: `3fcad6f` - "fix(leads): fix 500 error on PATCH"

#### ✅ ~~Issue #2: Drag-and-Drop de Leads (Case Sensitivity)~~ (RESOLVIDO em v2.23.0)
- ~~**Sintoma**: Lead não move entre colunas do Kanban (sem erros no console)~~
- ~~**Causa**: Frontend usava mapeamento hardcodado `mapApiStatusToStage()` ao invés de dados do backend~~
- ~~**Causa Raiz**: 4 bugs interconectados (hardcoded mapping, missing stage relation, interface sem stageId, localStorage desconectado)~~
- ✅ **CORRIGIDO**: Removido mapeamento hardcodado, agora usa `apiLead.stage?.name` do backend
- ✅ **RESULTADO**: Drag-and-drop funciona corretamente, estágios customizados visíveis
- 📄 **Commit**: `e933b37` - "fix(leads): integrate stage relation from backend (v2.23.0)"
- 📄 **Detalhes**: [CHANGELOG.md v2.23.0](./CHANGELOG.md#2230---2026-01-30---drag-and-drop-integration-fix-stage-relation-)

#### ✅ ~~Issue #3: CNPJ Validation Não Funcionando~~ (RESOLVIDO em v2.33.0)
- ~~**Sintoma**: Usuário criava múltiplos leads com mesmo CNPJ, sem aviso ou bloqueio~~
- ~~**Causa #1**: URL encoding (slashes em CNPJ causavam 404)~~
- ~~**Causa #2**: Backend usava Prisma `contains` que não comparava números (formatação diferente)~~
- ✅ **CORRIGIDO**: Backend usa SQL `REGEXP_REPLACE` para remover formatação antes de comparar
- ✅ **RESULTADO**: Validação de CNPJ duplicado funciona corretamente (leads e clientes)
- 📄 **Commit**: v2.33.0 - "fix(leads): fix CNPJ duplicate validation using SQL regex"

#### ✅ ~~Issue #4: Alertas Duplicados na Validação de CNPJ~~ (RESOLVIDO em v2.33.1)
- ~~**Sintoma**: Dois alertas apareciam simultaneamente ("CNPJ já cadastrado!" + "⚠️ CNPJ já cadastrado no sistema")~~
- ~~**Causa**: Alerta visual no onBlur + mensagem de erro no submit + console spam~~
- ✅ **CORRIGIDO**: Removido alerta visual, validação silenciosa, mensagem única no submit
- ✅ **RESULTADO**: UX limpa e profissional, mensagem única "⚠️ CNPJ já cadastrado no sistema"
- 📄 **Commit**: v2.33.1 - "fix(leads): improve CNPJ validation UX - remove duplicate alert and debug logs"

#### Issue #5: "Configurar Pipeline" Não Salva no Banco
- **Sintoma**: Mudanças no pipeline são perdidas após refresh
- **Causa**: Frontend salva apenas em localStorage, nunca chama API
- **Impacto**: Configurações não sincronizam entre usuários/dispositivos
- **Backend**: API `/funnel-stages` completa mas não utilizada
- **Solução**: Criar `funnelStagesApi` client e hooks React Query

📄 **Detalhes completos**:
- [CHANGELOG.md v2.33.1](./CHANGELOG.md#2331---2026-02-03---leads-module-cnpj-validation-ux-improvements-) (CNPJ UX improvements)
- [CHANGELOG.md v2.23.0](./CHANGELOG.md#2230---2026-01-30---drag-and-drop-integration-fix-stage-relation-) (Drag-and-drop fix)
- [CHANGELOG.md v2.15.3](./CHANGELOG.md#v2153-2026-01-29---leads-module-form-validation-enhancements-) (Validação de formulário)
- [CHANGELOG.md v2.15.2](./CHANGELOG.md#v2152-2026-01-29---leads-module-patch-500-error-fix-) (Correção do erro 500)
- [CLAUDE.md - Common Issues](./CLAUDE.md#issue-cnpj-validation-showing-duplicate-alerts-fixed-in-v2331) (Documentação técnica completa)

---

## 📚 Documentação

| Documento | Descrição | Status |
|-----------|-----------|--------|
| [CLAUDE.md](./Docs_GM_NEXUS/CLAUDE.md) | Instruções para Claude Code | ✅ |
| [CHANGELOG.md](./CHANGELOG.md) | Histórico de mudanças | ✅ 16/01/2026 |
| [DEPLOY_PORTAINER.md](./DEPLOY_PORTAINER.md) | **🚀 Guia Deploy via Portainer** | ✅ Novo |
| [README.md](./Docs_GM_NEXUS/README.md) | Documentação do projeto | ✅ |
| [ARCHITECTURE.md](./Docs_GM_NEXUS/ARCHITECTURE.md) | Arquitetura detalhada | ✅ |
| [DATABASE.md](./Docs_GM_NEXUS/DATABASE.md) | Schema e modelos Prisma | ✅ |
| [API.md](./Docs_GM_NEXUS/API.md) | Endpoints REST | ✅ |
| [GUIA_DE_DEPLOY.md](./Docs_GM_NEXUS/GUIA_DE_DEPLOY.md) | Deploy Docker Swarm | ✅ |

### 📁 Estrutura dos Módulos Implementados

```
apps/api/src/modules/
├── health/
│   ├── health.controller.ts
│   ├── health.module.ts
│   └── health.service.ts
│
├── plans/
│   ├── dto/
│   │   ├── create-plan.dto.ts
│   │   └── update-plan.dto.ts
│   ├── plans.controller.ts
│   ├── plans.module.ts
│   └── plans.service.ts
│
├── users/
│   ├── dto/
│   │   ├── create-user.dto.ts
│   │   └── update-user.dto.ts
│   ├── users.controller.ts (10 endpoints)
│   ├── users.module.ts
│   └── users.service.ts (8 métodos, RBAC completo)
│
├── leads/
│   ├── dto/
│   │   ├── create-lead.dto.ts
│   │   └── update-lead.dto.ts
│   ├── leads.controller.ts (5 endpoints)
│   ├── leads.module.ts
│   └── leads.service.ts (6 métodos, conversão tracking)
│
├── clients/
│   ├── dto/
│   │   ├── create-client.dto.ts
│   │   └── update-client.dto.ts
│   ├── clients.controller.ts (7 endpoints)
│   ├── clients.module.ts
│   └── clients.service.ts (7 métodos, transações)
│
├── payments/
│   ├── dto/
│   │   ├── create-payment.dto.ts
│   │   └── update-payment.dto.ts
│   ├── payments.controller.ts (7 endpoints)
│   ├── payments.module.ts
│   └── payments.service.ts (9 métodos, stats)
│
├── tenants/
│   ├── dto/
│   │   ├── create-tenant.dto.ts
│   │   └── update-tenant.dto.ts
│   ├── tenants.controller.ts (11 endpoints)
│   ├── tenants.module.ts
│   └── tenants.service.ts (10 métodos, métricas)
│
└── webhooks/
    ├── dto/
    │   ├── clerk-webhook.dto.ts
    │   ├── asaas-webhook.dto.ts
    │   └── abacatepay-webhook.dto.ts
    ├── services/
    │   ├── idempotency.service.ts
    │   ├── clerk-webhook.service.ts
    │   ├── asaas-webhook.service.ts
    │   └── abacatepay-webhook.service.ts
    ├── webhooks.controller.ts (3 endpoints públicos)
    └── webhooks.module.ts
```

### Docker / Infraestrutura

| Arquivo | Descrição |
|---------|-----------|
| [docker/docker-compose.yml](./docker/docker-compose.yml) | Stack para Portainer |
| [docker/Dockerfile.api](./docker/Dockerfile.api) | Build do backend |
| [docker/Dockerfile.web](./docker/Dockerfile.web) | Build do frontend |
| [docker/nginx.conf](./docker/nginx.conf) | Config do NGINX |

### Agentes de IA

| Agente | Arquivo | Uso |
|--------|---------|-----|
| Arquitetura | [agents/architecture-planning.md](./agents/architecture-planning.md) | Design de sistema |
| Backend | [agents/backend-development.md](./agents/backend-development.md) | APIs |
| Frontend | [agents/frontend-development.md](./agents/frontend-development.md) | UI |
| Database | [agents/database-development.md](./agents/database-development.md) | Schema |
| Segurança | [agents/security-check.md](./agents/security-check.md) | Code review |
| QA | [agents/qa-testing.md](./agents/qa-testing.md) | Testes |

---

## 🎯 Próximos Passos

### Frontend (Não Iniciado)
3. **Configuração Base**
   - [ ] Setup Vite + React + TypeScript
   - [ ] Configuração Tailwind CSS
   - [ ] Setup Zustand para estado global
   - [ ] Configuração React Query
   - [ ] Integração Clerk (frontend)

4. **Módulos de Interface**
   - [ ] Dashboard (métricas, gráficos)
   - [ ] Gestão de Clientes (tabelas, formulários)
   - [x] Funil de Leads (Kanban) ✅ v2.23.0
   - [ ] Módulo Financeiro (aging report)
   - [ ] Configurações e RBAC

### Testes e Deploy
5. **Qualidade**
   - [ ] Testes unitários (Vitest)
   - [ ] Testes E2E (Playwright)
   - [ ] CI/CD GitHub Actions
   - [ ] Docker optimization

---

## 🔐 Segurança

### Autenticação
- SSO via Clerk com MFA disponível
- JWT tokens com refresh automático
- Session management seguro

### Autorização (RBAC)
| Role | Acesso |
|------|--------|
| SUPERADMIN | Acesso total |
| ADMINISTRATIVO | Financeiro + Relatórios |
| GESTOR | Time de vendas |
| VENDEDOR | Próprios leads/clientes |
| DESENVOLVEDOR | Técnico + Impersonate |

### Boas Práticas
- Validação de inputs com Zod
- Scoping por userId/tenantId
- Audit logging para ações sensíveis
- Soft delete para dados críticos
- Secrets apenas em variáveis de ambiente

---

## 🤝 Contribuição

### Como Contribuir

1. Fork o repositório
2. Crie uma branch (`git checkout -b feat/nova-feature`)
3. Faça suas alterações
4. Execute os testes (`pnpm test`)
5. Commit (`git commit -m 'feat: nova feature'`)
6. Push (`git push origin feat/nova-feature`)
7. Abra um Pull Request

### Guidelines

- Siga as convenções de código existentes
- Adicione testes para novas funcionalidades
- Atualize a documentação conforme necessário
- Mantenha commits pequenos e focados

---

## 📄 Licença

Este projeto é **proprietário** e de uso exclusivo da **Nexus Atemporal**.

---

## 👥 Equipe

| Papel | Responsável |
|-------|-------------|
| **Fundador & Lead Dev** | Magdiel Caim |
| **Empresa** | Nexus Atemporal |

---

<div align="center">

**Desenvolvido com ❤️ por [Nexus Atemporal](https://nexusatemporal.com.br)**

*Última atualização: 29 de Janeiro de 2026*

</div>
