
## Tornar o Sistema de Gestão de Projetos Responsivo

### Diagnóstico dos Problemas Atuais

Após análise do arquivo `src/pages/Projects.tsx` (1.386 linhas), os principais problemas de responsividade identificados são:

**1. Header da página (linha 603-610)**
- `flex justify-between items-center` com filtros e botões em linha — em telas pequenas, os elementos se amontoam ou transbordam.

**2. Filtros no modo "cards" (linhas 611-646)**
- Selects de largura fixa (`w-[180px]`, `w-[140px]`) dentro de um `flex gap-2 flex-wrap` — ficam espremidos em mobile.

**3. Formulário de criação/edição (linhas 692-852)**
- Grids de 2 e 3 colunas fixas (`grid-cols-2`, `grid-cols-3`) — em mobile, os campos ficam muito pequenos e ilegíveis.

**4. Modo tabela — Filtros (linha 996)**
- `grid grid-cols-2 md:grid-cols-5` — em mobile usa apenas 2 colunas mas ainda pode ser apertado.

**5. Modo tabela — Tabela principal (linha 1087+)**
- Tabela com 12 colunas sem nenhuma estratégia de scroll horizontal — em mobile fica ilegível/cortada.

**6. Sidebar (linha 521)**
- A sidebar já tem lógica de colapso (`w-14` vs `w-60`), mas em mobile ela não usa `Sheet` (modal), ela simplesmente fica colapsada — em mobile seria melhor um menu hamburguer com overlay.

---

### Solução Proposta

#### Estratégia Geral
- **Mobile first**: ajustar os breakpoints com Tailwind (`sm:`, `md:`, `lg:`).
- **Tabela**: envolver em `overflow-x-auto` para scroll horizontal em mobile.
- **Formulário**: grids se tornam 1 coluna em mobile, 2 no tablet, 3 no desktop.
- **Header de controles**: empilhar verticalmente em mobile.
- **Sidebar**: habilitar o modo `Sheet` do Shadcn Sidebar para mobile (já suportado pelo componente, basta passar corretamente).

---

### Mudanças Técnicas por Seção

#### 1. Header de controles (linha 603–895)

**Antes:**
```tsx
<div className="flex justify-between items-center gap-4">
  <div>...</div>
  <div className="flex gap-2 items-center flex-wrap">...</div>
</div>
```

**Depois:**
```tsx
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
  <div>...</div>
  <div className="flex gap-2 items-center flex-wrap w-full sm:w-auto">...</div>
</div>
```

Os selects de filtro receberão `w-full sm:w-[180px]` para ocupar toda a largura em mobile.

---

#### 2. Formulário do Dialog (linhas 692–876)

**Antes:**
```tsx
<div className="grid grid-cols-2 gap-4">  {/* linha 692 */}
<div className="grid grid-cols-3 gap-4">  {/* linhas 749, 779, 822 */}
```

**Depois:**
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
```

O `DialogContent` também ganha `w-[95vw] sm:max-w-3xl` para não transbordar em mobile.

---

#### 3. Filtros da tabela (linha 996)

**Antes:**
```tsx
<div className="grid grid-cols-2 md:grid-cols-5 gap-4">
```

**Depois:**
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
```

---

#### 4. Tabela com scroll horizontal (linha 983–1369)

**Antes:**
```tsx
<Card>
  <CardContent className="p-6">
    {/* filtros */}
    <Table>...</Table>
  </CardContent>
</Card>
```

**Depois:**
```tsx
<Card>
  <CardContent className="p-3 sm:p-6">
    {/* filtros */}
    <div className="overflow-x-auto">
      <Table className="min-w-[900px]">...</Table>
    </div>
  </CardContent>
</Card>
```

Isso garante scroll horizontal sem quebrar o layout.

---

#### 5. Cards de projetos (linha 904)

**Antes:**
```tsx
<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
```

**Depois:**
```tsx
<div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
```

Em mobile, os cards ficam em 1 coluna.

---

#### 6. Sidebar + Header

O `SidebarProvider` já oferece suporte a mobile com `Sheet`. A sidebar atual usa verificação do estado `state === "collapsed"` mas não tem tratamento mobile. Será ativada a lógica nativa do componente para mostrar a sidebar como um painel deslizante em mobile.

O header (`h-16 px-6`) receberá `px-3 sm:px-6` para não ficar muito apertado.

---

### Arquivo que Será Alterado
- **`src/pages/Projects.tsx`**: ajustes de classes Tailwind em todo o JSX da página — sem mudanças de lógica, apenas responsividade.

### Sem Mudanças em
- Lógica de negócio (filtros, save, etc.)
- Banco de dados
- Outros arquivos

### Resultado Esperado
- Mobile (< 640px): 1 coluna, tabela com scroll horizontal, botões empilhados
- Tablet (640–1024px): 2 colunas, filtros reorganizados
- Desktop (> 1024px): layout atual preservado integralmente
