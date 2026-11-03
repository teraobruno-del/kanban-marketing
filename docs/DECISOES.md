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
- **P16.** (confirmada) Na mesma coluna, cards **sem prazo** ficam **depois** dos que têm prazo (entre si, por data de criação).

## Notas técnicas da F1

- O servidor acessa o banco com o Prisma (usuário dono das tabelas), e por isso **toda ação confere permissão
  no código** (`src/lib/auth/permissions.ts`). Além disso, todas as tabelas têm **RLS** ligado com políticas
  baseadas em `auth.uid()`: quem tentar acessar o banco diretamente pela chave pública do Supabase
  só enxerga o que o seu papel permite.
- Vercel: o comando `vercel-build` aplica as migrações (`prisma migrate deploy`) antes de montar o site.
- `cacheComponents` do Next.js 16 foi desligado: todas as telas dependem do usuário logado.
- Conexão com o banco: se `DATABASE_CA_CERT` (certificado do Supabase) estiver definida, a conexão é criptografada
  e verificada. Desativar a verificação de certificado não é permitido.

## Decisões da F1.5 — Aprovação (aprovadas em 30/10/2026)

O dono pediu um fluxo de aprovação no sistema (antes era "fora do sistema"). A SPEC foi atualizada (§6.E, §7, §10).

1. **Aprovadores**: quem criou o card **ou** qualquer Administrador.
2. **Envio**: botão "Enviar para aprovação" **ou** arrastar para APROVAÇÃO — os dois avisam o criador.
3. **Saída de APROVAÇÃO**: só aprovadores, pelos botões Aprovar (→ FINALIZADAS) / Reprovar (→ ALTERAÇÃO).
   Arrastar para FINALIZADAS = Aprovar; para ALTERAÇÃO = abre o motivo; outras colunas: bloqueado.
4. **Reprovar exige motivo** (fica no histórico e em destaque no card).
5. **Avisos dentro do sistema** (sininho com contador); sem e-mail por enquanto.
6. **Ordem das fases**: F1.5 (aprovação) → F2 → F3 → F4 (dashboard).

## Decisões da F2 — Automações (aprovadas em 30/10/2026)

Comentários continuam na F3 (ordem normal das fases).

1. **Janela de data ao arrastar**: vem com a data sugerida (HOJE = hoje; ESTA SEMANA = sexta, ou amanhã se a sexta
   já chegou — bloqueado no domingo; PRÓXIMOS = segunda seguinte), mas aceita qualquer data **a partir de hoje**;
   a janela mostra para qual coluna a tarefa vai.
2. **Recorrência**: ligar/desligar/alterar = mesma permissão de mudar o prazo (Administrador ou quem criou).
3. **Nova tarefa da série avisa os responsáveis** no sininho.

- **P22.** Sem permissão de prazo: sem janela; só entra na coluna de prazo se a data já combinar.
- **P23.** Confirmação de checklist vale para todo caminho até FINALIZADAS (arrastar ou Aprovar); cancelar não move.
- **P24.** Recorrência exige prazo.
- **P25.** A nova tarefa copia título, descrição, área, etiquetas ativas, responsáveis (que ainda podem ser),
  criador, checklists (itens desmarcados) e a configuração de recorrência.
- **P26.** Só a primeira finalização gera a próxima (idempotente).
- **P27.** Desligar a recorrência vale dali em diante.
- **P28.** Ícone 🔁 no quadro e resumo "Repete todo mês, até …" na tarefa.
- **P29.** Tarefa na lixeira nunca gera a próxima.
- Mudar o prazo de uma tarefa mensal recorrente redefine o "dia original" da série para o dia do novo prazo.

## Decisões da F3 — Colaboração (aprovadas em 31/10/2026)

1. **Avisos de comentário**: mencionados com @ + responsáveis + quem criou (nunca quem comentou).
   Quem foi mencionado recebe "mencionou você"; os demais, "comentou".
2. **@menção**: qualquer pessoa com acesso ao quadro (inclusive Observadores; Administradores sempre).
3. **Editar/excluir comentário**: cada um os próprios; Administrador exclui qualquer um.
   Mostra "(editado)" e "comentário excluído".
4. **Ordem**: campo de escrever no topo, mais recentes primeiro.
5. **Reprovação** também vira um comentário destacado na conversa.
6. **Anexos**: qualquer tipo até 10 MB, exceto executáveis (.exe, .bat, .cmd, .msi, .sh, .ps1, .vbs, .jar, .apk…).
7. **Excluir anexo**: quem enviou ou Administrador.
8. **Ao vivo**: tarefa aberta se atualiza sozinha; se você estiver editando, aparece "alterada por outra pessoa" + Recarregar.

- **P17** Markdown nos comentários · **P18** @ abre lista de pessoas; nome mencionado destacado ·
  **P19** 💬 e 📎 com contagens no card · **P21** histórico registra "comentou" sem o texto.
- **P30** Anexar por botão, arrastando o arquivo ou colando imagem (Ctrl+V).
- **P31** Arquivos privados no Supabase Storage (bucket `attachments`, criado automaticamente);
  envio direto do navegador por link assinado (o servidor confere permissão e tamanho); abertura por links temporários.
- **P32** Miniaturas de imagens; imagem escolhida como capa aparece no topo do card. SVG é tratado como arquivo (não vira capa).
- **P33** Lixeira mantém arquivos; excluir quadro apaga os arquivos dele.
- **P34** Plano B: sem conexão ao vivo, a tela se atualiza a cada 30 s.

## Decisões da F4 — Dashboard (aprovadas em 02/11/2026)

1. **Áreas juntadas pelo nome** entre quadros (sem diferenciar maiúsculas/acentos de digitação: "RH" = "rh").
2. **Quadros arquivados entram** nos números; no filtro aparecem como "(arquivado)".
3. **Retrabalho**: média de ciclos calculada só entre as tarefas que tiveram retrabalho.
4. **Áreas demandantes**: barras horizontais, da maior para a menor.
5. **Volume**: agrupamento automático (mês → semanas; trimestre/ano/intervalo longo → meses), com botão para trocar.

- **P35** Volume: criadas por data de criação, concluídas por data de conclusão. No prazo, tempo de entrega,
  gargalo e retrabalho: tarefas concluídas no período. Áreas: criadas no período. Carga por pessoa e
  "atrasadas agora": foto do momento (respeitam quadro e área, não o período).
- **P36** Semanas de segunda a domingo; meses do calendário; sempre no horário de São Paulo.
- **P37** Lixeira fora; sem prazo fora do % no prazo.
- **P38** Reaberta e finalizada de novo conta uma vez (última conclusão).
- **P39** Carga: conta para cada responsável; "Sem responsável" aparece; NOVAS DEMANDAS fora.
- **P40** Gargalo soma todas as passagens por APROVAÇÃO; mostra também quantas aguardam agora e a mais antiga.
- **P41** Tempos como "2 d 5 h"; período padrão = mês atual.
- **P42** Item "Dashboard" no menu, só para Administrador; funciona no celular.

## Observadores da tarefa (aprovado em 03/11/2026)

O dono pediu, nos cards, o campo **Observadores**, separado de Responsáveis.

- Observadores da tarefa são os **usuários com papel Observador** (com acesso ao quadro), marcados nas tarefas que vão acompanhar.
  Responsáveis continuam sendo Administradores e Membros (decisão 7A) — por isso ninguém fica nas duas listas.
- **Quem inclui/retira observadores**: quem criou a tarefa e os Administradores.
- **Avisos**: os mesmos dos responsáveis (comentários, aprovada/reprovada, nova tarefa da série).
- Responsáveis e Observadores escolhidos numa **lista compacta com busca** (filtra ao digitar, ignora acentos,
  busca por nome ou e-mail). Etiquetas continuam como botões.
- **P43** A recorrência copia os observadores (que ainda puderem ser) · **P44** card mostra 👁 com o número de
  observadores · **P45** incluir/retirar observadores fica no histórico.

## Melhorias pós-SPEC (aprovadas em 03/11/2026)

Login com Google não será usado (fica desligado: `NEXT_PUBLIC_GOOGLE_LOGIN=false`).

1. **Lixeira** numa aba das Configurações de cada quadro (só Administrador): **Restaurar** (volta para onde estava)
   e **Excluir definitivamente** (com confirmação; apaga também os arquivos e o histórico da tarefa).
2. **FINALIZADAS** mostra as concluídas nos **últimos 30 dias**; botão "Mostrar as mais antigas (N)". O Dashboard conta todas.
3. **Filtros no quadro**: busca por título, "Minhas tarefas" (sou responsável ou observador), responsável, área e etiqueta.
   Ficam no endereço da página (link compartilhável); abrir o quadro pelo menu volta sem filtro.
4. **P46** Administrador edita o e-mail do usuário; o login passa a ser o novo e-mail (sem confirmação); recusa e-mail em uso.
5. **"Esqueci minha senha"** com o envio de e-mails do próprio Supabase (gratuito, poucos e-mails por hora).
   Resposta sempre neutra ("se o e-mail estiver cadastrado…"), para não revelar quem tem conta.
6. **Ajuda** dentro do sistema, com imagens, organizada por papel.
