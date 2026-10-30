import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

export type Db = PrismaClient;

/**
 * Cria o cliente do banco. Usado pelo site (prisma.ts) e pelos testes de integração.
 * Se DATABASE_CA_CERT estiver definida (certificado do Supabase, em Database → SSL),
 * a conexão é criptografada e o certificado do servidor é verificado.
 */
export function createPrismaClient(connectionString: string): Db {
  if (!connectionString) throw new Error("DATABASE_URL não configurada.");
  const ca = process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n");
  const ssl = ca ? { ca, rejectUnauthorized: true } : undefined;
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, ssl }) });
}
