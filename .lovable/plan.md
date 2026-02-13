
## Plano: Implementar Memória de Responsável para Status "Aguardando Cliente"

### Situação Atual
- Quando o status muda para `waiting_client`, o responsável é **automaticamente definido como "Cliente"**
- Quando muda para outro status (completed, cancelled, etc), o responsável **permanece como "Cliente"**
- Você quer que ao sair do status `waiting_client`, o responsável **retorne ao valor anterior**

### Estratégia de Implementação

Existem duas opções técnicas:

**Opção A (Recomendada)**: Usar um novo campo na tabela `projects`
- Adicionar coluna `responsible_before_client` (texto, nullable)
- Quando status muda para `waiting_client`: salva o responsável atual em `responsible_before_client` e muda `responsible` para "Cliente"
- Quando status sai de `waiting_client`: restaura o valor de `responsible_before_client` para `responsible`
- **Vantagem**: Solução robusta, permite auditoria, persiste corretamente
- **Desvantagem**: Requer migração no banco

**Opção B**: Usar estado local (sem banco)
- Manter apenas em memória (React state) o valor anterior
- Ao sair de `waiting_client`, restaura do state
- **Vantagem**: Implementação rápida, sem mudanças no banco
- **Desvantagem**: Se a página for recarregada, perde a memória

### Solução Proposta: **Opção A** (com banco de dados)

#### 1. Migração no Banco
Executar SQL para adicionar a coluna:
```sql
ALTER TABLE public.projects ADD COLUMN responsible_before_client TEXT DEFAULT NULL;
```

#### 2. Lógica no Frontend (`src/pages/Projects.tsx`)

Na função `saveEdit`, adicionar:
```typescript
if (field === "status" && editValue === "waiting_client") {
  // Salva o responsável atual ANTES de mudar para "Cliente"
  const project = projects.find(p => p.id === projectId);
  updateData.responsible = "Cliente";
  updateData.responsible_before_client = project?.responsible || null;
} else if (field === "status" && projects.find(p => p.id === projectId)?.status === "waiting_client" && editValue !== "waiting_client") {
  // Se SAI de "waiting_client", restaura o responsável anterior
  const project = projects.find(p => p.id === projectId);
  if (project?.responsible_before_client) {
    updateData.responsible = project.responsible_before_client;
    updateData.responsible_before_client = null; // Limpa a memória
  }
}
```

#### 3. Também aplicar no formulário completo
Na função `handleSubmit`, aplicar a mesma lógica de salvamento/restauração do responsável.

#### 4. Casos de Teste
- ✅ Status → `waiting_client`: responsável vira "Cliente", campo `responsible_before_client` salva o anterior
- ✅ Status sai de `waiting_client` para `completed`: responsável restaura ao anterior
- ✅ Status sai de `waiting_client` para `cancelled`: responsável restaura ao anterior
- ✅ Status muda entre outros estados (não `waiting_client`): funciona normalmente
- ✅ Se responsável estava vazio, retorna para vazio ao sair de `waiting_client`

### Arquivos que Serão Alterados
1. **Migração**: Criar arquivo com SQL para adicionar coluna
2. **src/pages/Projects.tsx**: Atualizar `saveEdit` e `handleSubmit` com lógica de memória
3. **src/integrations/supabase/types.ts**: Será auto-gerado após migração

### Dependências
- Nenhuma nova dependência necessária
- Usa o padrão existente de otimistic updates
