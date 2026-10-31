import { randomUUID } from "node:crypto";
import type { Db } from "@/lib/db/client";
import { canDeleteAttachment, canEditCards, type Actor } from "@/lib/auth/permissions";
import { attachmentProblem, isPreviewableImage, safeStorageName } from "@/lib/attachments";
import { MAX_ATTACHMENT_BYTES } from "@/lib/constants";
import { forbidden, invalid, notFound } from "@/server/errors";
import { loadBoardAccess } from "./boards";

/**
 * Armazenamento de arquivos (Supabase Storage em produção; versão falsa nos testes).
 * Os arquivos ficam privados: o navegador envia por link assinado e abre por link temporário (P31).
 */
export interface StoragePort {
  createUploadUrl(path: string): Promise<{ token: string; signedUrl: string }>;
  /** Tamanho real do arquivo guardado, ou null se não existe. */
  getObjectSize(path: string): Promise<number | null>;
  createDownloadUrls(paths: string[], expiresInSeconds: number): Promise<Record<string, string>>;
  remove(paths: string[]): Promise<void>;
}

const URL_TTL = 60 * 60; // links temporários de 1 hora

async function loadEditableCard(db: Db, actor: Actor, cardId: string) {
  const card = await db.card.findUnique({ where: { id: cardId } });
  if (!card || card.deletedAt) throw notFound("Tarefa não encontrada.");
  const { access } = await loadBoardAccess(db, actor, card.boardId);
  if (!canEditCards(actor, access)) throw forbidden();
  return { card, access };
}

const cardFolder = (card: { boardId: string; id: string }) => `${card.boardId}/${card.id}/`;

/** 1º passo do envio: confere permissão e arquivo; devolve o link de envio direto para o armazenamento. */
export async function prepareUpload(
  db: Db, storage: StoragePort, actor: Actor, cardId: string, file: { name: string; size: number },
) {
  const { card } = await loadEditableCard(db, actor, cardId);
  const problem = attachmentProblem(file);
  if (problem) throw invalid(problem);
  const path = `${cardFolder(card)}${randomUUID()}-${safeStorageName(file.name)}`;
  const { token, signedUrl } = await storage.createUploadUrl(path);
  return { path, token, signedUrl };
}

/** 2º passo: o arquivo já está no armazenamento; confere o tamanho real no servidor e registra o anexo. */
export async function confirmUpload(
  db: Db, storage: StoragePort, actor: Actor, cardId: string,
  input: { path: string; name: string; mimeType: string }, now = new Date(),
) {
  const { card } = await loadEditableCard(db, actor, cardId);
  if (!input.path.startsWith(cardFolder(card)) || input.path.includes("..")) throw invalid("Arquivo inválido.");
  const size = await storage.getObjectSize(input.path);
  if (size === null) throw invalid("O envio do arquivo não foi concluído. Tente de novo.");
  const problem = attachmentProblem({ name: input.name, size });
  if (problem) {
    await storage.remove([input.path]); // validação no servidor (SPEC §5): apaga o que passou do limite
    throw invalid(problem);
  }
  const mimeType = (input.mimeType || "application/octet-stream").slice(0, 120);
  return db.$transaction(async (tx) => {
    const att = await tx.attachment.create({
      data: {
        cardId, uploadedById: actor.id, fileName: input.name.slice(0, 200), storagePath: input.path,
        mimeType, sizeBytes: size, isImage: isPreviewableImage(mimeType, input.name), createdAt: now,
      },
    });
    await tx.cardEvent.create({
      data: { cardId, boardId: card.boardId, actorId: actor.id, type: "ATTACHMENT_ADDED", data: { name: att.fileName }, createdAt: now },
    });
    return { id: att.id };
  });
}

/** Anexos da tarefa, com links temporários para abrir/baixar. */
export async function listAttachments(db: Db, storage: StoragePort | undefined, cardId: string) {
  const rows = await db.attachment.findMany({
    where: { cardId },
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: { select: { id: true, name: true } } },
  });
  const urls = storage && rows.length ? await storage.createDownloadUrls(rows.map((r) => r.storagePath), URL_TTL) : {};
  return rows.map((r) => ({
    id: r.id,
    name: r.fileName,
    mimeType: r.mimeType,
    size: r.sizeBytes,
    isImage: r.isImage,
    uploadedBy: r.uploadedBy,
    createdAt: r.createdAt.toISOString(),
    url: urls[r.storagePath] ?? null,
  }));
}

/** Excluir anexo: quem enviou ou Administrador (decisão F3-7A). Apaga também o arquivo guardado. */
export async function deleteAttachment(db: Db, storage: StoragePort, actor: Actor, attachmentId: string, now = new Date()) {
  const att = await db.attachment.findUnique({ where: { id: attachmentId }, include: { card: true } });
  if (!att || att.card.deletedAt) throw notFound("Anexo não encontrado.");
  const { access } = await loadBoardAccess(db, actor, att.card.boardId);
  if (!canDeleteAttachment(actor, access, att)) throw forbidden("Só quem enviou ou um Administrador pode excluir este anexo.");
  await db.$transaction(async (tx) => {
    await tx.card.updateMany({ where: { coverAttachmentId: attachmentId }, data: { coverAttachmentId: null } });
    await tx.attachment.delete({ where: { id: attachmentId } });
    await tx.cardEvent.create({
      data: { cardId: att.cardId, boardId: att.card.boardId, actorId: actor.id, type: "ATTACHMENT_REMOVED", data: { name: att.fileName }, createdAt: now },
    });
  });
  await storage.remove([att.storagePath]);
}

/** Definir (ou tirar) a capa: só imagens anexadas à própria tarefa (P32). */
export async function setCover(db: Db, actor: Actor, cardId: string, attachmentId: string | null, now = new Date()) {
  const { card } = await loadEditableCard(db, actor, cardId);
  if (attachmentId) {
    const att = await db.attachment.findUnique({ where: { id: attachmentId } });
    if (!att || att.cardId !== cardId) throw invalid("Anexo inválido.");
    if (!att.isImage) throw invalid("Só imagens podem ser capa.");
  }
  if (card.coverAttachmentId === attachmentId) return;
  await db.$transaction(async (tx) => {
    await tx.card.update({ where: { id: cardId }, data: { coverAttachmentId: attachmentId } });
    await tx.cardEvent.create({
      data: { cardId, boardId: card.boardId, actorId: actor.id, type: "COVER_CHANGED", data: { removed: attachmentId === null }, createdAt: now },
    });
  });
}

/** Caminhos de todos os arquivos de um quadro (para apagar junto com o quadro — P33). */
export async function boardAttachmentPaths(db: Db, boardId: string) {
  const rows = await db.attachment.findMany({ where: { card: { boardId } }, select: { storagePath: true } });
  return rows.map((r) => r.storagePath);
}

export { MAX_ATTACHMENT_BYTES };
export type AttachmentList = Awaited<ReturnType<typeof listAttachments>>;
