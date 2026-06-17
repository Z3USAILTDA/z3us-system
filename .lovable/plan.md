
# Documentação — Z3US / Hermes

## INFORMAÇÕES BÁSICAS
- **Nome do Sistema:** Z3US (módulo interno chamado Hermes para e-mails automáticos)
- **Propósito:** Plataforma interna de gestão de projetos, demandas, clientes e times da Z3US, com dashboards para admin e cliente, relatórios semanais e tela de métricas em TV.
- **Data de Criação:** 2025 (em evolução contínua)
- **Status:** Em uso em produção (projetos.z3us.my)

---

## PARTE 1: TECH STACK

### Frontend
- **Framework:** React 18.3 (SPA)
- **Linguagem:** TypeScript 5.8
- **Build tool:** Vite 5.4 (`@vitejs/plugin-react-swc`)
- **Styling:** Tailwind CSS 3.4 + `tailwindcss-animate` + `@tailwindcss/typography`
- **UI Library:** shadcn/ui (Radix UI primitives) + `lucide-react` para ícones
- **Roteamento:** `react-router-dom` v6
- **Data fetching/cache:** `@tanstack/react-query` v5
- **Forms/Validação:** `react-hook-form` + `zod` + `@hookform/resolvers`
- **Charts:** `recharts`
- **Export:** `xlsx` (Excel) e `jspdf` (PDF do Weekly Summary)
- **Datas:** `date-fns` (usado pontualmente — regra de negócio: datas críticas via string DD/MM/YYYY, sem `Date`)

### Backend
- **Plataforma:** Lovable Cloud (Supabase gerenciado)
- **Edge Functions (Deno/TypeScript):**
  - `create-user` — criação segura de usuários (bypass do signup público)
  - `update-user-role` — gerencia roles admin/client
  - `setup-metrics-user` — provisiona usuário da tela de métricas TV
  - `daily-summary-email` — envio diário às 18:00 BRT (resumo)
  - `updated-activities-email` — envio diário de atividades atualizadas
- **APIs externas:** Resend (envio de e-mails — remetente `noreply@hermes.z3us.ai`)

### Database (Supabase Postgres)
- Tabelas principais:
  - `profiles` — perfis de usuário
  - `user_roles` — roles (`admin`, `client`) com função `has_role()` SECURITY DEFINER
  - `clients` — clientes
  - `client_emails` — e-mails adicionais por cliente
  - `client_access` — vínculo multi-usuário cliente↔conta
  - `client_projects` — projetos/categorias por cliente (ex: ERP, Uni-financeiro)
  - `projects` — demandas/atividades (núcleo do sistema)
  - `teams` — times
  - `documents` — documentação anexada (Storage bucket `documents`)
- Storage buckets: `documents`, `email-assets` (público, para imagens dos e-mails)
- Segurança: RLS habilitado em todas as tabelas públicas, roles via `user_roles` + `has_role()` para evitar privilege escalation.

### Deploy
- **Host:** Lovable (preview + produção). Domínio publicado: `https://z3us-system.lovable.app`. Custom domain: `https://projetos.z3us.my`.
- **CI/CD:** Deploy automático via Lovable a cada alteração; Edge Functions deployadas via Lovable Cloud.
- **Variáveis de ambiente (auto-geridas):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`. Secrets de Edge: `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-side).

### Dependências Principais (top)
React 18, react-router-dom 6, @tanstack/react-query 5, @supabase/supabase-js 2, shadcn/ui (Radix), TailwindCSS 3, recharts, react-hook-form + zod, date-fns, xlsx, jspdf, sonner (toasts), lucide-react.

---

## PARTE 2: ESTRUTURA DO PROJETO

```
z3us/
├── src/
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── ClientDashboard.tsx
│   │   │   ├── TodayDeliveries.tsx
│   │   │   ├── TodayDemandsByClient.tsx
│   │   │   ├── TodayDemandsByPerson.tsx
│   │   │   ├── TodayDemandsModal.tsx
│   │   │   ├── YesterdaySummary.tsx
│   │   │   └── YesterdayDrilldownModal.tsx
│   │   └── ui/                     (shadcn/ui completo)
│   ├── pages/
│   │   ├── Index.tsx               (landing/redirect)
│   │   ├── Auth.tsx                (login)
│   │   ├── Dashboard.tsx           (shell + menu)
│   │   ├── Projects.tsx            (CRUD demandas + export Excel/PDF)
│   │   ├── Clients.tsx
│   │   ├── Teams.tsx
│   │   ├── Users.tsx               (admin: criar/alterar role/senha)
│   │   ├── Documentation.tsx       (uploads e filtros fixos)
│   │   ├── WeeklySummary.tsx       (KPIs semanais + PDF)
│   │   ├── MetricsTV.tsx           (tela TV com login próprio)
│   │   └── NotFound.tsx
│   ├── hooks/
│   │   ├── use-toast.ts
│   │   ├── use-mobile.tsx
│   │   └── useWeeklySummary.ts
│   ├── integrations/supabase/      (client + types AUTO-GERADOS)
│   ├── lib/
│   │   ├── utils.ts
│   │   ├── validations.ts
│   │   └── weeklyPdfExport.ts
│   ├── index.css                   (design tokens HSL)
│   ├── App.tsx
│   └── main.tsx
├── supabase/
│   ├── config.toml
│   └── functions/
│       ├── create-user/
│       ├── update-user-role/
│       ├── setup-metrics-user/
│       ├── daily-summary-email/
│       └── updated-activities-email/
├── public/
├── tailwind.config.ts
├── vite.config.ts
└── package.json
```

---

## PARTE 3: MÓDULOS / PÁGINAS PRINCIPAIS

### 1. Auth (`/auth`)
Login com Supabase Auth (e-mail/senha). Sem signup público — usuários são criados pelo admin via Edge Function `create-user`. Redireciona para `/dashboard` autenticado.

### 2. Dashboard (`/dashboard`)
Shell principal com menu lateral. Renderiza `AdminDashboard` ou `ClientDashboard` conforme role.
- **AdminDashboard:** KPIs gerais, "Entregas de Hoje", "Demandas de Hoje por Pessoa" e "por Cliente", "Resumo de Ontem" (com drilldown), atividades sem prazo, ranking por pessoa (excluindo gerente).
- **ClientDashboard:** isolado por cliente; mostra demandas do(s) projeto(s) do cliente, "Entrega" usando `actual_end_date`, filtros de sprint (afetam stats) e de status (apenas lista).

### 3. Projects (`/dashboard/projects`)
Tela central de demandas. Edição inline (Enter/Blur salva, Esc cancela, UI otimista). Filtros por cliente, projeto, sprint (ordenação numérica), status. Exporta Excel e PDF respeitando filtros aplicados. Regras de status especiais:
- `waiting_client` → responsável vira "Cliente" (salva original em `responsible_before_client`), label "Aguardando cliente".
- `test` → label "Teste".
- `completed` → `progress = 100%` e `actual_end_date = hoje` automaticamente.
- Overdue: `end_date < hoje` excluindo `waiting_client`, `test`, `on_hold`, `cancelled`.

### 4. Clients (`/dashboard/clients`)
CRUD de clientes, e-mails adicionais (`client_emails`), e gestão de acesso multi-usuário (`client_access`).

### 5. Teams (`/dashboard/teams`)
CRUD de times. Time vazio é renderizado como "Z3US".

### 6. Users (`/dashboard/users`)
Apenas admin. Criação via Edge Function `create-user`, alteração de role via `update-user-role`, reset de senha via Admin API (ícone `KeyRound`).

### 7. Documentation (`/dashboard/documentation`)
Upload e listagem de documentos no bucket `documents`. Filtros fixos por Produto (Zeus, Olimpo, etc.) e Tipo. Vinculação a múltiplos produtos.

### 8. Weekly Summary (`/dashboard/weekly-summary`)
KPIs semanais (Seg 00:00 – Dom 23:59 horário do sistema), tendências, comparativos e export PDF via `jspdf` (`lib/weeklyPdfExport.ts`).

### 9. Metrics TV (`/metricas-projetos-tv`)
Painel para televisão com login próprio (usuário de métricas dedicado). Cards: KPIs gerais, "Status & Evolução 6m" (pie + linha), "Projetos por cliente" (full width, sem scroll) e ranking de responsáveis (apenas `responsible`, ignora gerente).

---

## PARTE 4: FLUXO DE DADOS & ESTADO

### Autenticação
- Supabase Auth (e-mail/senha). Sem sign-up público.
- Sessão persistida pelo SDK do Supabase em `localStorage`; tokens JWT gerenciados automaticamente.
- Role checada via `user_roles` + função `has_role(user_id, role)` (SECURITY DEFINER) usada nas RLS — nunca confiada via client.

### Carregamento de Dados
- Cada página usa `@tanstack/react-query` (`useQuery`) chamando `supabase.from(...).select(...)`.
- Dashboards filtram por `auth.uid()` (cliente) ou admin via `has_role`.
- Estados de loading com `Skeleton`/`Loader2`; erros tratados com `toast` (`sonner`).
- Não há Redux/Zustand — estado de servidor fica no React Query; estado local com `useState/useReducer`.

### Criar / Editar / Deletar
- Demanda: edição inline na tabela com mutações otimistas; modal para criação.
- Validação com `zod` antes de enviar; backend valida via RLS + checks.
- Após sucesso: toast + invalidação de query (`queryClient.invalidateQueries`).
- Regras automáticas aplicadas no client/handlers (status especiais descritos acima).

### E-mails Automáticos (cron)
- Dois Edge Functions agendados às 18:00 BRT: `daily-summary-email` e `updated-activities-email`. Remetente obrigatório `noreply@hermes.z3us.ai`. Imagens hospedadas no bucket público `email-assets`.

---

## PARTE 5: DESIGN & VISUAL

### Cores (HSL, tema escuro fixo — `src/index.css`)
- Background: `hsl(222 47% 6%)`
- Foreground: `hsl(210 40% 98%)`
- Card: `hsl(222 47% 8%)`
- **Primary (teal):** `hsl(175 70% 50%)`
- **Secondary (azul):** `hsl(217 91% 60%)`
- **Accent (roxo):** `hsl(280 85% 65%)`
- Success: `hsl(142 76% 45%)` · Warning/Alert (laranja/amarelo): `hsl(38 92% 55%)` · Yellow: `hsl(48 96% 53%)`
- Destructive (vermelho — usado apenas para overdue 'X'): `hsl(0 63% 31%)`
- Gradiente primário: `linear-gradient(135deg, primary → secondary → accent)`; fundo da app usa `--gradient-mesh` (4 radiais).
- Sombras com glow teal (`--shadow-glow`).

### Tipografia
- Fonte do sistema/Tailwind padrão (sem Google Fonts customizada).
- Tamanhos usam escala Tailwind (`text-xs`..`text-3xl`).

### Tema
- Apenas **dark theme** (variáveis em `:root`); não há toggle light/dark — regra: não redesenhar.

### Componentes Visuais
- Buttons/Cards/Inputs/Dialogs/Tables: shadcn/ui sobre Radix.
- Charts: `recharts` (pie + line na MetricsTV; bar/line no Weekly Summary).
- Tables: sempre dentro de wrapper `overflow-x-auto` (container principal nunca scrolla horizontalmente).
- Toasts: `sonner` + `@/components/ui/toaster`.
- Efeitos: `glow-primary`, `neon-border`, `tech-grid`, animação `float` (em `index.css`).

---

## PARTE 6: FUNCIONALIDADES-CHAVE
- [x] Gestão de demandas/projetos com edição inline otimista
- [x] Dashboards distintos para Admin e Cliente
- [x] "Entregas de Hoje" e "Demandas de Hoje" (por pessoa e por cliente, com modal de detalhe)
- [x] "Resumo de Ontem" com drilldown
- [x] Weekly Summary com KPIs e export PDF (`jspdf`)
- [x] Export Excel e PDF de demandas filtradas (`xlsx` + `jspdf`)
- [x] Multi-acesso de cliente (`client_access`) com isolamento de dados
- [x] Documentação central com filtros fixos por Produto/Tipo
- [x] E-mails diários automáticos via Resend (Hermes)
- [x] Tela Metrics TV com login dedicado
- [x] Admin: criar usuário, alterar role, resetar senha

---

## PARTE 7: RESPONSIVE & PERFORMANCE
- Mobile-friendly via classes Tailwind (`sm:`, `md:`, `lg:`); breakpoints padrão (640/768/1024/1280).
- Tabelas com scroll horizontal local; container principal sem overflow horizontal.
- Cache e dedupe de requests com React Query; mutações otimistas em Projects.
- Code splitting natural por rota (Vite); SWC para builds rápidos.
- Sem virtualização explícita — listas paginadas/filtradas no client.

---

## PARTE 8: INTEGRAÇÕES & APIs
- **Supabase JS SDK** (`@supabase/supabase-js`) — auth, query, storage, edge functions.
- **Resend** — envio de e-mails (chamado dentro das Edge Functions).
- **xlsx / jspdf** — exports client-side.
- Sem webhooks externos atualmente; integrações server-side ficam dentro dos Edge Functions.

---

## PARTE 9: SCREENSHOTS
Pulado (preferência: sem screenshots).

---

## PARTE 10: CÓDIGO IMPORTANTE
Pulado conforme pedido (sem snippets longos). Referências chave no repositório:
- `src/App.tsx` — definição de rotas.
- `src/integrations/supabase/client.ts` — cliente Supabase (auto-gerado, não editar).
- `src/pages/Projects.tsx` — núcleo de demandas (edição inline + export).
- `src/components/dashboard/AdminDashboard.tsx` — composição do dashboard admin.
- `src/lib/weeklyPdfExport.ts` — geração do PDF semanal.
- `supabase/functions/*` — toda lógica server-side.

---

## PARTE 11: OBSERVAÇÕES
- **Datas:** decidido NÃO usar `Date` do JS para datas críticas — manipulação por string `DD/MM/YYYY` para evitar shift de timezone.
- **Roles:** isoladas em `user_roles` + `has_role()` (nunca em `profiles`) para evitar privilege escalation.
- **Layout:** regra forte de "não redesenhar"; cores semânticas em tokens HSL no `index.css`.
- **E-mails:** sempre remetente `noreply@hermes.z3us.ai` (nunca o domínio raiz).
- **Pontos de melhoria potenciais:** paginação server-side em listas grandes, testes automatizados, virtualização de tabelas longas, internacionalização.

---

## RESUMO RÁPIDO

**O que é Z3US?** Sistema interno de gestão de projetos/demandas da Z3US, com dashboards segmentados por papel (admin × cliente), relatórios semanais, exports e painel de métricas para TV.

**Principal diferencial?** Visão operacional do dia (entregas/demandas de hoje, resumo de ontem) integrada a métricas estratégicas e isolamento multi-cliente, tudo num único produto interno.

**Maior desafio técnico?** Gestão segura de papéis e acesso multi-cliente sob RLS, somada às regras de negócio de status (waiting_client, test, completed) e tratamento de datas sem efeitos de timezone.

**O que mais gosta nele?** Tema dark coeso com tokens HSL, edição inline otimista nas demandas e a automação diária de e-mails via Hermes.
