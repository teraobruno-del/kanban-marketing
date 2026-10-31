import { describe, expect, it } from "vitest";
import { attachmentProblem, formatBytes, isPreviewableImage, safeStorageName } from "./attachments";

const MB = 1024 * 1024;

describe("Regras de anexos", () => {
  it("aceita até 10 MB; recusa maiores e vazios", () => {
    expect(attachmentProblem({ name: "foto.jpg", size: 10 * MB })).toBeNull();
    expect(attachmentProblem({ name: "video.mp4", size: 10 * MB + 1 })).toMatch(/limite é 10 MB/);
    expect(attachmentProblem({ name: "vazio.txt", size: 0 })).toMatch(/vazio/);
  });
  it("recusa executáveis, inclusive com letras maiúsculas", () => {
    expect(attachmentProblem({ name: "setup.EXE", size: 100 })).toMatch(/\.exe não são aceitos/);
    expect(attachmentProblem({ name: "script.sh", size: 100 })).not.toBeNull();
    expect(attachmentProblem({ name: "relatorio.pdf", size: 100 })).toBeNull();
    expect(attachmentProblem({ name: "planilha.xlsx", size: 100 })).toBeNull();
  });
  it("capa só para imagens comuns (SVG fica de fora)", () => {
    expect(isPreviewableImage("image/png", "a.png")).toBe(true);
    expect(isPreviewableImage("image/svg+xml", "a.svg")).toBe(false);
    expect(isPreviewableImage("application/pdf", "a.pdf")).toBe(false);
  });
  it("nome seguro para o armazenamento", () => {
    expect(safeStorageName("Campanha de Natal (versão final).png")).toBe("Campanha-de-Natal-versao-final-.png");
    expect(safeStorageName("../../etc/passwd")).toBe("etc-passwd");
    expect(safeStorageName("ç@#$")).toBe("c");
  });
  it("tamanho legível", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3.5 * MB)).toBe("3,5 MB");
  });
});
