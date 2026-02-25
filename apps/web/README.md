# 🎨 Gestor Nexus - Frontend

Frontend do sistema Gestor Nexus construído com React 18, TypeScript e Vite.

---

## 🚀 Stack Tecnológico

- **React 18.3** - UI Framework
- **TypeScript 5.7** - Tipagem estática
- **Vite 6.0** - Build tool (Fast Refresh com SWC)
- **Tailwind CSS 3.4** - Estilização utility-first
- **Zustand 5.0** - Estado global
- **TanStack Query 5.62** - Server state management
- **React Router 7.1** - Roteamento
- **Clerk React 5.19** - Autenticação
- **Axios 1.7** - HTTP client

---

## 📦 Instalação

```bash
# Instalar dependências (no diretório raiz do monorepo)
pnpm install

# OU apenas para este workspace
cd apps/web
pnpm install
```

---

## 🛠️ Desenvolvimento

```bash
# Iniciar dev server (na raiz do monorepo)
pnpm dev:web

# Ou diretamente neste diretório
cd apps/web
pnpm dev
```

O servidor de desenvolvimento estará disponível em:
- **URL**: http://localhost:3000
- **Proxy API**: `/api` → http://localhost:4000

---

## 🏗️ Build

```bash
# Build de produção
pnpm build

# Preview do build
pnpm preview

# Type check
pnpm typecheck

# Lint
pnpm lint
```

---

## 📁 Estrutura de Diretórios

```
apps/web/
├── src/
│   ├── components/          # Componentes reutilizáveis
│   │   └── layout/          # Layout components (AppLayout, Sidebar, Header)
│   ├── features/            # Módulos por feature
│   │   └── dashboard/       # Dashboard feature
│   ├── hooks/               # Custom React hooks
│   │   └── useApi.ts        # API hooks com React Query
│   ├── services/            # Serviços externos
│   │   └── api.ts           # Axios client configurado
│   ├── stores/              # Zustand stores
│   │   ├── useAuthStore.ts  # Estado de autenticação
│   │   └── useUIStore.ts    # Estado da UI (sidebar, theme)
│   ├── types/               # TypeScript types/interfaces
│   │   └── index.ts         # Types globais (User, Client, Lead, etc)
│   ├── utils/               # Utilitários
│   │   ├── cn.ts            # ClassNames helper (clsx + tailwind-merge)
│   │   └── formatters.ts    # Formatadores (CPF, CNPJ, moeda, etc)
│   ├── styles/              # CSS global
│   │   └── index.css        # Tailwind + customizações
│   ├── App.tsx              # Rotas principais
│   ├── main.tsx             # Entry point
│   └── vite-env.d.ts        # Vite types
├── public/                  # Assets estáticos
├── .env.example             # Template de variáveis de ambiente
├── index.html               # HTML base
├── vite.config.ts           # Configuração Vite
├── tailwind.config.js       # Configuração Tailwind
├── postcss.config.js        # Configuração PostCSS
├── tsconfig.json            # TypeScript config
├── tsconfig.node.json       # TypeScript config para Vite
├── eslint.config.js         # ESLint config
└── package.json
```

---

## ⚙️ Configuração

### Variáveis de Ambiente

Crie um arquivo `.env` na raiz de `apps/web`:

```env
# API Backend
VITE_API_URL=http://localhost:4000

# Clerk Authentication
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Application
VITE_APP_NAME=Gestor Nexus
VITE_APP_VERSION=0.1.0
```

### Path Aliases

Os seguintes aliases estão configurados:

```typescript
import { Component } from '@/components/Component'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/useAuthStore'
import { User } from '@/types'
import { cn } from '@/utils/cn'
```

---

## 🎨 Estilização

### Tailwind CSS

O projeto usa Tailwind CSS com tema customizado:

```javascript
// tailwind.config.js
colors: {
  primary: { /* 50-950 */ },
  secondary: { /* 50-950 */ },
}
```

### Componentes Estilizados

Use o helper `cn()` para merge de classes:

```tsx
import { cn } from '@/utils/cn';

<div className={cn(
  'base-classes',
  condition && 'conditional-class',
  className
)} />
```

---

## 🗂️ Estado Global (Zustand)

### Auth Store

```tsx
import { useAuthStore } from '@/stores/useAuthStore';

const { user, setUser, clearUser } = useAuthStore();
```

### UI Store

```tsx
import { useUIStore } from '@/stores/useUIStore';

const { sidebarCollapsed, toggleSidebar, theme, toggleTheme } = useUIStore();
```

---

## 🌐 Server State (TanStack Query)

### Uso com Hooks Customizados

```tsx
import { useApiQuery, useApiMutation } from '@/hooks/useApi';

// Query
const { data, isLoading } = useApiQuery(['users'], '/users');

// Mutation
const mutation = useApiMutation('/users', { method: 'POST' });
mutation.mutate({ name: 'John' });
```

---

## 🔐 Autenticação (Clerk)

### Proteção de Rotas

```tsx
import { SignedIn, SignedOut } from '@clerk/clerk-react';

<SignedIn>
  {/* Conteúdo autenticado */}
</SignedIn>

<SignedOut>
  {/* Tela de login */}
</SignedOut>
```

### User Button

```tsx
import { UserButton } from '@clerk/clerk-react';

<UserButton />
```

---

## 🧪 Testes

```bash
# Rodar testes (ainda não implementado)
pnpm test

# Cobertura
pnpm test:coverage
```

---

## 📝 Convenções

### Componentes

- Use PascalCase: `MyComponent.tsx`
- Exporte como named export: `export function MyComponent() {}`
- Use arrow functions apenas para componentes anônimos
- Prefira função nomeada para componentes principais

### Hooks

- Prefixo `use`: `useMyHook.ts`
- Sempre retorne objeto ou array (nunca valores soltos)

### Types

- Interfaces para objetos: `interface User {}`
- Types para unions/aliases: `type Status = 'active' | 'inactive'`
- Enums para constantes conhecidas: `enum UserRole {}`

### Arquivos

- Use kebab-case para nomes de arquivo: `my-component.tsx`
- Index files para barrel exports: `index.ts`

---

## 🐛 Troubleshooting

### Erro de CORS

Verifique se o backend está rodando e configurado para aceitar requisições de `http://localhost:3000`.

### Clerk não carrega

Verifique se `VITE_CLERK_PUBLISHABLE_KEY` está corretamente configurada no `.env`.

### Path aliases não funcionam

Execute `pnpm typecheck` para verificar se o TypeScript está reconhecendo os aliases.

### Vite não atualiza mudanças

Tente limpar o cache: `rm -rf node_modules/.vite`

---

## 📚 Documentação Adicional

- [React Docs](https://react.dev/)
- [Vite Docs](https://vitejs.dev/)
- [TanStack Query](https://tanstack.com/query/latest)
- [Zustand](https://docs.pmnd.rs/zustand/getting-started/introduction)
- [Clerk React](https://clerk.com/docs/references/react/overview)
- [Tailwind CSS](https://tailwindcss.com/docs)

---

**Mantido por**: Nexus Atemporal
**Última atualização**: Janeiro 2026
