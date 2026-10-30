import "server-only";
import { createPrismaClient, type Db } from "./client";
import { readDbUrl } from "./url";

// Uma única conexão por processo (evita abrir conexões demais em desenvolvimento).
const globalForPrisma = globalThis as unknown as { prisma?: Db };

export const prisma: Db = globalForPrisma.prisma ?? createPrismaClient(readDbUrl("DATABASE_URL") ?? "");

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
