# Decisões e premissas aprovadas

Complementa a SPEC (`docs/SPEC.md`). Aprovado pelo dono do projeto em 30/10/2026 (Etapa 0).
Em caso de conflito, a SPEC vale — exceto nos pontos abaixo, que esclarecem ou ajustam a SPEC.

## Decisões (Parte A)

1. **Papéis globais.** O papel (Administrador, Membro, Observador) vale para o sistema todo.
   Em cada quadro só se define *quem tem acesso* (tabela `board_members`). Administrador vê todos os quadros.
2. **Sugestão de data ao arrastar para ESTA SEMANA:** sexta-feira da semana corrente se ainda
   não chegou; senão, amanhã. No **domingo**, ESTA SEMANA não aceita soltura (estaria vazia de qualquer forma).
3. **Recorrência mensal guarda o dia original** (`recurrenceAnchorDay`): 31/01 → 28/02 → 31/03 → 30/04.
4. **NOVAS DEMANDAS só aceita soltura de card sem prazo.**
5. **Excluir card = lixeira** (`deletedAt`): some das telas e do dashboard, mas fica no banco.
6. **Área solicitante / label em uso só pode ser desativada** (`isActive = false`).
   Exclusão definitiva apenas se nunca foi usada.
7. **Responsáveis:** só Administradores e Membros com acesso ao quadro (Observador não pode ser responsável).
8. Este arquivo registra as decisões.

## Premissas (Parte B)

- **P1.** Apagar o prazo de um card ACTIVE o devolve para NEW.
- **P2.** Card sem prazo pode ir para APROVAÇÃO, ALTERAÇÃO e FINALIZADAS. Nesse caso
  `completedOnTime = null` e ele fica fora do % de entregas no prazo.
- **P3.** Recorrência: exige prazo; diária conta todos os dias (inclui fins de semana); semanal = +7 dias;
  o novo card também é recorrente (a série continua); data final é inclusiva e, se ultrapassada,
  nenhum card é criado; ao pular ciclos do passado, uma data igual a hoje já é aceita.
- **P4.** Reabrir (sair de FINALIZADAS) limpa `completedAt` **e** `completedOnTime`; finalizar de novo recalcula.
- **P5.** "Atrasados no momento" (dashboard) = todo card não finalizado com prazo vencido,
  incluindo APROVAÇÃO e ALTERAÇÃO.
- **P6.** Histórico de atividades e mudanças de etapa ficam numa única tabela `card_events`, com um campo `type`.
- **P7.** Login pelo Supabase Auth; a tabela `users` guarda a ficha (nome, papel, ativo) com o mesmo `id` da conta.
- **P8.** Versões estáveis mais recentes das ferramentas. Prazos tratados como texto "AAAA-MM-DD" (sem hora).
- **P9.** FINALIZADAS também é ordenada por prazo crescente (SPEC §4.3: "todas as colunas").

## Notas técnicas da Etapa 0

- Prisma fixado na versão estável 7.x (a 8.0 ainda era "release candidate").
- O shadcn/ui foi configurado manualmente (`components.json`, `src/lib/utils.ts`, tema em `globals.css`),
  porque a rede do ambiente de nuvem bloqueou `ui.shadcn.com`. Para baixar componentes na F1,
  é preciso liberar esse endereço (ou rodar `npx shadcn add ...` em outro computador).

## Decisões da F1 (aprovadas em 30/10/2026)

1. **Cadastro de usuário com senha provisória**: o Administrador informa nome, e-mail, papel e uma senha
   provisória; a pessoa pode trocar a senha depois (página "Minha conta"). Sem e-mail de convite.
2. **Divisão F1/F2 no arrastar**: na F1, arrastar muda a etapa; soltar numa coluna de prazo só é aceito se o
   prazo atual já corresponder à coluna. O modal de ajuste de data, a confirmação de checklist e a recorrência
   ficam para a F2. (Para não gravar dados incoerentes, já na F1 mover para FINALIZADAS grava
   `completedAt`/`completedOnTime` e sair de FINALIZADAS os limpa.)
3. **Card na F1**: título, descrição (Markdown com pré-visualização), prazo, área, etiquetas, responsáveis e
   checklist. Comentários e anexos → F3; recorrência → F2.
4. **Login**: e-mail e senha primeiro; Google no final da F1, ativado pela variável `NEXT_PUBLIC_GOOGLE_LOGIN=true`.

- **P10.** Primeiro Administrador: variáveis `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD` na Vercel. Enquanto não
  existir nenhum usuário, entrar com esse e-mail e essa senha cria o Administrador.
- **P11.** Detalhes do card abrem numa janela sobre o quadro.
- **P12.** `react-markdown` para exibir Markdown (fora da lista da SPEC §9, necessário para a pré-visualização).
- **P13.** Quadros arquivados ficam numa seção "Arquivados", visível só ao Administrador, que pode restaurá-los.
- **P14.** Apenas tema claro por enquanto.
- **P15.** Botão "+ Nova tarefa" no topo do quadro, só para Administrador e Membro.
- **P16.** (a confirmar) Na mesma coluna, cards **sem prazo** ficam **depois** dos que têm prazo (entre si, por data de criação).

## Notas técnicas da F1

- O servidor acessa o banco com o Prisma (usuário dono das tabelas), e por isso **toda ação confere permissão
  no código** (`src/lib/auth/permissions.ts`). Além disso, todas as tabelas têm **RLS** ligado com políticas
  baseadas em `auth.uid()`: quem tentar acessar o banco diretamente pela chave pública do Supabase
  só enxerga o que o seu papel permite.
- Vercel: o comando `vercel-build` aplica as migrações (`prisma migrate deploy`) antes de montar o site.
- `cacheComponents` do Next.js 16 foi desligado: todas as telas dependem do usuário logado.
- Conexão com o banco: se `DATABASE_CA_CERT` (certificado do Supabase) estiver definida, a conexão é criptografada
  e verificada. Desativar a verificação de certificado não é permitido.
