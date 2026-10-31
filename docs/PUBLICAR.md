# Como publicar o site (Supabase + Vercel)

Guia passo a passo. Você vai copiar alguns valores do Supabase e colá-los **na Vercel**.
Nunca cole senhas ou chaves no chat nem em arquivos do projeto.

Dica: abra um bloco de notas **só seu** para juntar os valores temporariamente e apague no final.

---

## Parte 1 — Copiar os dados do Supabase

Entre em **supabase.com**, abra o projeto `kanban-marketing`.

### 1.1 Endereços do banco
1. Clique no botão **Connect** (no topo da página do projeto).
2. Procure a seção **Connection String** e o tipo **URI**.
3. Copie a linha de **Transaction pooler** (tem `:6543` no final). Esta será a `DATABASE_URL`.
4. Copie a linha de **Session pooler** (tem `:5432`). Esta será a `DIRECT_URL`.
5. Nas duas, troque `[YOUR-PASSWORD]` pela senha do banco que você guardou ao criar o projeto
   (sem os colchetes).

> Esqueceu a senha? Em **Project Settings → Database → Reset database password** você cria outra.

### 1.2 Chaves de acesso
1. Vá em **Project Settings** (engrenagem) → **API Keys**.
2. Copie a **Publishable key** (começa com `sb_publishable_`).
3. Copie a **Secret key** (começa com `sb_secret_`; clique para revelar). **Esta é secreta.**
4. Em **Project Settings → Data API** (ou na página inicial do projeto), copie a **Project URL**
   (algo como `https://abcdefgh.supabase.co`).

### 1.3 Fechar o cadastro aberto
1. Vá em **Authentication → Sign In / Providers** (ou **Settings**).
2. **Desligue** a opção **Allow new users to sign up**.
   (Só o Administrador cadastra usuários — SPEC §7.)
3. Clique em **Save**.

---

## Parte 2 — Publicar na Vercel

1. Entre em **vercel.com** → **Add New… → Project**.
2. Em **Import Git Repository**, escolha `kanban-marketing` (se não aparecer, clique em
   **Adjust GitHub App Permissions** e libere o repositório).
3. Em **Framework Preset**, deve aparecer **Next.js** (deixe como está).
4. Abra **Environment Variables** e cadastre uma por uma (nome à esquerda, valor à direita):

| Nome | Valor |
|---|---|
| `DATABASE_URL` | Transaction pooler (porta 6543), com a senha |
| `DIRECT_URL` | Session pooler (porta 5432), com a senha |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key |
| `SUPABASE_SECRET_KEY` | Secret key |
| `INITIAL_ADMIN_EMAIL` | o seu e-mail (será o primeiro Administrador) |
| `INITIAL_ADMIN_PASSWORD` | uma senha forte, com 8+ caracteres, que você vai usar no primeiro acesso |
| `NEXT_PUBLIC_GOOGLE_LOGIN` | `false` |

5. Clique em **Deploy** e aguarde (2–4 minutos). A Vercel cria as tabelas no Supabase sozinha.
6. Quando aparecer "Congratulations", clique em **Continue to Dashboard** e depois em **Visit**.
   Anote o endereço do site (ex.: `https://kanban-marketing.vercel.app`).

### Primeiro acesso
1. Entre com o `INITIAL_ADMIN_EMAIL` e a `INITIAL_ADMIN_PASSWORD`.
2. Pronto: você é o Administrador. Vá em **Minha conta** e troque a senha, se quiser.
3. Crie um quadro → cadastre **áreas** e **etiquetas** → em **Usuários**, cadastre as pessoas
   → volte às **Configurações do quadro** e marque quem tem acesso.

> Depois que existir algum usuário, `INITIAL_ADMIN_EMAIL`/`INITIAL_ADMIN_PASSWORD` não fazem mais nada.

---

## Parte 3 (opcional) — Conexão com o banco criptografada e verificada

1. No Supabase: **Project Settings → Database → SSL Configuration → Download certificate**.
2. Abra o arquivo baixado num editor de texto, copie **todo** o conteúdo
   (de `-----BEGIN CERTIFICATE-----` até `-----END CERTIFICATE-----`).
3. Na Vercel: **Settings → Environment Variables**, crie `DATABASE_CA_CERT` e cole o conteúdo.
4. Em **Deployments**, clique nos três pontinhos do último deploy → **Redeploy**.

---

## Parte 4 (final da F1) — Login com Google

Faça só quando o resto estiver funcionando. Passo a passo:

### 4.1 No Google Cloud
1. Acesse **console.cloud.google.com** e crie um projeto (ex.: "Kanban Marketing").
2. Menu → **APIs & Services → OAuth consent screen** (ou **Google Auth Platform**):
   - Tipo de usuário: **External** (ou **Internal**, se a empresa usa Google Workspace).
   - Nome do app: Kanban Marketing; e-mail de suporte: o seu. Salve.
3. Menu → **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized redirect URIs**: cole o endereço que o Supabase mostra no passo 4.2
     (algo como `https://abcdefgh.supabase.co/auth/v1/callback`).
   - Clique em **Create** e copie o **Client ID** e o **Client secret**.

### 4.2 No Supabase
1. **Authentication → Sign In / Providers → Google**: ligue, cole o **Client ID** e o
   **Client secret**, copie a **Callback URL** mostrada (use no passo 4.1) e salve.
2. **Authentication → URL Configuration**:
   - **Site URL**: o endereço do site na Vercel.
   - **Redirect URLs**: adicione `https://SEU-SITE.vercel.app/auth/callback`.

### 4.3 Na Vercel
1. Mude `NEXT_PUBLIC_GOOGLE_LOGIN` para `true` e faça **Redeploy**.
2. O botão "Entrar com Google" aparece na tela de login. Só entra quem já foi cadastrado
   pelo Administrador com o mesmo e-mail.

---

## Parte 5 — Conferir anexos e atualização ao vivo (F3)

Nada para configurar: o espaço privado de arquivos (`attachments`) é criado sozinho no primeiro envio,
e a atualização ao vivo é ligada pela própria publicação.

Para conferir a atualização ao vivo:
1. Abra o site em duas janelas: uma normal (Administrador) e uma anônima (um Membro).
2. Nas duas, abra o mesmo quadro.
3. Na janela do Membro, arraste uma tarefa ou comente nela.
4. A janela do Administrador deve mudar sozinha em cerca de 1 segundo (sem recarregar a página).
   Se demorar até 30 segundos, a conexão ao vivo não abriu e o plano B está funcionando — avise.
