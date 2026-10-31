-- CreateEnum
CREATE TYPE "CommentKind" AS ENUM ('COMMENT', 'REJECTION');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'COMMENT_MENTION';
ALTER TYPE "NotificationType" ADD VALUE 'COMMENT_ADDED';

-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "kind" "CommentKind" NOT NULL DEFAULT 'COMMENT';

-- ── Atualização ao vivo (Supabase Realtime) ──
-- O site escuta novos eventos do histórico (qualquer mudança em tarefas) e novos avisos.
-- As regras de RLS já existentes garantem que cada um só recebe o que pode ver.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (SELECT FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'card_events') THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.card_events';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notifications') THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
    END IF;
  END IF;
END $$;
