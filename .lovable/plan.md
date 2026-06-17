## Objetivo

Adicionar, na tela **Clientes**, ao lado de cada email adicional (e do email principal), um botão **"Convidar"** que:
1. Cria automaticamente um usuário com role `client` para aquele email (senha temporária aleatória).
2. Dispara um email transacional via Hermes (`noreply@hermes.z3us.ai`) com link para a pessoa **definir a própria senha** (reset de senha) e acessar o portal.
3. Marca visualmente o email como "Convidado" / "Já tem acesso" para não convidar duas vezes.

Com o trigger `handle_new_user` já existente, o usuário criado é vinculado automaticamente ao cliente via `clients.email` ou `client_emails`, liberando os projetos no dashboard.

## Mudanças

### 1. Edge Function nova: `invite-client-user`
Arquivo: `supabase/functions/invite-client-user/index.ts`

- Valida que o chamador é admin (mesmo padrão de `create-user`).
- Recebe `{ email, clientId }`.
- Verifica se já existe usuário com aquele email (`auth.admin.listUsers` por email). Se existir, apenas reenvia o email de reset.
- Caso não exista: cria usuário com `email_confirm: true`, role `client`, senha aleatória forte, `full_name` = email.
- Gera link de **recovery** (`auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo: <APP_URL>/auth?reset=1 } })`) para extrair o `action_link`.
- Chama `send-transactional-email` com novo template `client-invite`, passando `{ inviteUrl, clientName, recipientEmail }` e `idempotencyKey = client-invite-<clientId>-<email>`.
- Retorna `{ success, status: 'created' | 'resent' }`.

Sender obrigatório: `noreply@hermes.z3us.ai` (regra do projeto).

### 2. Template de email novo: `client-invite`
Arquivo: `supabase/functions/_shared/transactional-email-templates/client-invite.tsx` + registro em `registry.ts`.

- Mesmo visual dark dos demais emails do Hermes.
- Conteúdo curto em PT-BR: boas-vindas ao portal Z3US, botão "Definir minha senha e acessar" apontando para `inviteUrl`, aviso de validade do link.
- Sem promoções, sem anexos.

Após criar/registrar o template, deploy de `send-transactional-email` e `invite-client-user`.

### 3. UI em `src/pages/Clients.tsx`
No modal de edição do cliente, na seção **Emails Adicionais** e ao lado do **Email Principal**:

- Botão pequeno `Convidar` (ícone `Mail`/`Send`) por email.
- Ao clicar: chama `supabase.functions.invoke('invite-client-user', { body: { email, clientId } })`.
- Toast de sucesso ("Convite enviado" / "Reenviado") ou erro.
- Após sucesso, marca o email com badge "Convidado" (consulta `client_users` por `client_id` + lookup de `auth.users` indireto via uma nova RPC `email_has_account(email text)` SECURITY DEFINER que retorna boolean — evita expor auth.users ao client).

### 4. RPC nova: `email_has_account`
Migration adicionando função SECURITY DEFINER em `public`:

```text
public.email_has_account(_email text) returns boolean
```

Consulta `auth.users` por email e retorna `true/false`. Grant `EXECUTE` para `authenticated`. Usada apenas para mostrar o badge de "já tem acesso" na UI.

### 5. Sem mudanças em sign-up
Continua proibido auto sign-up. O usuário é criado server-side pela Edge Function (mesmo padrão de `create-user`), respeitando a regra de memória do projeto.

## Fluxo final para os 3 contatos da Unitrading

1. Abrir cliente **Unitrading** em Clientes.
2. Clicar em **Convidar** em cada um dos 3 emails adicionais.
3. Cada pessoa recebe email do Hermes com link para definir senha e entra no portal vendo os projetos da Unitrading automaticamente (via `client_users` populado pelo trigger).

## Pontos técnicos

- Pré-requisitos de email (domínio `hermes.z3us.ai`, infra de fila, `send-transactional-email`) já existem no projeto — apenas adicionamos um novo template e uma Edge Function que invoca o sender.
- `redirectTo` do link de recovery aponta para uma rota já existente de auth; se necessário, ajusta-se `Auth.tsx` para tratar `?reset=1` exibindo o formulário de nova senha (verificar no momento da implementação).
- Idempotência: chave do convite inclui `clientId + email`, e a função detecta usuário existente e apenas reenvia o link, evitando duplicatas.
