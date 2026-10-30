import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sem "cacheComponents": todas as telas dependem do usuário logado, então são montadas a cada acesso.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
