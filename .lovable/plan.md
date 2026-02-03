

# Plano: Ajustar Horário do Resumo Diário para 18h

## Situação Atual

| Rotina | Função | Horário Atual | Schedule (UTC) |
|--------|--------|---------------|----------------|
| Resumo Diário | `daily-summary-email` | 08:30 BRT | `30 11 * * *` |
| Atividades Atualizadas | `updated-activities-email` | 18:00 BRT | `0 21 * * *` |

## Opção Proposta

Alterar o agendamento do **Resumo Diário** de 08:30 para **18:00 BRT**.

Isso resultará em dois e-mails sendo enviados às 18:00:
1. **Resumo Diário** - Criadas, Concluídas e Em Atraso (com PDF)
2. **Atividades Atualizadas** - Todas as atividades que tiveram alterações no dia

## Alterações Necessárias

### 1. Atualizar o cron job no banco de dados

Executar SQL para atualizar o schedule do job existente:

```text
-- Atualizar horário do resumo diário para 18:00 BRT (21:00 UTC)
SELECT cron.unschedule('daily-summary-email-08h30');

SELECT cron.schedule(
  'daily-summary-email-18h',
  '0 21 * * *',  -- 21:00 UTC = 18:00 BRT
  $$
  SELECT net.http_post(
    url := 'https://ssljlgmcoilghdyxqihu.supabase.co/functions/v1/daily-summary-email',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ..."}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);
```

### 2. Atualizar texto no rodapé do e-mail

No arquivo `supabase/functions/daily-summary-email/index.ts`, linha ~301, alterar:

```text
De: "Este é um e-mail automático gerado pelo sistema Z3US às 08:30."
Para: "Este é um e-mail automático gerado pelo sistema Z3US às 18:00."
```

## Resultado Final

Ambos os e-mails serão enviados às **18:00 BRT** diariamente:
- Resumo Diário (Criadas/Concluídas/Em atraso + PDF)
- Atividades Atualizadas (alterações do dia)

