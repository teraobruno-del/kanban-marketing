-- AlterEnum
ALTER TYPE "CardEventType" ADD VALUE 'OBSERVERS_CHANGED';

-- CreateTable
CREATE TABLE "card_observers" (
    "card_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "added_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_observers_pkey" PRIMARY KEY ("card_id","user_id")
);

-- CreateIndex
CREATE INDEX "card_observers_user_id_idx" ON "card_observers"("user_id");

-- AddForeignKey
ALTER TABLE "card_observers" ADD CONSTRAINT "card_observers_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_observers" ADD CONSTRAINT "card_observers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Segurança (RLS): ver quem tem acesso ao quadro; incluir/retirar só quem criou a tarefa ou Administrador ──
CREATE OR REPLACE FUNCTION public.app_card_creator(p_card_id uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT created_by_id FROM cards WHERE id = p_card_id
$$;
REVOKE EXECUTE ON FUNCTION public.app_card_creator(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.app_card_creator(uuid) TO authenticated;

ALTER TABLE card_observers ENABLE ROW LEVEL SECURITY;
CREATE POLICY card_observers_select ON card_observers FOR SELECT TO authenticated
  USING (app_can_access_board(app_card_board(card_id)));
CREATE POLICY card_observers_write ON card_observers FOR ALL TO authenticated
  USING (app_can_edit_board(app_card_board(card_id)) AND (app_is_admin() OR app_card_creator(card_id) = auth.uid()))
  WITH CHECK (app_can_edit_board(app_card_board(card_id)) AND (app_is_admin() OR app_card_creator(card_id) = auth.uid()));
