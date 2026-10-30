import "dotenv/config";
import { defineConfig } from "prisma/config";

// Configuração do Prisma (v7).
// DIRECT_URL = conexão direta ao Postgres do Supabase (usada nas migrações).
// Placeholder abaixo permite validar/gerar o schema antes de conectar o Supabase (F1).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url:
      process.env["DIRECT_URL"] ??
      process.env["DATABASE_URL"] ??
      "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
});
