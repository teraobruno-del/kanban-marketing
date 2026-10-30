# SPEC — Kanban de Gestão de Marketing

## 1. Sobre este documento

Este documento é a especificação oficial do projeto e vale mais do que qualquer suposição. O desenvolvimento acontece em fases (seção 10), e cada fase só começa depois que a anterior foi validada.

Se alguma regra estiver ambígua ou contraditória, liste a dúvida, proponha uma premissa e aguarde confirmação. Não invente comportamento sem avisar.

O dono do projeto não é programador. Explique decisões e resultados em linguagem simples.

## 2. Contexto

Aplicação web estilo Kanban, semelhante ao Trello, para o setor de Marketing de uma empresa. Ela tem três objetivos:

- gerenciar o fluxo de trabalho da equipe;
- organizar as tarefas automaticamente por prazo;
- oferecer um dashboard de indicadores para a liderança.

Convenções gerais:

- Interface em português (pt-BR). Código, tabelas e variáveis em inglês.
- Fuso horário oficial: **America/Sao_Paulo**. Todas as regras de "hoje" e "semana" usam esse fuso.
- As demandas chegam por canais externos (WhatsApp, e-mail, reunião). Um Administrador ou Membro cadastra a tarefa no sistema. Observadores não criam tarefas.

## 3. Quadros (boards)

- O sistema permite vários quadros (ex.: "Marketing Institucional", "Lançamento X").
- Só o Administrador pode criar, renomear, arquivar e excluir quadros.
- Todo quadro nasce com as mesmas 8 colunas fixas da seção 4. As colunas não podem ser editadas.
- O acesso é definido por quadro. Cada quadro tem sua lista de Membros e Observadores. O usuário só vê os quadros dos quais participa, exceto o Administrador, que vê todos.
- **Cada quadro tem suas próprias áreas solicitantes e labels.** Elas não são compartilhadas entre quadros e são gerenciadas pelo Administrador nas configurações do quadro.
- A tela inicial mostra a lista de quadros do usuário.

## 4. Colunas e modelo conceitual

O quadro mistura duas dimensões: a **etapa do fluxo** e a **urgência do prazo**. Para que elas não entrem em conflito:

- o card grava apenas a **etapa (`stage`)**;
- a coluna de prazo é **calculada** a partir da data. Ela não é gravada nem movida por cron.

| `stage` (gravado) | Coluna(s) exibida(s) |
|---|---|
| `NEW` | 🎁 NOVAS DEMANDAS |
| `ACTIVE` | 😱 ATRASADAS · 😭 HOJE · 🥲 ESTA SEMANA · 😎 ESTE MÊS / PRÓXIMOS (calculadas pelo prazo) |
| `APPROVAL` | 🫣 APROVAÇÃO |
| `CHANGES` | 😒 ALTERAÇÃO |
| `DONE` | 🥳 FINALIZADAS |

No código, use chaves técnicas: `NEW`, `OVERDUE`, `TODAY`, `THIS_WEEK`, `UPCOMING`, `APPROVAL`, `CHANGES` e `DONE`. O emoji e o nome em português ficam só no rótulo da interface.

### 4.1 Prazo apenas por dia

- O prazo (`dueDate`) é uma **data sem hora**, gravada como tipo `DATE` no Postgres. O seletor mostra só o calendário.
- O horário é registrado apenas nos eventos (`createdAt`, `completedAt` e mudanças de etapa), para os cálculos do dashboard.

### 4.2 Cálculo da coluna de prazo (cards `ACTIVE`)

Considere `today` como a data atual em America/Sao_Paulo. A semana do calendário vai de **segunda a domingo**.

- **ATRASADAS**: `dueDate < today`. O card recebe um selo vermelho.
- **HOJE**: `dueDate = today`.
- **ESTA SEMANA**: `dueDate` entre `today + 1` e o domingo da semana corrente. No domingo, essa coluna fica vazia.
- **ESTE MÊS / PRÓXIMOS**: `dueDate` depois do domingo da semana corrente, inclusive em meses seguintes.

A interface recalcula as colunas ao carregar a página e na virada do dia.

### 4.3 Ordenação

- **Todas as colunas** são ordenadas por `dueDate` crescente: os prazos mais próximos aparecem primeiro.
- Em caso de empate, e para cards sem prazo, a ordem é por `createdAt` crescente.
- Não há ordenação manual. Arrastar um card serve apenas para mudá-lo de coluna.

## 5. Card (tarefa)

- **Título** e **descrição em Markdown**, com editor e pré-visualização.
- **Prazo (`dueDate`)**: apenas a data, opcional. Card sem prazo permanece em NOVAS DEMANDAS.
- **Área solicitante**: obrigatória e única por card (ex.: RH, ECOTOWERS, PARQUE, DIRETORIA). Tem cor configurável, pertence ao quadro e alimenta o gráfico "Áreas Demandantes".
- **Etiquetas (labels)**: várias por card, livres e coloridas (ex.: "Rede Social", "Vídeo", "E-mail"). Também pertencem ao quadro e indicam o tipo de entrega.
- **Responsáveis**: um ou mais usuários com acesso ao quadro.
- **Criador (`createdById`)**: registrado automaticamente. É usado na regra de permissão de prazo (seção 7).
- **Checklists**: um ou mais, com itens marcáveis e barra de progresso.
- **Anexos**:
  - aceita imagens e arquivos, com **limite de 10 MB por arquivo**, validado no navegador e no servidor;
  - qualquer imagem anexada pode virar a capa do card.
- **Comentários**, com menção a usuários usando @.
- **Recorrência**: interruptor disponível na criação e na edição, com as opções diária, semanal ou mensal e data final opcional.
- **Histórico de atividades**: registra quem moveu, editou ou comentou e quando.

## 6. Automações

### A. Roteamento por prazo

- Card criado **com** prazo recebe `stage = ACTIVE` e aparece direto na coluna de prazo correspondente. Sem prazo, fica em `NEW`.
- Quando um card em `NEW` recebe um prazo, passa para `ACTIVE`.
- Cards em APROVAÇÃO ou ALTERAÇÃO **não saem da coluna** quando o prazo vence. Eles apenas ganham o selo vermelho.
- **Arraste manual:**
  - Soltar um card em uma coluna de prazo define `stage = ACTIVE`.
  - Se a coluna de destino não corresponder ao prazo atual, abre um modal para ajustar a data. As sugestões são:
    - HOJE = hoje;
    - ESTA SEMANA = sexta-feira da semana corrente (ou hoje, se a sexta já passou);
    - ESTE MÊS / PRÓXIMOS = segunda-feira da semana seguinte.
  - Se o usuário não puder alterar o prazo (seção 7), o modal não aparece. A soltura só é aceita se a coluna de destino já corresponder ao prazo atual.
  - Não é possível soltar cards em ATRASADAS. Essa coluna é apenas de leitura.

### B. Conclusão

Quando um card é movido para FINALIZADAS:

- Gravar `completedAt` (data e hora) e exibir o prazo como "Concluído", em verde.
- Gravar `completedOnTime`, que é verdadeiro quando a data de `completedAt` em São Paulo é menor ou igual a `dueDate`.
- Se houver itens de checklist pendentes, pedir confirmação ("X itens serão marcados como concluídos") e então marcar todos.
- Se o card sair de FINALIZADAS, limpar `completedAt` (reabertura) e registrar o evento.

### C. Recorrência

Esta regra vale quando um card recorrente é finalizado **pela primeira vez**. Ela é idempotente: reabrir o card e finalizá-lo de novo não gera outra cópia.

- Criar um novo card no mesmo quadro.
  - Copiar: título, descrição, área, labels, responsáveis, criador e checklist (com os itens desmarcados).
  - **Não** copiar comentários nem anexos.
- O novo prazo é calculado a partir do **prazo original**, com aritmética de calendário.
  - Exemplo do ciclo mensal: 31/01 vira 28/02 (ou 29/02 em ano bissexto). Não usar "+30 dias".
  - Se a data resultante ainda estiver no passado, avançar ciclos até chegar ao futuro.
- O novo card segue a regra A, ou seja, aparece na coluna de prazo correta.
- Os cards da série ficam ligados por `recurrenceParentId`, e a data final da recorrência é respeitada.

### D. Sem jobs agendados

Como as colunas são calculadas, nenhuma regra depende de cron. O sistema não envia resumos por e-mail.

## 7. Usuários e permissões (RBAC)

- A página de administração de usuários tem CRUD completo. "Excluir" um usuário significa desativá-lo, preservando o histórico.
- O login pode ser feito com **e-mail e senha** ou com **conta Google**, ambos pelo Supabase Auth.
- Não existe cadastro aberto: só o Administrador cadastra usuários. Login com Google só é aceito se o e-mail já estiver cadastrado.
- Os papéis são globais (Administrador, Membro e Observador). O acesso aos quadros é concedido quadro a quadro (seção 3).

| Ação | Administrador | Membro | Observador |
|---|---|---|---|
| Ver quadros e cards | ✅ todos | ✅ quadros dos quais participa | ✅ quadros dos quais participa |
| Criar card | ✅ | ✅ | ❌ |
| Editar título, descrição, responsáveis, labels, checklist e anexos | ✅ | ✅ | ❌ |
| Mover cards entre colunas | ✅ | ✅ | ❌ |
| Alterar prazo | ✅ qualquer card | ✅ só cards que **ele mesmo criou** | ❌ |
| Comentar | ✅ | ✅ | ✅ |
| Excluir card | ✅ | ❌ | ❌ |
| Gerenciar quadros, áreas, labels e usuários | ✅ | ❌ | ❌ |
| Dashboard | ✅ | ❌ | ❌ |

- A aprovação externa acontece fora do sistema ou pelos comentários. Quem move o card de APROVAÇÃO para FINALIZADAS ou para ALTERAÇÃO é um Administrador ou Membro.
- As permissões devem ser validadas **no servidor** e também por RLS no Supabase. Não basta esconder botões na interface.

## 8. Dashboard (somente Administrador)

Filtros globais:

- quadro (um, vários ou todos);
- período (mês, trimestre, ano ou intervalo personalizado);
- área solicitante.

As métricas de fluxo vêm da tabela de eventos (`CardEvent`). Ela registra cada mudança de `stage` com data, hora e autor.

1. **Volume**: barras com cards criados vs. concluídos, por semana ou mês.
2. **Entregas no prazo**: % de cards com `completedOnTime = true`, mais o número de cards atrasados no momento.
3. **Workload por usuário**: cards ativos de cada responsável, empilhados por coluna (Atrasadas, Hoje, Esta Semana, Este Mês / Próximos, Aprovação e Alteração).
4. **Áreas demandantes**: pizza ou barras por área solicitante.
5. **Lead time**: mediana e média do tempo entre `createdAt` e `completedAt`, exibido em dias e horas.
6. **Gargalo de aprovação**: tempo médio que cada card passa, somando todas as vezes, em APROVAÇÃO.
7. **Retrabalho**: % de cards finalizados que passaram ao menos uma vez por ALTERAÇÃO, e média de ciclos por card.

## 9. Stack

- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS e shadcn/ui.
- **Arrastar e soltar**: dnd-kit.
- **Backend**: Supabase, usado para:
  - banco PostgreSQL;
  - autenticação (Auth);
  - armazenamento dos anexos (Storage);
  - atualização ao vivo entre usuários (Realtime).
- **ORM e migrações**: Prisma.
- **Validação de dados**: Zod.
- **Datas**: date-fns e @date-fns/tz.
- **Gráficos**: Recharts.
- **Deploy**: Vercel. O projeto não usa cron, Redis nem BullMQ.
- **Testes**: Vitest. Os testes das regras de data (cálculo de coluna e recorrência) são obrigatórios e devem cobrir:
  - virada de mês e de ano;
  - 29/02;
  - domingo e segunda-feira;
  - fuso horário.

## 10. Fases e entregáveis

Cada fase termina com os testes passando, um commit e uma explicação em linguagem simples do que foi feito. Depois disso, pare e aguarde validação.

### Etapa 0: Base do projeto (sem telas)

1. Lista de dúvidas e premissas adotadas.
2. Projeto Next.js inicializado com a stack da seção 9.
3. Arquivo `prisma/schema.prisma` completo, contendo:
   - enums;
   - relações;
   - índices;
   - quadros e o acesso por quadro;
   - áreas e labels por quadro;
   - o modelo `CardEvent`.
4. Estrutura de diretórios do projeto.
5. Funções puras `getTimeColumn(dueDate, today)` e `getNextRecurrenceDate(...)`, com testes unitários.
6. Arquivo `CLAUDE.md` na raiz, com o resumo das regras críticas e os comandos do projeto.

### F1: Login, quadros e cards

- Conexão com o Supabase e login (e-mail/senha e Google).
- Lista de quadros, criação de quadros e gestão de acesso.
- Quadro com as 8 colunas, criação e edição de cards e arrastar e soltar.
- Permissões da seção 7 aplicadas.

### F2: Automações

- Roteamento por prazo, conclusão e recorrência (seção 6).

### F3: Colaboração

- Comentários com menção, anexos com capa e histórico de atividades.
- Atualização ao vivo entre usuários.

### F4: Dashboard

- Filtros e as 7 métricas da seção 8.
