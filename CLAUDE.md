# CLAUDE.md — Kanban de Gestão de Marketing

Leia antes de qualquer trabalho:
- `docs/SPEC.md` — especificação oficial (vale mais que qualquer suposição).
- `docs/DECISOES.md` — decisões e premissas aprovadas pelo dono.
- `AGENTS.md` — aviso do Next.js 16: consulte `node_modules/next/dist/docs/` antes de usar APIs do Next.

## Como trabalhar neste projeto
- O dono **não é programador**: explique tudo em português simples, sem jargão, e diga o que vai fazer e por quê **antes** de fazer.
- Desenvolvimento por fases (SPEC §10). Cada fase termina com testes passando + commit + explicação simples. Depois **pare e aguarde validação**.
- Regra ambígua? Liste a dúvida, proponha premissa e aguarde. Não invente comportamento.
- Interface em pt-BR; código, tabelas e variáveis em inglês.

## Regras de negócio críticas
- **Fuso oficial: America/Sao_Paulo.** "Hoje" = `todayInSaoPaulo()`. Nunca use o fuso do servidor.
- **Prazo (`dueDate`) é só data** (Postgres `DATE`). No código, trate como texto `"AAAA-MM-DD"` (`DateOnly`);
  converta com `dateOnlyFromDb` / `dateOnlyToDb`. Horários só em eventos (`createdAt`, `completedAt`, `card_events`).
- **O card grava só a etapa (`stage`)**: NEW, ACTIVE, APPROVAL, CHANGES, DONE.
  A coluna de prazo de cards ACTIVE é **calculada** por `getTimeColumn` (nunca gravada, nada de cron):
  - OVERDUE: prazo < hoje · TODAY: = hoje · THIS_WEEK: amanhã até domingo · UPCOMING: depois do domingo.
  - Semana = segunda a domingo. No domingo, THIS_WEEK fica vazia.
- 8 colunas fixas (`BOARD_COLUMNS` em `src/lib/board/columns.ts`). ATRASADAS é só leitura (não aceita soltura).
- Ordenação de todas as colunas: `dueDate` crescente; empate/sem prazo → `createdAt` crescente. Sem ordenação manual.
- Roteamento: card com prazo → ACTIVE; sem prazo → NEW. NEW que recebe prazo → ACTIVE. Apagar prazo de ACTIVE → NEW.
  APROVAÇÃO/ALTERAÇÃO não saem da coluna ao vencer; só ganham selo vermelho.
- Arrastar para coluna de prazo que não bate com o prazo → modal de data (sugestões: HOJE=hoje;
  ESTA SEMANA=sexta, ou amanhã se a sexta já chegou, e bloqueado no domingo; PRÓXIMOS=segunda seguinte).
  Sem permissão de alterar prazo → sem modal; soltura só se já bater.
- Conclusão (→ DONE): grava `completedAt`; `completedOnTime` = data de conclusão em SP ≤ `dueDate` (null se sem prazo);
  pede confirmação e marca checklist pendente. Sair de DONE limpa os dois e registra REOPENED.
- Recorrência: só na **primeira** finalização (idempotente — `recurrenceParentId` é único no banco).
  Copia título, descrição, área, labels, responsáveis, criador e checklist desmarcado; **não** copia comentários/anexos.
  Próximo prazo = `getNextRecurrenceDate` (calendário real; mensal guarda o dia original; pula o passado; respeita data final).
- Permissões (validar **no servidor e por RLS**, nunca só esconder botões):
  Admin faz tudo e vê todos os quadros. Membro cria/edita/move cards nos quadros em que participa e só altera prazo
  dos cards que **ele criou**. Observador só vê e comenta. Excluir card, gerenciar quadros/áreas/labels/usuários e
  dashboard: só Admin. Excluir usuário = desativar. Sem cadastro aberto; Google só para e-mail já cadastrado.
- Áreas e labels pertencem a cada quadro. Área é obrigatória e única por card. Em uso → só desativar.
- Excluir card = lixeira (`deletedAt`). Anexos: máx. 10 MB (`MAX_ATTACHMENT_BYTES`), validar no navegador e no servidor.
- Toda mudança de etapa gera `CardEvent` (fromStage, toStage, autor, data/hora) — base do dashboard.
- **Aprovação (SPEC §6.E)**: entrar em APROVAÇÃO = "enviar para aprovação" (avisa o criador). Só quem criou o card
  ou Administrador (`canApprove`) tira de APROVAÇÃO: Aprovar → DONE, Reprovar (motivo obrigatório) → CHANGES.
  Ninguém arrasta para fora de APROVAÇÃO; no quadro, soltar em FINALIZADAS = aprovar, em ALTERAÇÃO = pedir motivo
  (`planDrop` em `src/lib/board/moves.ts`). Avisos só no sistema (tabela `notifications`, sininho), nunca da própria ação.

## Stack
Next.js 16 (App Router) · TypeScript · Tailwind 4 · shadcn/ui · dnd-kit · Supabase (Postgres, Auth, Storage, Realtime)
· Prisma 7 · Zod · date-fns + @date-fns/tz · Recharts · Vitest · deploy na Vercel (sem cron, Redis ou BullMQ).

## Comandos
```bash
npm install              # instala dependências (gera o Prisma Client automaticamente)
npm run dev              # roda o site em http://localhost:3000
npm test                 # roda os testes (Vitest) — fuso UTC+14 de propósito
TEST_TZ=America/Sao_Paulo npm test   # testes em outro fuso
npm run typecheck        # confere tipos do TypeScript
npm run lint             # confere estilo do código
npm run build            # monta a versão de produção
npm run db:validate      # valida prisma/schema.prisma
npm run db:generate      # gera o Prisma Client em src/generated/prisma
npx prisma migrate dev   # cria nova migração a partir do schema (use um banco local no .env)
npm run test:db:setup    # cria o banco local de testes (PostgreSQL local, usuário kanban/kanban)
npm run test:integration # todos os testes, incluindo os com banco (serviços + RLS)
```
- Vercel usa `npm run vercel-build` (gera Prisma Client, aplica migrações, monta o site).
- Variáveis de ambiente: ver `.env.example`.

## Mapa de pastas
- `src/app/` — páginas e rotas (Next.js App Router).
- `src/components/ui/` — componentes do shadcn/ui · `board/`, `card/`, `dashboard/` — componentes das telas.
- `src/lib/dates/` — regras de data (puras e testadas) · `src/lib/board/` — colunas do quadro.
- `src/lib/auth/` — permissões · `src/lib/db/` — conexão Prisma · `src/lib/supabase/` — clientes Supabase · `src/lib/validation/` — esquemas Zod.
- `src/server/services/` — regras com banco (recebem `db` + usuário; conferem permissão; testados com banco real em `*.int.test.ts`).
- `src/server/actions/` — Server Actions: pegam o usuário logado e chamam os serviços; erros viram mensagem em pt-BR.
- `src/proxy.ts` — (antigo "middleware" no Next 16) renova a sessão e manda para /login quem não está logado.
- `src/hooks/`, `src/types/` — utilidades de React e tipos compartilhados.
- `prisma/` — schema e migrações. As políticas de RLS ficam na migração `*_rls` (funções `app_*` + `auth.uid()`).
- `scripts/` — banco local de testes (`test-db-setup.sh`, `local-supabase-shim.sql`).
- `src/generated/` — código gerado pelo Prisma (não editar, fora do Git).
- Testes ficam ao lado do código: `*.test.ts`.

## Padrões de interface
- Mensagens rápidas: `toast` (`@/components/ui/toaster`). Confirmações: `useConfirm()` (`@/components/ui/confirm`) — nunca `window.confirm`.
- Cores de área/etiqueta: texto com `readableTextColor`; novas cores com `nextColor` (`src/lib/colors.ts`).
- Prazo no quadro em linguagem natural: `describeDue` (`src/lib/format.ts`). Cor/estado vazio das colunas: `components/board/column-style.ts`.
- Componentes shadcn/ui foram escritos à mão em `src/components/ui/` (o site do shadcn é bloqueado no ambiente de nuvem).

## Regras técnicas importantes
- Permissão: **sempre** conferir no serviço (`src/lib/auth/permissions.ts`) — o Prisma conecta como dono das tabelas e ignora o RLS.
  O RLS protege o acesso direto pela API do Supabase (Realtime na F3). Mudou regra de permissão? Atualize os dois e os testes.
- Lógica de arrastar está em `planDrop`/`resolveDrop` (`src/lib/board/moves.ts`) e é usada no navegador e no servidor.
- Serviços de aprovação: `src/server/services/approval.ts`; sininho: `src/server/services/notifications.ts`.
- Conclusão (checklist pendente + próxima tarefa da série) fica em `finishCard` (`src/server/services/completion.ts`),
  usado por `moveCard` (→ DONE) e `approveCard`. Janela de data: `moveWithDueDate` + `suggestDueDate`/`planDrop` (`pickDate`).
- Next.js 16: `params`/`searchParams`/`cookies()` são assíncronos; `cacheComponents` desligado de propósito.

## Estado atual
- Etapa 0 concluída. **F1 concluída** (login e-mail/senha + Google opcional, quadros, acessos, áreas/labels, usuários,
  cards com checklist, arrastar e soltar, permissões + RLS). Revisão de UX/UI feita.
- **F1.5 concluída** (aprovação com avisos no sistema).
- **F2 concluída** (janela de data ao arrastar, confirmação de checklist ao finalizar, recorrência).
  Próxima: **F3** — comentários com @menção, anexos com capa, atualização ao vivo. Depois F4 (dashboard).
