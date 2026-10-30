import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// De propósito, os testes rodam num fuso bem diferente de São Paulo (UTC+14).
// Para testar outro fuso: TEST_TZ=Europe/London npm test
// Assim garantimos que as regras de data não dependem do fuso do computador/servidor.
process.env.TZ = process.env.TEST_TZ ?? "Pacific/Kiritimati";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Os testes de integração compartilham o mesmo banco: rodar um arquivo por vez.
    fileParallelism: false,
  },
});
