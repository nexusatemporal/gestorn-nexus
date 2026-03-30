# CHANGELOG MOBILE - Gestor Nexus

Documentacao completa da implementacao do layout mobile do Gestor Nexus.
Todas as mudancas sao exclusivas para viewport < 768px (mobile).
O layout desktop permanece 100% identico.

---

## Plano Geral

### Estrategia
- Todas as mudancas via CSS media queries (`md:` breakpoint do Tailwind) e renderizacao condicional
- Referencia de UX: WhatsApp (bottom navigation, telas limpas, dropdowns ao inves de swipe)
- Nenhuma rota de API, logica de negocio, servico, hook, contexto React, query TanStack, tipo TypeScript ou layout desktop foi modificado

### Breakpoints
| Breakpoint | Comportamento |
|-----------|---------------|
| `< 640px` (sm) | Mobile phone — layout mais compacto |
| `< 768px` (md) | Mobile/tablet — BottomNav ativo, Sidebar escondida |
| `>= 768px` | Desktop — SEM MUDANCAS |

---

## Fase 1 — Estrutura Base (19/03/2026)

### Arquivos Criados
- `apps/web/src/hooks/useIsMobile.ts` — Hook de deteccao de viewport (< 768px) via `matchMedia`
- `apps/web/src/components/layout/BottomNav.tsx` — Barra de navegacao inferior (mobile only)
  - 5 icones: Home, Leads, Clientes, Financeiro, Mais
  - Botao "Mais" abre bottom sheet com menu completo
  - Bottom sheet com: Clientes Nexloc, Calendario, Vendas IA, Formularios, Chat, Notificacoes, Configuracoes, Meu Perfil, Dark/Light toggle, Sair
  - Safe area para iPhone notch (`env(safe-area-inset-bottom)`)

### Arquivos Modificados
- `apps/web/src/components/layout/AppLayout.tsx`
  - Import BottomNav
  - Padding responsivo: `p-3 md:p-8`, `pb-20 md:pb-8` (espaco para bottom nav)
- `apps/web/src/components/layout/Sidebar.tsx`
  - `hidden md:flex` — escondida no mobile
- `apps/web/src/components/layout/Header.tsx`
  - Altura: `h-14 md:h-20`
  - Padding: `px-3 md:px-8`
  - Mobile: logo icon + notificacao bell
  - Desktop: search bar + theme toggle + user menu (sem mudanca)
  - Search bar: `hidden md:block`
  - Theme toggle: `hidden md:flex`
  - User menu: `hidden md:flex`
- `apps/web/src/styles/index.css`
  - Animacao `slide-up` para bottom sheet
- `apps/web/index.html`
  - `viewport-fit=cover` para safe areas iPhone
- `apps/web/src/components/layout/index.ts`
  - Export do BottomNav

---

## Fase 2 — Dashboard + Notificacoes (19/03/2026)

### Dashboard (`apps/web/src/features/dashboard/Dashboard.tsx`)
- Espacamento: `space-y-4 md:space-y-8`
- Header empilhado: `flex-col gap-3 md:flex-row`
- Titulo: `text-2xl md:text-3xl`, subtitulo `hidden md:block`
- Metricas: `grid-cols-2` (2 por linha no mobile)
  - Padding: `p-3 md:p-6`
  - Valor: `text-lg md:text-2xl`
  - Trend badge: `hidden md:flex`
  - SubValue: `hidden md:block`
- Insights/Distribution: padding `p-4 md:p-6`
- MRR Chart: `h-56 md:h-80`, padding `p-4 md:p-6`
- Atividades: dropdown selector (Leads/Clientes/Vencimentos) no mobile ao inves de 3 colunas
  - State `activeActivityTab` controla qual card mostrar
  - Desktop: grid 3 colunas normal

### Notificacoes (`apps/web/src/pages/Notifications/NotificationsPage.tsx`)
- Header: `px-4 py-4 md:px-8 md:py-6`, titulo `text-lg md:text-xl`
- "Marcar todas como lidas": texto `hidden md:inline` (so icone no mobile)
- Filtros: `flex-col md:flex-row`, search `w-full md:w-56`
- Type pills: `overflow-x-auto no-scrollbar`
- Itens: `px-4 py-3 md:px-8 md:py-4`
- Acoes: `md:opacity-0 md:group-hover:opacity-100` (sempre visiveis no mobile)
- Preferencias: `fixed inset-0 md:absolute md:right-0 md:top-0 md:w-80` (fullscreen no mobile)
- Paginacao: `px-4 py-3`, numeros `hidden md:flex`, texto "Pagina X de Y" no mobile

---

## Fase 3 — Clientes + Leads (19/03/2026)

### ClientsList (`apps/web/src/features/clients/components/ClientsList.tsx`)
- Header: empilhado no mobile, titulo `text-xl md:text-3xl`
- Botao "Novo Cliente": `hidden md:flex` + FAB laranja (`fixed bottom-20 right-4`)
- Search: `w-full md:max-w-sm`, "Filtros" texto `hidden md:inline`
- Tabela → Card view no mobile (`md:hidden`):
  - Card: empresa + status badge + plano + MRR
  - Tabela desktop: `hidden md:block`
- ClientDetailModal: fullscreen no mobile
  - `max-w-full max-h-full md:max-w-5xl md:max-h-[90vh]`
  - Tabs: icone only abaixo de `sm`, `no-scrollbar`
  - Impersonate/Edit: botoes compactos no mobile
  - "Dados Gerais": `grid-cols-1 md:grid-cols-2`
- ClientFormModal: fullscreen, `grid-cols-1 sm:grid-cols-2`
- ImpersonateModal: `max-w-full md:max-w-md`

### LeadKanban (`apps/web/src/features/leads/LeadKanban.tsx`)
- Header: empilhado, titulo `text-xl md:text-3xl`, subtitulo `hidden md:block`
- "Novo Lead": texto `hidden md:inline`, padding `p-2.5 md:px-5`
- Search: `w-full md:max-w-md`
- Kanban → Dropdown de stages no mobile:
  - State `mobileStage` + `useEffect` para default
  - `<select>` com stages + count (`md:hidden`)
  - Kanban desktop: `hidden md:flex`
  - Mobile card list com: nome, clinica, score, telefone, dias no stage
- Modal de lead: fullscreen, sidebar `hidden md:flex`
- FAB laranja para novo lead

---

## Fase 4 — Financeiro + Calendario (19/03/2026)

### Finance (`apps/web/src/features/finance/Finance.tsx`)
- Espacamento: `space-y-4 md:space-y-8`
- Header: empilhado, titulo `text-xl md:text-3xl`, subtitulo `hidden md:block`
- Export buttons: texto `hidden md:inline` (so icone)
- "Nova Transacao": `hidden md:block` + FAB
- Metricas: `grid-cols-2`, padding `p-3 md:p-4`, valor `text-sm md:text-lg`
- Charts: padding `p-4 md:p-6`, MRR `h-48 md:h-80`, Aging `h-40 md:h-64`
- MRR titulo: `flex-col md:flex-row`
- Alertas: padding `p-4 md:p-6`
- Filtros: `flex-col md:flex-row`, selects `w-full md:w-auto`
- Tabela → Card view no mobile
- Transaction modal: fullscreen, grids `grid-cols-1 sm:grid-cols-2`

### CalendarView (`apps/web/src/features/calendar/components/CalendarView.tsx`)
- Container: `h-[calc(100vh-7.5rem)] md:h-screen`
- Header: `h-auto md:h-16`, `flex-col md:flex-row`, padding `px-3 md:px-8`
- Titulo: `hidden md:inline`
- View tabs: padding `px-2 md:px-4`
- "Novo Evento": texto `hidden md:inline`, padding `px-3 md:px-6`
- Sidebar: `hidden md:block` (filtros/busca so no desktop)

---

## Fase 5 — Vendas IA + Chat (19/03/2026)

### SalesAI (`apps/web/src/pages/SalesAI/SalesAI.tsx`)
- Header: `h-auto md:h-16`, `flex-col md:flex-row`, padding `px-3 md:px-8`
- Titulo: `text-base md:text-lg`, subtitulo `hidden md:block`
- "Contexto:" label: `hidden md:inline`
- Divider: `hidden md:block`
- Tabs → Dropdown no mobile:
  - `<select>` com label + descricao (`md:hidden`)
  - Tab buttons: `hidden md:flex`
- MetricsSidebar: ja tinha `hidden xl:flex`
- Settings modal: `w-full md:w-[400px]`, padding responsivo

### ChatPage (`apps/web/src/features/chat/ChatPage.tsx`)
- Altura: `h-[calc(100vh-7.5rem)] md:h-[calc(100vh-80px)]`

---

## Fase 6 — Settings + Forms + Account (19/03/2026)

### Settings (`apps/web/src/features/settings/Settings.tsx`)
- Header: padding `px-4 py-3 md:px-6 md:py-4`, titulo `text-xl md:text-2xl`
- Subtitulo: `hidden md:block`
- Tabs → Dropdown no mobile (`md:hidden`) + tabs desktop (`hidden md:block`)

### FormsPage (`apps/web/src/features/forms/FormsPage.tsx`)
- Container: `p-3 md:p-6`
- Header: empilhado, titulo `text-xl md:text-2xl`
- "Criar Formulario": `hidden md:flex` + FAB
- Stats: margin `mb-4 md:mb-8`, valor `text-xl md:text-2xl`
- Tabela → Card view no mobile (nome + status + leads + acoes)

### AccountPage (`apps/web/src/pages/Account/AccountPage.tsx`)
- Container: `p-3 md:p-6`, `space-y-4 md:space-y-6`
- Avatar: `w-12 h-12 md:w-16 md:h-16`
- Cards: `p-4 md:p-6`
- Password rules: `grid-cols-1 sm:grid-cols-2`

---

## Fase 7 — UX Polish + Push Mobile (19/03/2026) — v2.68.0

### Push Notifications Mobile
- `MOBILE_PUSH_ENABLED = true` em `push-notification.service.ts`
- Notificacoes push nativas agora funcionam em Android e iOS (Web Push API / VAPID)

### Header Mobile
- Theme toggle (Sol/Lua) visivel no mobile (removido do BottomNav "Mais")
- Avatar com iniciais do usuario → navega para `/account`
- NotificationPanel renderizado FORA do `<header>` (escapa stacking context `z-20` + `backdrop-blur`)
- Mobile: fullscreen com backdrop `bg-black/50`, `fixed inset-x-0 top-14 bottom-0`
- Desktop: dropdown absoluto `w-96` inalterado

### CSS Global — Selects
- `appearance: none` + seta SVG customizada (chevron zinc)
- `focus`: `box-shadow: 0 0 0 2px rgba(255,115,0,0.25)` + `border-color: #FF7300`
- `-webkit-tap-highlight-color: transparent`
- Aplica automaticamente em TODOS os selects do app

### Custom Dropdowns (substituem `<select>` nativo)
- Padrao: botao com icone laranja + label + chevron animado (rotate-180)
- Menu: rounded-xl, border, shadow-xl, items com hover/active states
- Click outside fecha, item selecionado nao repete no menu
- Aplicado em:
  - **Dashboard**: atividades (Leads/Clientes/Vencimentos) + filtro produto (full-width mobile)
  - **Leads**: stages do funil (com contagem)
  - **Sales AI**: tabs (Chat/Insights/Briefing/etc com descricao)
  - **Settings**: tabs (Usuarios/Planos/Status)
  - **Finance**: filtro produto

### Titulos com Icone (modulos principais)
- Padrao: `p-2.5 rounded-xl bg-zinc-800/100` + icone 20px laranja + titulo + descricao
- **Dashboard**: `LayoutDashboard` + "Resumo do mes"
- **Pipeline Comercial**: `TrendingUp` + "Leads e oportunidades"
- **Clientes**: `Users` + "Assinantes ativos e inativos"
- **Financeiro**: `BarChart3` + "Receitas e cobrancas"
- **Configuracoes**: `Settings` + "Usuarios, planos e sistema"
- Calendar e Notifications ja tinham o padrao

### Dashboard — Melhorias Mobile
- **MetricCard**: `p-4`, trend badge visivel no mobile (`text-[10px]`), subValue sempre visivel (`line-clamp-1`), feedback `active:scale-[0.97]`
- **Titulo**: `text-xl`, subtitulo "Resumo do mes" sempre visivel
- **Insights**: colapsavel com botao chevron up/down (mobile only), refresh icon-only
- **Graficos**: Pie chart `h-48 md:h-64`, MRR `h-44 md:h-80`
- **Activity cards**: padding `p-3 md:p-6`, gap `space-y-2 md:space-y-3`, toggle `text-xs`
- **Product filter**: full-width no mobile, inline no desktop
- **Leads/Clientes/Vencimentos**: clicaveis, navegam para modulo (`active:scale-[0.98]`)

### Leads — Melhorias Mobile
- **Barra de acoes**: 3 botoes (Novo Lead esquerda `flex-1` | View toggle centro | Config icone-only direita)
- **FAB removido** (botao "Novo Lead" ja esta na barra)
- **Vista de lista**: tabela substituida por card view no mobile (`md:hidden`)
  - Cards com: nome, clinica, stage badge, score, vendedor, CNPJ
  - Desktop mantem tabela completa (`hidden md:block`)
- **Cards kanban**: separador solido (era pontilhado com className quebrado)
- **Scroll**: removido `h-full flex-col` no mobile, agora so `md:h-full md:flex md:flex-col`
- **Form inputs**: `py-3 md:py-2.5 text-base md:text-sm` (44px touch target, evita zoom iOS)
- **Search**: placeholder curto "Buscar lead...", `py-3`, placeholder dark `text-zinc-400`
- **Modal footer**: empilha verticalmente, CTA primeiro, botoes full-width, labels curtos
- **Grid gaps**: `gap-3 md:gap-6` nos forms
- **Section headers**: `mb-3 md:mb-6`
- **Stage dropdown**: `max-h-[calc(100vh-220px)]` no mobile

### Safe Areas
- **AppLayout**: `pb-[calc(5rem+env(safe-area-inset-bottom))]`
- **FABs**: `bottom-[calc(5rem+env(safe-area-inset-bottom))]` em Clients, Finance, Forms
- **Smooth scroll**: `-webkit-overflow-scrolling: touch` + `scroll-behavior: smooth`

---

## Fase 8 — Mobile Completo: Todos os Módulos (24/03/2026) — v2.70.0

### Clientes
- **Inputs anti-zoom iOS**: todos `py-3 md:py-2 text-base md:text-sm`
- **ClientDetails**: header empilha, titulo `text-xl md:text-3xl`, tabs scroll horizontal, pagamentos card view
- **ClientFormModal**: scroll no body (`flex-1 overflow-y-auto`), slide-up com backdrop blur
- **Footers empilhados**: `flex-col-reverse md:flex-row` em Form, Impersonate, Reactivate
- **Impersonate logs**: card view mobile (`md:hidden`)
- **Presets grid**: `grid-cols-2 md:grid-cols-3` + `active:scale-95`
- **Search input**: `py-3 md:py-2 text-base md:text-sm`, placeholder curto
- **Card list**: `active:scale-[0.98]` feedback

### Financeiro
- **Touch targets**: ações nos cards `p-2.5` + ícone 16px, filtros `py-3 md:py-2`
- **Status badge**: `text-xs px-2` (era `text-[10px] px-1.5`)
- **Inputs do modal**: `py-3 md:py-2 text-base md:text-sm`
- **Footer modal**: `flex-col-reverse md:flex-row`
- **ARR card**: `col-span-2 md:col-span-1`
- **Botões CSV/PDF**: ícones diferentes (`Download` vs `FileText`) + labels sempre visíveis
- **ClientFinanceModal**: slide-up, card view transações, padding `p-4 md:p-6`
- **Alert cards**: `max-h-96 md:max-h-64`
- **Product dropdown**: `max-w-[calc(100vw-2rem)]`

### Calendário (5 Fases)
- **Fase 1 — Header**: view selector `py-2.5 md:py-1.5 text-xs`, nav `p-2.5`, data curta, botão filtros mobile
- **Fase 2 — MonthView**: calendário compacto (número + bolinhas coloridas), dia selecionado com ring, lista de eventos abaixo
- **Fase 3 — WeekView**: 7 tabs de dias (número + contagem), lista de eventos do dia selecionado
- **Fase 4 — DayView**: hora `w-14 md:w-24`, header `text-xl md:text-3xl`, touch feedback. YearView: `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`, nomes abreviados
- **Fase 5 — Sidebar + Modais**: bottom sheet (busca + filtros + próximos), modais fullscreen, grids `grid-cols-1 md:grid-cols-2`, footers empilhados

### Sales AI
- **Container**: `bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-0`
- **Padding**: `p-4 md:p-10` em todas as views
- **Ícones**: tamanhos responsivos (Sparkles, Brain, Users, Target)
- **Circle progress**: `w-24 h-24 md:w-32 md:h-32`
- **Cards bottom**: `p-4 md:p-6 rounded-2xl md:rounded-3xl`
- **Generator**: grid `grid-cols-2 md:grid-cols-2 lg:grid-cols-4`, icon container `w-8 h-8 md:w-10 md:h-10`
- **Chat input**: `px-3 md:px-6`, placeholder curto
- **LeadSelector**: `min-w-0 md:min-w-[200px]`, dropdown responsivo

### Formulários
- **FormSubmissions**: card view mobile, padding `p-3 md:p-6`, stats `text-lg md:text-2xl`
- **FormBuilder**: header `px-3 md:px-6`, cards `p-4 md:p-6`, preview `grid-cols-1 md:grid-cols-2`
- **Modal campo customizado**: slide-up bottom sheet com handle bar, `grid-cols-2 md:grid-cols-3`
- **PublicForm**: grid `grid-cols-1 md:grid-cols-2`, inputs `text-base md:text-sm`, wrapper `p-4 md:p-8`

### Notificações
- **Ações visíveis no mobile**: `opacity-100 md:opacity-0 md:group-hover:opacity-100` (antes hover-only)
- **Touch targets**: filtros `py-2 md:py-1.5`, pills `py-2 md:py-1.5`, toggles `px-2.5 py-1.5`
- **Inputs anti-zoom**: search e broadcast `text-base md:text-xs`
- **Panel buttons**: `p-2 md:p-1.5` + `active:scale-95`
- **Push banner**: botões `py-1.5 md:py-1`
- **Preferences save**: safe area `pb-[calc(12px+env(safe-area-inset-bottom))]`

### Infraestrutura
- **Modal.tsx**: `items-end md:items-center`, `rounded-t-2xl md:rounded-lg`, `max-h-[calc(100%-1rem)]`, `backdrop-blur-sm`
- **ModalFooter**: `flex-col-reverse md:flex-row` automático
- **Header**: `h-16 md:h-20`, logo `h-8`, `z-0 md:z-20`, fundo sólido no mobile (sem backdrop-blur)
- **AppLayout**: `min-w-0` no main (sem overflow-hidden que prendia fixed elements)
- **Leads cores**: paleta fixa 8 cores (blue, amber, violet, emerald, pink, orange, teal, rose)
- **Discord notifications**: 3 etapas (build iniciando, build finalizado, deploy finalizado)

---

## Fase 9 — UX Polish Fixes (26/03/2026) — v2.70.1

### Leads
- **Pipeline dropdown maior**: botao `py-3.5 text-base md:text-sm`, chevron `size={18}`, opcoes `py-3.5 text-base md:text-sm`, dots `w-2.5 h-2.5`

### Clientes
- **FAB → botao inline**: removido FAB circular (+), botao "Novo Cliente" agora inline na pagina com `w-full md:w-auto justify-center md:justify-start`
- **Search outline-none**: adicionado `outline-none` ao input de busca para evitar borda branca sob ring laranja
- **ClientFormModal scroll**: `shrink-0` no header e footer, `overscroll-contain` no content area

### Infraestrutura
- **Header z-index**: removido `z-0` do mobile (era `z-0 md:z-20`, agora `md:z-20`), backdrop de modais agora cobre header
- **Discord embeds**: `notify-discord.sh` suporta `--embed "title" "desc" color "field|value"`

---

## Fase 10 — React Portal Hotfix (26/03/2026) — v2.70.2

### Problema
Apos v2.70.1, o backdrop dos modais AINDA nao cobria o header em certas situacoes. O `fixed inset-0` renderizado dentro do AppLayout competia com o `<header>` no mesmo stacking context.

### Solucao: React Portal (`createPortal`)
Todos os modais inline agora renderizam via `createPortal(jsx, document.body)`, completamente fora do AppLayout.

### Modais portalizados
- **Modal.tsx** (generico): portal no return principal
- **ClientFormModal** (ClientsList.tsx): portal wrapping form completo
- **ImpersonateModal** (ClientsList.tsx): portal wrapping modal
- **ClientDetailModal** (ClientsList.tsx): portal wrapping detail
- **LeadFormModal** (LeadKanban.tsx): portal wrapping form
- **PipelineConfigModal** (LeadKanban.tsx): portal wrapping config

### Header
- Antes: `relative z-20` (criava coordinate system)
- Depois: `md:relative md:z-20` (relative apenas no desktop)

### Por que funciona
- `createPortal` renderiza JSX direto no `<body>`, fora de qualquer stacking context do AppLayout
- Nenhum `z-index` ou `position` de pai interfere
- `fixed inset-0` no portal cobre toda a viewport, incluindo header
- Desktop inalterado (header mantem `relative` via `md:relative`)

---

## Fase 11 — Financeiro Cards + Filtros + ClientDetail Polish (26/03/2026) — v2.71.1–v2.71.3

### Financeiro
- **Botao Nova Transacao inline**: FAB circular removido, botao full-width no header (`w-full md:w-auto py-3.5 md:py-2 rounded-xl md:rounded-lg text-base md:text-sm`) com icone Plus + texto
- **Filtros 2 por linha**: container mudou de `flex-col` para `grid grid-cols-2 md:flex md:flex-row`. Selects sem `w-full` (grid controla). "Limpar Filtros" com `col-span-2`
- **Limpar Filtros no titulo**: movido para mesma linha de "Ultimas Transacoes" alinhado a direita (`md:hidden`). Desktop mantem inline com filtros
- **Transaction cards redesenhados**: layout de 3 linhas → 2 linhas. Row 1 = nome + acoes (icones 14px, p-2). Row 2 = status badge esquerda + valor direita. Sem icones soltos

### ClientDetailModal
- **Botao Novo Cliente = Novo Lead**: `py-3.5 rounded-xl text-base w-full` mobile, `md:py-2.5 md:rounded-lg md:text-sm md:w-auto` desktop
- **Modal altura fixa 75vh**: `h-[75vh] md:h-auto md:max-h-[90vh]`. Todas as abas ocupam mesmo espaco. Content area `flex-1 overflow-y-auto`
- **Header sem overflow**: nome com `truncate text-base md:text-xl min-w-0`, tenant ID `hidden md:inline`, botoes `shrink-0 gap-2 md:gap-3`
- **Tabs → dropdown**: tabs horizontais substituidas por dropdown custom no mobile (`md:hidden`). Botao com icone laranja + nome + chevron. Menu com todas as abas. Desktop mantem tabs (`hidden md:flex`)
- **StatusBadge whitespace-nowrap**: "Em Trial" nao quebra mais em 2 linhas
- **Botao Editar compacto**: `p-2 md:px-4 md:py-2 rounded-xl md:rounded-lg` (icon-only no mobile)

---

## Fase 12 — UX Fixes + Bottom Sheet Stages (27/03/2026) — v2.72.0–v2.72.2

### Clientes
- **Search placeholder encurtado**: "Pesquisar clinica ou responsavel..." → "Pesquisar cliente..." (nao corta mais no mobile)
- **Modulos "Voltar" removido**: botao "Voltar para Dados Gerais" no ClientModulesTab removido (navegacao via tabs/dropdown). ArrowLeft import e useEffect Escape tambem removidos

### Leads — Cards
- **Fontes maiores**: nome `text-sm` → `text-base`, clinica `text-[10px]` → `text-xs`, telefone `text-[11px]` → `text-sm`, resp/dias `text-[9px]` → `text-xs`, converter `text-[9px]` → `text-xs`
- **Menos espaco**: padding `p-5` → `p-4`, rounded `rounded-2xl` → `rounded-xl`, RoleTag margin `mb-4` → `mb-2`
- **Stage badge (list view)**: `text-[10px]` → `text-xs`

### Leads — Stage Selector (Bottom Sheet)
- **Dropdown → bottom sheet**: seletor de stages convertido de dropdown `absolute` para bottom sheet `fixed` via `createPortal(jsx, document.body)`
- **Scroll nativo**: `overflow-y-auto` + `WebkitOverflowScrolling: 'touch'` + `overscroll-contain`
- **Layout**: `max-h-[70vh]`, header "Selecionar Etapa" com X, itens `px-5 py-4` com border-b separadores, dots `w-3 h-3`
- **Safe area**: `pb-[calc(0.75rem+env(safe-area-inset-bottom))]` no footer
- **Backdrop fecha**: click no fundo borrado fecha o bottom sheet

### Leads — Pipeline Config
- **Slide-up do bottom**: `items-end md:items-center`, `rounded-t-2xl md:rounded-2xl`, `max-h-[75vh] md:max-h-[90vh]`, `flex flex-col`
- **Scroll unico**: removido `max-h-[350px] overflow-y-auto` interno, agora so o container `flex-1 overflow-y-auto` controla
- **Backdrop fecha**: `onClick={onClose}` no backdrop + `stopPropagation` no container
- **Footer empilhado**: `flex-col-reverse md:flex-row`, `p-4 md:p-6`, gap `gap-3 md:gap-4`
- **Botao salvar**: `py-3.5 md:py-3 px-4` (mais espaco interno)

### Leads — LeadFormModal
- **Backdrop fecha**: `onClick={onClose}` no backdrop + `stopPropagation` no container

### Financeiro
- **Filtro produto expande**: `flex-1 md:flex-none` no container do dropdown de produto
- **CSV/PDF tamanho original**: `shrink-0` nos botoes de export (nao esticam)
- **Nova Transacao separada**: `w-full` em linha propria abaixo dos filtros

---

## Fase 13 — Leads Navegacao + Calendar Polish + Modal Headers (27/03/2026) — v2.72.3–v2.72.6

### Leads — Stage Navigation
- **Stage selector → dropdown**: bottom sheet removido, substituido por dropdown `absolute` abaixo do botao. Click-outside via `useRef` + mousedown/touchstart listener. Items `px-4 py-3 text-sm`. Sem backdrop escuro
- **Botoes avancar/voltar**: `ChevronRight` (avancar) e `ChevronLeft` (voltar) em cada card mobile. Calcula proxima/anterior stage via `stages.indexOf()`. Nao aparece na primeira (voltar), ultima (avancar), Ganho ou Perdido. Ambos chamam `updateMutation.mutate({ id, payload: { stageId } })`
- **Cards mais compactos**: `mb-3`→`mb-1`, `mb-2`→`mb-1`, `mt-4 pt-4`→`mt-2 pt-2`, `mt-2`→`mt-1`. Aplicado em kanban e list view

### Leads — Pipeline Config Drag
- **Drag-to-reorder**: `@dnd-kit/sortable` com `SortableContext`, `useSortable`, `arrayMove`, `verticalListSortingStrategy`
- **SortableStageItem**: componente com `GripVertical` drag handle + botoes up/down como fallback (`hidden md:flex`)
- **TouchSensor**: delay 150ms para mobile, PointerSensor para desktop

### Financeiro — Delete Confirmation
- **Modal centralizado**: `toast()` substituido por modal via `createPortal(jsx, document.body)`. Icone `Trash2` em circulo vermelho, titulo "Excluir transacao?", nome do cliente, botoes Cancelar/Excluir. Backdrop `bg-black/60 backdrop-blur-sm` fecha ao clicar. `z-[200]`
- **Estado**: `deleteConfirm: { id: string; client: string } | null`

### Modais — Headers Fixos
- **LeadFormModal**: `shrink-0` no header e footer. Content `flex-1 overflow-y-auto`. Titulo nao scrolla
- **Finance Transaction Modal**: `overflow-y-auto` movido do container para content area. Container agora `overflow-hidden flex flex-col`. Header e footer com `shrink-0`
- **ClientFormModal**: ja estava correto (pulado)

### Calendario — Polish Completo
- **Header rounded**: `rounded-b-2xl md:rounded-none` no header do calendario
- **Botoes Dia/Sem/Mes/Ano**: `px-5 py-2 text-xs rounded-lg` (mais largos, nao mais altos). Revertido `py-3` excessivo
- **Novo Evento full-width**: botao mobile-only `w-full py-3.5 text-base` com texto visivel. Original escondido `hidden md:flex`
- **MonthView dia selecionado**: `rounded-xl` no background (antes era retangulo quadrado)
- **Header fixo**: `shrink-0` no header, week day headers, calendar grid, day tabs. So event list scrolla
- **Removido rounded desconectado**: `rounded-b-xl` removido de WeekView tabs, selected day header, MonthView grid
- **MonthView touch targets**: circles `w-9 h-9 text-sm`, headers `text-xs py-2.5`, dots `w-2 h-2`
- **WeekView touch targets**: circles `w-10 h-10 text-base`, letras `text-xs`, indicador `w-8 h-1`, event count `text-xs`

---

## Padrao de Componentes Mobile (v2.72.6)

### Navegacao
- **BottomNav** (5 icones + "Mais" com bottom sheet, sem theme toggle)
- **Custom Dropdowns** (botao com icone + chevron + menu, substitui `<select>` nativo)
- **Tabelas → Card view** (lista de cards compactos, `md:hidden`)

### Titulos de Pagina
- Icone laranja em `p-2.5 rounded-xl` + titulo `text-xl md:text-3xl` + descricao `text-xs`
- Aplicado em todos os modulos principais

### Modais
- Slide-up no mobile: `items-end md:items-center`, `rounded-t-2xl md:rounded-2xl`
- Max height: `max-h-[calc(100%-1rem)] md:max-h-[90vh]` (gap no topo mostra backdrop blur)
- Backdrop: `bg-black/60 backdrop-blur-sm` cobre tudo incluindo header
- Footer empilha verticalmente: `flex-col-reverse md:flex-row`
- Padding reduzido: `p-4 md:p-6`

### Botoes de Acao
- Desktop: botao inline com texto
- Mobile: barra de acoes inline (ex: Novo Lead + View toggle + Config)
- FABs com safe area: `bottom-[calc(5rem+env(safe-area-inset-bottom))]`

### Header Mobile
- Theme toggle + Notificacoes bell + Avatar com iniciais
- NotificationPanel renderizado fora do header (fullscreen com backdrop)

### Touch Targets
- Inputs: `py-3 text-base` no mobile (44px minimo, evita zoom iOS)
- Botoes: `active:scale-95` ou `active:scale-[0.97]` para feedback tactil
- Acoes sempre visiveis no mobile (sem hover-only)

### Safe Areas
- AppLayout: `pb-[calc(5rem+env(safe-area-inset-bottom))]`
- FABs: `bottom-[calc(5rem+env(safe-area-inset-bottom))]`
- BottomNav: `pb-[env(safe-area-inset-bottom)]`

### Responsividade
- Base = mobile, `md:` = desktop
- Grids: `grid-cols-1` ou `grid-cols-2` no mobile, `gap-3 md:gap-6`
- Texto: tamanhos menores no mobile (`text-xs md:text-sm`)
- Padding: reduzido no mobile (`p-3 md:p-6`)
- Scroll: mobile rola naturalmente (sem `h-full flex-col`), desktop usa flex overflow
