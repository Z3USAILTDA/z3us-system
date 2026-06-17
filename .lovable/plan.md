## Plano de correção

1. **Remover o timeout falso da tela de senha**
   - Ajustar `ResetPassword.tsx` para não abortar a chamada em 15 segundos com a mensagem “Tempo esgotado”.
   - Mostrar o erro real retornado pelo backend quando houver falha.
   - Evitar que o cliente veja timeout quando a função ainda está fria/iniciando.

2. **Trocar a chamada manual por `supabase.functions.invoke`**
   - Usar o cliente padrão do app para chamar `set-client-password`, mantendo os headers corretos automaticamente.
   - Enviar apenas `password` e `inviteToken` no corpo quando for link de convite.

3. **Tornar o link de convite mais tolerante**
   - Aumentar a validade do token de convite de 1 hora para 7 dias.
   - Atualizar o texto do e-mail para informar a nova validade.
   - Manter a invalidação por nonce quando um novo convite for reenviado ou a senha for definida.

4. **Limpar rota HTML legada da função de senha**
   - Remover/ignorar o fluxo GET que tentava renderizar HTML pela Edge Function, pois o link correto deve abrir sempre `/reset-password` no app.
   - Manter a função apenas como endpoint JSON para definir senha com segurança.

5. **Deploy e validação**
   - Publicar as funções alteradas (`invite-client-user` e `set-client-password`).
   - Testar OPTIONS/POST da função e confirmar que respostas JSON/CORS estão corretas.
   - Confirmar que a tela não exibe mais “Tempo esgotado” indevidamente.