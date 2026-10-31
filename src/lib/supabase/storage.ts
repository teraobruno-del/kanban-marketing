import "server-only";
import type { StoragePort } from "@/server/services/attachments";
import { ATTACHMENTS_BUCKET, MAX_ATTACHMENT_BYTES } from "@/lib/constants";
import { createSupabaseAdminClient } from "./admin";

let bucketReady: Promise<void> | null = null;

/** Cria o balde privado na primeira vez, se ainda não existir. */
function ensureBucket(client: ReturnType<typeof createSupabaseAdminClient>) {
  bucketReady ??= (async () => {
    const { error } = await client.storage.getBucket(ATTACHMENTS_BUCKET);
    if (!error) return;
    const created = await client.storage.createBucket(ATTACHMENTS_BUCKET, { public: false, fileSizeLimit: MAX_ATTACHMENT_BYTES });
    if (created.error && !/exists/i.test(created.error.message)) {
      bucketReady = null;
      throw new Error(`Supabase Storage: ${created.error.message}`);
    }
  })();
  return bucketReady;
}

/** Implementação real do armazenamento, usando o Supabase Storage com a chave secreta. */
export function supabaseStorage(): StoragePort {
  const client = createSupabaseAdminClient();
  const bucket = () => client.storage.from(ATTACHMENTS_BUCKET);
  const check = (error: { message: string } | null) => {
    if (error) throw new Error(`Supabase Storage: ${error.message}`);
  };
  return {
    async createUploadUrl(path) {
      await ensureBucket(client);
      const { data, error } = await bucket().createSignedUploadUrl(path);
      check(error);
      return { token: data!.token, signedUrl: data!.signedUrl };
    },
    async getObjectSize(path) {
      await ensureBucket(client);
      const info = await bucket().info(path);
      const size = (info.data as { size?: number; metadata?: { size?: number } } | null)?.size
        ?? (info.data as { metadata?: { size?: number } } | null)?.metadata?.size;
      if (typeof size === "number") return size;
      // Plano B: procurar o arquivo na pasta
      const slash = path.lastIndexOf("/");
      const { data } = await bucket().list(path.slice(0, slash), { search: path.slice(slash + 1), limit: 5 });
      const found = data?.find((o) => o.name === path.slice(slash + 1));
      return typeof found?.metadata?.size === "number" ? found.metadata.size : null;
    },
    async createDownloadUrls(paths, expiresIn) {
      if (paths.length === 0) return {};
      await ensureBucket(client);
      const { data, error } = await bucket().createSignedUrls(paths, expiresIn);
      check(error);
      const out: Record<string, string> = {};
      for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
      return out;
    },
    async remove(paths) {
      for (let i = 0; i < paths.length; i += 900) {
        const { error } = await bucket().remove(paths.slice(i, i + 900));
        check(error);
      }
    },
  };
}
