-- Segurança no banco (RLS) — SPEC §7: permissões validadas no servidor E por RLS.
--
-- O servidor (Prisma) conecta como dono das tabelas e não é afetado pelo RLS: lá, as permissões
-- são conferidas no código (src/lib/auth/permissions.ts). Estas políticas protegem o acesso
-- direto ao banco pela API do Supabase (chave pública + login do usuário), usado no Realtime.
--
-- Sem política = acesso negado. O papel "anon" (não logado) não recebe nenhuma política.

-- ── Compatibilidade: no Supabase isto já existe; em bancos locais/de teste, cria o mínimo. ──
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_namespace WHERE nspname = 'auth') THEN
    EXECUTE 'CREATE SCHEMA auth';
  END IF;
  IF NOT EXISTS (
    SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    EXECUTE $f$
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      'SELECT nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid'
    $f$;
  END IF;
END $$;

-- ── Funções auxiliares (SECURITY DEFINER para consultar users/board_members sem recursão de RLS) ──

CREATE OR REPLACE FUNCTION public.app_current_role() RETURNS "Role"
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM users WHERE id = auth.uid() AND is_active
$$;

CREATE OR REPLACE FUNCTION public.app_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(app_current_role() = 'ADMIN', false)
$$;

CREATE OR REPLACE FUNCTION public.app_can_access_board(p_board_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app_is_admin() OR (
    app_current_role() IS NOT NULL
    AND EXISTS (SELECT 1 FROM board_members WHERE board_id = p_board_id AND user_id = auth.uid())
  )
$$;

CREATE OR REPLACE FUNCTION public.app_can_edit_board(p_board_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app_can_access_board(p_board_id) AND app_current_role() IN ('ADMIN', 'MEMBER')
$$;

CREATE OR REPLACE FUNCTION public.app_card_board(p_card_id uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT board_id FROM cards WHERE id = p_card_id
$$;

CREATE OR REPLACE FUNCTION public.app_checklist_board(p_checklist_id uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.board_id FROM checklists cl JOIN cards c ON c.id = cl.card_id WHERE cl.id = p_checklist_id
$$;

CREATE OR REPLACE FUNCTION public.app_comment_board(p_comment_id uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.board_id FROM comments cm JOIN cards c ON c.id = cm.card_id WHERE cm.id = p_comment_id
$$;

REVOKE EXECUTE ON FUNCTION
  public.app_current_role(), public.app_is_admin(), public.app_can_access_board(uuid),
  public.app_can_edit_board(uuid), public.app_card_board(uuid), public.app_checklist_board(uuid),
  public.app_comment_board(uuid)
FROM anon, public;
GRANT EXECUTE ON FUNCTION
  public.app_current_role(), public.app_is_admin(), public.app_can_access_board(uuid),
  public.app_can_edit_board(uuid), public.app_card_board(uuid), public.app_checklist_board(uuid),
  public.app_comment_board(uuid)
TO authenticated;

-- ── Liga o RLS em todas as tabelas ──
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE requester_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_events ENABLE ROW LEVEL SECURITY;
-- Tabela interna do Prisma: RLS sem políticas = invisível pela API (só existe fora do banco-sombra).
DO $$ BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- ── Usuários: qualquer usuário ativo vê a lista (para escolher responsáveis); só Admin altera ──
CREATE POLICY users_select ON users FOR SELECT TO authenticated
  USING (app_current_role() IS NOT NULL);
CREATE POLICY users_admin_write ON users FOR ALL TO authenticated
  USING (app_is_admin()) WITH CHECK (app_is_admin());

-- ── Quadros e configurações: ver se tem acesso; alterar só Admin ──
CREATE POLICY boards_select ON boards FOR SELECT TO authenticated
  USING (app_can_access_board(id));
CREATE POLICY boards_admin_write ON boards FOR ALL TO authenticated
  USING (app_is_admin()) WITH CHECK (app_is_admin());

CREATE POLICY board_members_select ON board_members FOR SELECT TO authenticated
  USING (app_can_access_board(board_id));
CREATE POLICY board_members_admin_write ON board_members FOR ALL TO authenticated
  USING (app_is_admin()) WITH CHECK (app_is_admin());

CREATE POLICY requester_areas_select ON requester_areas FOR SELECT TO authenticated
  USING (app_can_access_board(board_id));
CREATE POLICY requester_areas_admin_write ON requester_areas FOR ALL TO authenticated
  USING (app_is_admin()) WITH CHECK (app_is_admin());

CREATE POLICY labels_select ON labels FOR SELECT TO authenticated
  USING (app_can_access_board(board_id));
CREATE POLICY labels_admin_write ON labels FOR ALL TO authenticated
  USING (app_is_admin()) WITH CHECK (app_is_admin());

-- ── Cards ──
CREATE POLICY cards_select ON cards FOR SELECT TO authenticated
  USING (app_can_access_board(board_id) AND (deleted_at IS NULL OR app_is_admin()));
CREATE POLICY cards_insert ON cards FOR INSERT TO authenticated
  WITH CHECK (app_can_edit_board(board_id) AND created_by_id = auth.uid());
CREATE POLICY cards_update ON cards FOR UPDATE TO authenticated
  USING (app_can_edit_board(board_id) AND deleted_at IS NULL)
  WITH CHECK (app_can_edit_board(board_id));
CREATE POLICY cards_delete ON cards FOR DELETE TO authenticated
  USING (app_is_admin());

-- Regras por coluna que o RLS sozinho não expressa (só valem para acesso pela API do Supabase,
-- quando há usuário logado; o servidor confere as mesmas regras no código).
CREATE OR REPLACE FUNCTION public.app_cards_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR app_is_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.due_date IS DISTINCT FROM OLD.due_date AND OLD.created_by_id <> auth.uid() THEN
    RAISE EXCEPTION 'Sem permissão para alterar o prazo deste card';
  END IF;
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at OR NEW.deleted_by_id IS DISTINCT FROM OLD.deleted_by_id THEN
    RAISE EXCEPTION 'Só o Administrador pode excluir cards';
  END IF;
  IF NEW.created_by_id IS DISTINCT FROM OLD.created_by_id OR NEW.board_id IS DISTINCT FROM OLD.board_id THEN
    RAISE EXCEPTION 'Campo não pode ser alterado';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER cards_guard BEFORE UPDATE ON cards
  FOR EACH ROW EXECUTE FUNCTION public.app_cards_guard();

CREATE POLICY card_assignees_select ON card_assignees FOR SELECT TO authenticated
  USING (app_can_access_board(app_card_board(card_id)));
CREATE POLICY card_assignees_write ON card_assignees FOR ALL TO authenticated
  USING (app_can_edit_board(app_card_board(card_id)))
  WITH CHECK (app_can_edit_board(app_card_board(card_id)));

CREATE POLICY card_labels_select ON card_labels FOR SELECT TO authenticated
  USING (app_can_access_board(app_card_board(card_id)));
CREATE POLICY card_labels_write ON card_labels FOR ALL TO authenticated
  USING (app_can_edit_board(app_card_board(card_id)))
  WITH CHECK (app_can_edit_board(app_card_board(card_id)));

CREATE POLICY checklists_select ON checklists FOR SELECT TO authenticated
  USING (app_can_access_board(app_card_board(card_id)));
CREATE POLICY checklists_write ON checklists FOR ALL TO authenticated
  USING (app_can_edit_board(app_card_board(card_id)))
  WITH CHECK (app_can_edit_board(app_card_board(card_id)));

CREATE POLICY checklist_items_select ON checklist_items FOR SELECT TO authenticated
  USING (app_can_access_board(app_checklist_board(checklist_id)));
CREATE POLICY checklist_items_write ON checklist_items FOR ALL TO authenticated
  USING (app_can_edit_board(app_checklist_board(checklist_id)))
  WITH CHECK (app_can_edit_board(app_checklist_board(checklist_id)));

-- ── Anexos ──
CREATE POLICY attachments_select ON attachments FOR SELECT TO authenticated
  USING (app_can_access_board(app_card_board(card_id)));
CREATE POLICY attachments_insert ON attachments FOR INSERT TO authenticated
  WITH CHECK (app_can_edit_board(app_card_board(card_id)) AND uploaded_by_id = auth.uid());
CREATE POLICY attachments_delete ON attachments FOR DELETE TO authenticated
  USING (app_can_edit_board(app_card_board(card_id)));

-- ── Comentários: todos com acesso ao quadro (inclusive Observador) podem comentar ──
CREATE POLICY comments_select ON comments FOR SELECT TO authenticated
  USING (app_can_access_board(app_card_board(card_id)));
CREATE POLICY comments_insert ON comments FOR INSERT TO authenticated
  WITH CHECK (app_can_access_board(app_card_board(card_id)) AND author_id = auth.uid());
CREATE POLICY comments_update ON comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR app_is_admin())
  WITH CHECK (author_id = auth.uid() OR app_is_admin());
CREATE POLICY comments_delete ON comments FOR DELETE TO authenticated
  USING (app_is_admin());

CREATE POLICY comment_mentions_select ON comment_mentions FOR SELECT TO authenticated
  USING (app_can_access_board(app_comment_board(comment_id)));
CREATE POLICY comment_mentions_insert ON comment_mentions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM comments c WHERE c.id = comment_id AND c.author_id = auth.uid()));

-- ── Eventos: leitura para quem acessa o quadro; gravação só em nome próprio; nunca editar/apagar ──
CREATE POLICY card_events_select ON card_events FOR SELECT TO authenticated
  USING (app_can_access_board(board_id));
CREATE POLICY card_events_insert ON card_events FOR INSERT TO authenticated
  WITH CHECK (app_can_access_board(board_id) AND actor_id = auth.uid());
