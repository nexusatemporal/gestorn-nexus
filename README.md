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

#### Backend
| Módulo | Endpoints | Features |
|--------|-----------|----------|
| **Health** | 1 | Health checks, readiness probe |
| **Auth** | 3 | Login, refresh token, change password |
| **Plans** | 3 | CRUD planos, filtro por produto |
| **Users** | 10 | CRUD usuários, soft delete, hierarquia |
| **Leads** | 5 | Funil vendas, lead scoring, conversão |
| **Clients** | 7 | Gestão clientes, billing lifecycle |
| **Finance** | 8 | MRR/ARR, inadimplência, aging report |
| **Subscriptions** | 3 | Billing lifecycle, grace period, crons |
| **Payments** | 7 | Gateways, stats, validação status |
| **Tenants** | 11 | Multi-tenancy, métricas |
| **Webhooks** | 3 | Asaas, AbacatePay, idempotência |
| **Dashboard** | 1 | KPIs, Nexus Intel (AI insights) |
| **Calendar** | 8 | Eventos recorrentes, Google Calendar sync |
| **Sales AI** | 4 | Copiloto de vendas com IA |

#### Frontend
| Módulo | Features |
|--------|----------|
| **Dashboard** | KPIs, MRR graph, Nexus Intel, auto-refresh |
| **Clientes** | Lista, filtros, billing anchor, reativação |
| **Leads** | Kanban drag-and-drop, estágios, conversão |
| **Financeiro** | Transações, inadimplência, CSV export |
| **Calendar** | 4 views, recorrência, Google sync |
| **Sales AI** | Chat, briefing, battlecard, roleplay |
| **Configurações** | Usuários, integrações |

#### Features
- RBAC com 5 roles e scoping automático
- JWT auth próprio (access + refresh tokens)
- Billing lifecycle com grace period (7 dias)
- Nexus Intel (AI insights via Groq)
- Webhooks (Asaas, AbacatePay) com idempotência
- Google Calendar sync (OAuth2)
- Soft delete, transações Prisma, validação Zod

> Para o histórico completo de versões, consulte [CHANGELOG.md](./CHANGELOG.md)

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
│  │  • TypeScript   │    │  • JWT Auth     │    │  • Migrations   │         │
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
│  │   JWT Auth        │   Pagamentos      │   Inteligência IA     │         │
│  │   • Access Token  │   • AbacatePay    │   • Groq Analytics    │         │
│  │   • Refresh Token │   • Asaas         │   • Gemini Sales AI   │         │
│  │   • RBAC          │   • Webhooks      │   • OpenRouter        │         │
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
| JWT (jsonwebtoken) | 9+ | Autenticação | ✅ |
| Bcrypt | 5+ | Hash de senhas | ✅ |

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
| AuthContext | - | Autenticação JWT | ✅ |
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

# JWT Auth
JWT_SECRET="your_jwt_secret"
JWT_REFRESH_SECRET="your_refresh_secret"

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

## 📚 Documentação

| Documento | Descrição |
|-----------|-----------|
| [CLAUDE.md](./CLAUDE.md) | Instruções para Claude Code |
| [CHANGELOG.md](./CHANGELOG.md) | Histórico completo de versões |
| [Docs_GM_NEXUS/](./Docs_GM_NEXUS/) | Documentação detalhada (arquitetura, API, DB, deploy, agents) |
| [prints/](./prints/) | Prompts de referência para módulos |

---

## 🔐 Segurança

### Autenticação
- JWT próprio com access token (1h) e refresh token (7d)
- Bcrypt para hashing de senhas
- Refresh token rotation

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

*Última atualização: 25 de Fevereiro de 2026*

</div>
