## Diagnóstico

O cliente não está conseguindo entrar pelo link porque o fluxo atual ficou dividido em duas etapas lentas e frágeis:

1. O link abre `/reset-password` com `invite_token`.
2. A página chama a função `set-client-password` para salvar a senha.
3. Só depois o navegador tenta fazer `signInWithPassword` no cliente.
4. O backend de autenticação está levando vários segundos em chamadas de `/user`, `/admin/users` e `/token`; quando isso demora, a tela parece travar ou o login fica pendente.

Também há um problema de rota: quando o login finalmente acontece, o código navega para `/dashboard`, mas o usuário está tentando acessar `/dashboard/clients`. Para perfil de cliente, essa rota não é adequada; o menu do cliente aponta para `/dashboard`.

## Plano de correção

1. **Fazer o link de acesso gerar sessão no backend**
   - Após definir a senha, a função `set-client-password` também fará o login com o e-mail e senha recém-definidos.
   - Ela retornará os tokens da sessão diretamente para a página.
   - Isso evita depender de uma segunda tentativa lenta de login no navegador.

2. **Aplicar a sessão imediatamente no frontend**
   - A página `/reset-password` usará os tokens retornados para salvar a sessão com `setSession`.
   - Depois disso, redirecionará direto para `/dashboard`.
   - O fallback com várias tentativas será removido ou reduzido para não deixar o usuário esperando indefinidamente.

3. **Evitar travamento visual**
   - Adicionar limite curto e mensagem clara só se a função realmente falhar.
   - Não deixar o botão em estado infinito.

4. **Ajustar o acesso do cliente à rota correta**
   - Cliente deve cair em `/dashboard`, que já renderiza `ClientDashboard` quando o perfil não é admin.
   - Se necessário, proteger `/dashboard/clients` para não ser usado como destino de cliente.

## Arquivos envolvidos

- `supabase/functions/set-client-password/index.ts`
- `src/pages/ResetPassword.tsx`
- Possivelmente `src/pages/Dashboard.tsx` para tolerar melhor sessão recém-criada e evitar loading indevido.

## Resultado esperado

Ao clicar no link do e-mail e definir a senha, o cliente entra automaticamente no portal sem precisar tentar login manual e sem ficar preso em carregamento.