"use client";
import { useState } from "react";
import { attachmentProblem } from "@/lib/attachments";
import { ATTACHMENTS_BUCKET } from "@/lib/constants";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { confirmUploadAction, prepareUploadAction } from "@/server/actions/collab";
import { toast } from "@/components/ui/toaster";

/**
 * Envio de anexos (P30/P31): confere o arquivo no navegador, pede ao servidor um link de envio,
 * manda o arquivo direto para o Supabase Storage e confirma no servidor (que confere o tamanho real).
 */
export function useUpload(cardId: string, onDone: () => Promise<void>) {
  const [uploading, setUploading] = useState<string[]>([]);

  async function upload(files: File[]) {
    let sent = 0;
    for (const file of files) {
      const problem = attachmentProblem(file);
      if (problem) {
        toast.error(problem);
        continue;
      }
      setUploading((u) => [...u, file.name]);
      try {
        const prep = await prepareUploadAction(cardId, { name: file.name, size: file.size });
        if (!prep.ok) throw new Error(prep.error);
        const { error } = await createSupabaseBrowserClient()
          .storage.from(ATTACHMENTS_BUCKET)
          .uploadToSignedUrl(prep.data!.path, prep.data!.token, file, { contentType: file.type || "application/octet-stream" });
        if (error) throw new Error(`Não foi possível enviar “${file.name}”. Tente de novo.`);
        const conf = await confirmUploadAction(cardId, { path: prep.data!.path, name: file.name, mimeType: file.type });
        if (!conf.ok) throw new Error(conf.error);
        sent++;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha no envio.");
      } finally {
        setUploading((u) => u.filter((n, i) => i !== u.indexOf(file.name)));
      }
    }
    if (sent > 0) {
      toast.success(sent === 1 ? "Arquivo anexado." : `${sent} arquivos anexados.`);
      await onDone();
    }
  }

  return { upload, uploading };
}
