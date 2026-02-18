
## Corrigir Responsividade do Dashboard para Mobile

### Diagnóstico a partir da imagem enviada

A imagem mostra o Dashboard no mobile com os seguintes problemas:

**1. Header do AdminDashboard — botões cortados (linha 700-741)**
- `flex items-center gap-3` com 3 elementos (botão "Resumo da Semana", botão "Modo Print", Select de cliente com `w-[280px]`) transbordam para fora da tela no mobile.
- O título "Dashboard Administrativo" também fica cortado horizontalmente.

**2. Cards de estatísticas — empilhamento incorreto (linha 746)**
- `grid gap-6 md:grid-cols-3` faz os cards ficarem em coluna no mobile, mas cada card ocupa a tela inteira e parece grande demais — parece que os cards estão ocupando muito espaço vertical.

**3. Dashboard.tsx — sidebar e header principal (linha 88-175)**
- `main className="flex-1 p-6 overflow-auto"` usa `p-6` fixo — em mobile precisa de `p-3 sm:p-6`.
- `header className="h-16 border-b... px-6"` também usa `px-6` fixo — precisa de `px-3 sm:px-6`.
- O nome do usuário e perfil podem ser ocultados ou resumidos em mobile.

**4. Tabelas sem scroll horizontal — AdminDashboard (linhas 913-999)**
- A tabela "Atividades por responsável" tem 6 colunas e nenhum `overflow-x-auto` — fica cortada em mobile.

**5. Dialog de detalhes — sem largura responsiva (linha 961)**
- `max-w-3xl` sem `w-[95vw]` faz o modal transbordar em telas pequenas.

**6. Grid "Atividades por cliente e prioridade" (linha 1005)**
- `grid gap-6 md:grid-cols-2` — aceitável, mas padding interno pode ser melhorado.

---

### Arquivos a alterar

1. **`src/pages/Dashboard.tsx`** — ajustar padding do main/header, sidebar mobile
2. **`src/components/dashboard/AdminDashboard.tsx`** — header de controles, grids, tabelas com overflow, dialog

---

### Mudanças Técnicas Detalhadas

#### Dashboard.tsx

**Header principal** (linha 156):
```tsx
// Antes
<header className="h-16 border-b border-border bg-card flex items-center px-6">

// Depois
<header className="h-16 border-b border-border bg-card flex items-center px-3 sm:px-6">
```

**Main content** (linha 171):
```tsx
// Antes
<main className="flex-1 p-6 overflow-auto">

// Depois
<main className="flex-1 p-3 sm:p-6 overflow-auto">
```

**Nome do usuário no header** (linhas 163-168):
- Adicionar `hidden sm:block` para ocultar o bloco de texto em telas muito pequenas, mantendo apenas o ícone/avatar.

---

#### AdminDashboard.tsx

**Título + botões de controle** (linhas 698-742):
```tsx
// Antes
<div className="flex items-center justify-between gap-4 flex-wrap">
  ...
  <div className="flex items-center gap-3 no-print">
    {/* 3 itens inline sem responsividade */}
    <div className="w-[280px]">
      <Select ...>
```

// Depois
```tsx
<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 flex-wrap">
  ...
  <div className="flex flex-col xs:flex-row items-start xs:items-center gap-2 sm:gap-3 no-print w-full sm:w-auto">
    {/* Botões ficam em linha no mobile pequeno, e o Select ocupa toda a largura */}
    <div className="flex gap-2">
      <Button size="sm" ...>Resumo da Semana</Button>
      <Button size="sm" ...>Modo Print</Button>
    </div>
    <div className="w-full sm:w-[280px]">
      <Select ...>
```

**Grid de status cards** (linha 808):
```tsx
// Antes
<div className="grid gap-6 md:grid-cols-3">

// Depois
<div className="grid gap-3 sm:gap-6 grid-cols-1 sm:grid-cols-3">
```

**Tabela "Atividades por responsável"** (linhas 906-952):
```tsx
// Antes
<CardContent>
  <Table>...

// Depois  
<CardContent className="p-3 sm:p-6 pt-0">
  <div className="overflow-x-auto">
    <Table className="min-w-[500px]">...
  </div>
```

**Dialog de detalhes** (linha 961):
```tsx
// Antes
<DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">

// Depois
<DialogContent className="w-[95vw] sm:max-w-3xl max-h-[80vh] overflow-auto">
```

**Grid de "Atividades por cliente e prioridade"** (linha 1005):
```tsx
// Antes
<div className="grid gap-6 md:grid-cols-2">

// Depois
<div className="grid gap-3 sm:gap-6 grid-cols-1 md:grid-cols-2">
```

**Welcome card grid** (linha 1077):
```tsx
// Antes
<div className="grid md:grid-cols-2 gap-4">

// Depois
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
```

---

### Resultado Esperado

| Breakpoint | Comportamento |
|---|---|
| Mobile (< 640px) | Botões em 2 linhas, Select largo, cards em 1 coluna, tabelas com scroll horizontal |
| Tablet (640–768px) | Botões em linha, Select com largura fixa, 2–3 colunas |
| Desktop (> 768px) | Layout atual preservado integralmente |

---

### Arquivos que serão alterados
- `src/pages/Dashboard.tsx` — padding do header e main
- `src/components/dashboard/AdminDashboard.tsx` — header de controles, grids, tabelas com scroll, dialog

Nenhuma mudança de lógica, banco de dados ou outros componentes.
