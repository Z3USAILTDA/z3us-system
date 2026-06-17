Diagnóstico rápido:
- O convite por email está sendo reenviado corretamente.
- O gargalo está depois que o cliente define a senha: o fluxo ainda pode depender de um login separado por senha depois de salvar a senha.
- Quando a sessão não volta pronta da função, a tela tenta um fallback com `signInWithPassword`, que pode demorar, falhar silenciosamente ou deixar a experiência parecendo travada.
- Também há um caminho HTML antigo na função que, se acessado diretamente, manda o cliente para `/auth` em vez de concluir a sessão automaticamente.

Plano de correção urgente:
1. Tornar a função do link de acesso transacional
   - Validar o token do convite.
   - Salvar a senha.
   - Confirmar o email.
   - Criar a sessão do cliente imediatamente.
   - Só responder sucesso se a sessão tiver sido criada com `access_token` e `refresh_token`.

2. Remover o fallback lento no frontend
   - Após definir senha, a página `/reset-password` deve apenas aplicar a sessão retornada pela função.
   - Não deve fazer uma segunda tentativa de login por senha no navegador.
   - Não deve ficar em “salvando” por muito tempo.

3. Ajustar mensagens e estado de carregamento
   - Enquanto processa: “Entrando...” ou “Liberando acesso...”.
   - Em sucesso: redirecionar direto para `/dashboard`.
   - Se houver falha real do backend, liberar o botão e pedir novo envio do convite, sem loop infinito.

4. Corrigir o caminho direto do link
   - Se o link for aberto pelo app, manter `/reset-password?invite_token=...`.
   - Se por algum motivo a função for aberta diretamente, ela não deve mandar o cliente para `/auth` como fluxo principal.

5. Validar com logs e teste direto
   - Testar a função com um convite válido.
   - Confirmar que a resposta retorna sessão.
   - Confirmar que o cliente cai no dashboard sem chamada extra de login e sem demora de salvamento.