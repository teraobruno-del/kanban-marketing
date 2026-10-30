import "dotenv/config";
import { defineConfig } from "prisma/config";
import { readDbUrl } from "./src/lib/db/url";

// Configuração do Prisma (v7).
// DIRECT_URL = conexão "Session pooler" do Supabase, usada para criar/atualizar as tabelas.
// Sem nenhuma variável (ex.: só gerar o código), usa um endereço de exemplo.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url:
      readDbUrl("DIRECT_URL") ??
      readDbUrl("DATABASE_URL") ??
      "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
});
