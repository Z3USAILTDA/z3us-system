

# Plano: Corrigir Domínio de Envio de E-mail

## Problema Identificado
O domínio verificado no Resend é **`hermes.z3us.ai`**, porém as Edge Functions estão tentando enviar e-mails usando **`noreply@z3us.ai`** (domínio raiz não verificado).

## Solução
Atualizar o campo `from` em ambas as Edge Functions para usar o domínio verificado.

## Arquivos a Modificar

### 1. `supabase/functions/daily-summary-email/index.ts`
**Linha 170** - Alterar:
```typescript
// De:
from: "Z3US System <noreply@z3us.ai>"

// Para:
from: "Z3US System <noreply@hermes.z3us.ai>"
```

### 2. `supabase/functions/updated-activities-email/index.ts`
**Linha 212** - Alterar:
```typescript
// De:
from: "Z3US System <noreply@z3us.ai>"

// Para:
from: "Z3US System <noreply@hermes.z3us.ai>"
```

---

## Detalhes Técnicos

O Resend valida que a chave de API corresponda ao domínio do remetente. Como a chave foi criada para `hermes.z3us.ai`, qualquer tentativa de enviar de outro domínio (mesmo que seja o domínio pai) resultará no erro 403.

Após esta alteração, os e-mails serão enviados com sucesso de `noreply@hermes.z3us.ai`.

