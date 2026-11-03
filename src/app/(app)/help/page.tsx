/* eslint-disable @next/next/no-img-element -- imagens estáticas da ajuda */
import { requireUser } from "@/lib/auth/session";
import { ROLE_LABELS, type Role } from "@/lib/auth/permissions";
import { BOARD_COLUMNS } from "@/lib/board/columns";

export const metadata = { title: "Ajuda · Kanban Marketing" };

const COLUMN_HELP: Record<string, string> = {
  NEW: "Tarefas ainda sem prazo. Ao receber um prazo, a tarefa sai daqui sozinha.",
  OVERDUE: "Prazo já passou. Ninguém arrasta para cá: a tarefa entra sozinha quando o prazo vence.",
  TODAY: "Vence hoje.",
  THIS_WEEK: "Vence de amanhã até domingo (a semana vai de segunda a domingo).",
  UPCOMING: "Vence depois deste domingo.",
  APPROVAL: "Aguardando a aprovação de quem criou a tarefa (ou de um Administrador).",
  CHANGES: "Foi reprovada e precisa de ajustes. O motivo aparece dentro da tarefa.",
  DONE: "Concluídas. O quadro mostra as dos últimos 30 dias; as mais antigas ficam em “Mostrar as mais antigas”.",
};

type Section = { id: string; title: string; roles: Role[]; body: React.ReactNode };

const ALL: Role[] = ["ADMIN", "MEMBER", "OBSERVER"];
const EDITORS: Role[] = ["ADMIN", "MEMBER"];

function Shot({ src, alt }: { src: string; alt: string }) {
  return <img src={src} alt={alt} loading="lazy" className="my-3 w-full max-w-3xl rounded-lg border shadow-sm" />;
}

const SECTIONS: Section[] = [
  {
    id: "inicio", title: "Primeiros passos", roles: ALL, body: (
      <ul>
        <li>Entre com o e-mail e a senha que o Administrador cadastrou para você.</li>
        <li>Para trocar a senha: clique no seu nome (canto superior direito) → <strong>Minha conta</strong>.</li>
        <li>Esqueceu a senha? Na tela de entrada, clique em <strong>Esqueci minha senha</strong> e siga o link enviado por e-mail (abra-o no mesmo navegador).</li>
        <li>Na tela inicial aparecem os quadros dos quais você participa, com quantas tarefas estão atrasadas, vencem hoje ou aguardam aprovação.</li>
      </ul>
    ),
  },
  {
    id: "quadro", title: "O quadro e as colunas", roles: ALL, body: (
      <>
        <p>As colunas de prazo são organizadas <strong>sozinhas</strong>, pela data de cada tarefa — ninguém precisa mover nada quando o dia vira.</p>
        <Shot src="/ajuda/quadro.png" alt="Quadro com as colunas e a barra de atalhos" />
        <ul>
          {BOARD_COLUMNS.map((c) => (
            <li key={c.key}><strong>{c.emoji} {c.label}:</strong> {COLUMN_HELP[c.key]}</li>
          ))}
        </ul>
        <p>A <strong>barra de atalhos</strong> (acima das colunas) mostra quantas tarefas há em cada coluna; clique para ir direto a ela.
          Em cada coluna, os prazos mais próximos vêm primeiro.</p>
        <h3>Filtros</h3>
        <Shot src="/ajuda/filtros.png" alt="Barra de filtros" />
        <p>Busque pelo título, veja só <strong>Minhas tarefas</strong> (em que você é responsável ou observador), ou filtre por responsável, área e etiqueta.
          O endereço da página guarda o filtro: dá para enviar o link para alguém.</p>
      </>
    ),
  },
  {
    id: "tarefas", title: "Tarefas", roles: ALL, body: (
      <>
        <Shot src="/ajuda/tarefa.png" alt="Janela de uma tarefa" />
        <ul>
          <li><strong>Criar</strong> (Administrador e Membro): botão <strong>+ Nova tarefa</strong>. Com prazo, a tarefa vai direto para a coluna do prazo; sem prazo, fica em NOVAS DEMANDAS.</li>
          <li><strong>Prazo</strong>: só quem criou a tarefa (ou um Administrador) pode mudar.</li>
          <li><strong>Repetir</strong>: todo dia, toda semana ou todo mês. Ao finalizar, a próxima tarefa da série é criada sozinha (ícone 🔁).</li>
          <li><strong>Responsáveis</strong> executam a tarefa. <strong>Observadores</strong> (usuários com papel Observador) só acompanham e recebem os avisos — quem criou a tarefa ou um Administrador os inclui. Digite parte do nome para encontrar a pessoa.</li>
          <li><strong>Checklist</strong>: crie listas de itens, marque o que for feito e use o lápis ✏️ para editar.</li>
          <li><strong>Anexos</strong>: até 10 MB por arquivo. Clique em <em>Anexar arquivo</em>, arraste o arquivo para a janela ou cole uma imagem (Ctrl + V). No menu “⋯” de uma imagem, use <em>Usar como capa</em>.</li>
          <li><strong>Comentários</strong>: todos podem comentar. Digite <strong>@</strong> para mencionar alguém — a pessoa recebe um aviso. Ctrl + Enter envia.</li>
          <li><strong>Histórico</strong>: no fim da tarefa, mostra quem fez o quê e quando.</li>
        </ul>
      </>
    ),
  },
  {
    id: "arrastar", title: "Arrastar tarefas", roles: EDITORS, body: (
      <ul>
        <li>Arraste o card para outra coluna. Enquanto arrasta, as colunas que aceitam ficam destacadas em verde.</li>
        <li>Ao soltar numa coluna de prazo que não combina com a data, abre uma janela sugerindo uma nova data
          (HOJE = hoje; ESTA SEMANA = sexta, ou amanhã se a sexta já chegou; PRÓXIMOS = segunda seguinte). Você pode escolher outra.</li>
        <li>NOVAS DEMANDAS só recebe tarefas sem prazo. ATRASADAS não recebe tarefas arrastadas.</li>
        <li>Ao levar para FINALIZADAS com itens da checklist pendentes, o sistema pergunta se pode marcá-los como concluídos.</li>
        <li>No celular, toque e segure o card por um instante para começar a arrastar.</li>
      </ul>
    ),
  },
  {
    id: "aprovacao", title: "Aprovação", roles: EDITORS, body: (
      <>
        <ol>
          <li>Terminou o trabalho? Na tarefa, clique em <strong>Enviar para aprovação</strong> (ou arraste para APROVAÇÃO). Quem criou a tarefa é avisado.</li>
          <li>Quem criou a tarefa (ou um Administrador) clica em <strong>Aprovar</strong> — vai para FINALIZADAS — ou <strong>Reprovar</strong>, escrevendo o motivo — vai para ALTERAÇÃO.</li>
          <li>O motivo da reprovação aparece em destaque na tarefa e na conversa. Depois de ajustar, envie para aprovação de novo.</li>
        </ol>
        <Shot src="/ajuda/aprovar-reprovar.png" alt="Botões Aprovar e Reprovar" />
        <p>Os cards que esperam a <strong>sua</strong> aprovação têm o selo roxo <em>Sua aprovação</em>.</p>
      </>
    ),
  },
  {
    id: "avisos", title: "Avisos (sininho)", roles: ALL, body: (
      <>
        <Shot src="/ajuda/sininho.png" alt="Lista de avisos do sininho" />
        <ul>
          <li>O número vermelho mostra os avisos não lidos. Clique num aviso para abrir a tarefa.</li>
          <li>Você é avisado quando: alguém menciona você; comentam numa tarefa em que você é responsável, observador ou que você criou;
            uma tarefa sua chega para aprovação; uma tarefa é aprovada ou reprovada; nasce a próxima tarefa de uma série.</li>
          <li>As telas se atualizam sozinhas quando outra pessoa mexe no quadro.</li>
        </ul>
      </>
    ),
  },
  {
    id: "papeis", title: "Quem pode o quê", roles: ALL, body: (
      <div className="overflow-x-auto">
        <table>
          <thead><tr><th>Ação</th><th>Administrador</th><th>Membro</th><th>Observador</th></tr></thead>
          <tbody>
            <tr><td>Ver quadros</td><td>todos</td><td>os seus</td><td>os seus</td></tr>
            <tr><td>Criar, editar e mover tarefas</td><td>✅</td><td>✅</td><td>—</td></tr>
            <tr><td>Mudar prazo e repetição</td><td>✅</td><td>só tarefas que criou</td><td>—</td></tr>
            <tr><td>Incluir observadores</td><td>✅</td><td>só tarefas que criou</td><td>—</td></tr>
            <tr><td>Aprovar ou reprovar</td><td>✅</td><td>só tarefas que criou</td><td>—</td></tr>
            <tr><td>Comentar</td><td>✅</td><td>✅</td><td>✅</td></tr>
            <tr><td>Excluir tarefa, configurar quadros, usuários e Dashboard</td><td>✅</td><td>—</td><td>—</td></tr>
          </tbody>
        </table>
      </div>
    ),
  },
  {
    id: "admin", title: "Administração", roles: ["ADMIN"], body: (
      <>
        <ul>
          <li><strong>Quadros</strong>: na tela inicial, <em>Novo quadro</em>. Em <strong>Configurações</strong> do quadro: nome, arquivar, acesso das pessoas, áreas solicitantes, etiquetas e <strong>Lixeira</strong>.</li>
          <li><strong>Lixeira</strong>: tarefas excluídas podem ser <em>restauradas</em> (voltam para onde estavam) ou <em>excluídas definitivamente</em> (apaga tudo, inclusive arquivos).</li>
          <li><strong>Áreas e etiquetas</strong> em uso não podem ser excluídas — desative-as para sumirem das opções sem afetar as tarefas antigas.</li>
          <li><strong>Usuários</strong>: cadastre com senha provisória; no menu “⋯” edite nome, papel e e-mail, redefina a senha ou desative (a pessoa não entra mais; o histórico fica).</li>
          <li>Depois de cadastrar alguém, lembre de dar <strong>acesso aos quadros</strong> (Configurações → Acesso).</li>
        </ul>
        <h3>Dashboard</h3>
        <Shot src="/ajuda/dashboard.png" alt="Dashboard com indicadores" />
        <p>Filtre por período, quadros e área. Mostra tarefas concluídas, % entregue no prazo, atrasadas agora, tempo de entrega,
          volume por semana/mês, áreas que mais pedem, carga por pessoa, tempo em aprovação e retrabalho.
          Cada gráfico tem “Ver dados em tabela”.</p>
      </>
    ),
  },
];

export default async function HelpPage() {
  const user = await requireUser();
  const sections = SECTIONS.filter((s) => s.roles.includes(user.role));
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold">Ajuda</h1>
      <p className="text-sm text-muted-foreground">Seu papel: <strong>{ROLE_LABELS[user.role]}</strong>. Esta página mostra o que vale para você.</p>

      <nav aria-label="Assuntos" className="my-6 flex flex-wrap gap-2">
        {sections.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="rounded-full border bg-background px-3 py-1 text-sm hover:bg-accent">{s.title}</a>
        ))}
      </nav>

      <div className="help space-y-10">
        {sections.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-20 rounded-xl border bg-background p-5">
            <h2 className="mb-3 text-lg font-semibold">{s.title}</h2>
            {s.body}
          </section>
        ))}
      </div>
    </main>
  );
}
