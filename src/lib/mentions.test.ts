import { describe, expect, it } from "vitest";
import { activeMentionQuery, mentionsToMarkdown, resolveMentions } from "./mentions";

const ana = { id: "a", name: "Ana Lima" };
const anabela = { id: "b", name: "Anabela" };
const chefe = { id: "c", name: "chefe" };

describe("Menções", () => {
  it("vale quem foi escolhido e continua no texto", () => {
    expect(resolveMentions("Oi @Ana Lima, veja isso", ["a", "c"], [ana, chefe])).toEqual(["a"]);
    expect(resolveMentions("@chefe pode aprovar?", ["c"], [ana, chefe])).toEqual(["c"]);
  });
  it("ignora quem não pode ser mencionado e nomes parecidos", () => {
    expect(resolveMentions("@Ana Lima", ["x"], [ana])).toEqual([]);
    expect(resolveMentions("@Anabela olá", ["a"], [ana, anabela])).toEqual([]);
    expect(resolveMentions("email ana@Ana Lima", ["a"], [ana])).toEqual([]);
  });
  it("destaca nomes mencionados no texto exibido", () => {
    expect(mentionsToMarkdown("Oi @Ana Lima e @chefe!", [ana, chefe])).toBe("Oi [@Ana Lima](mention:a) e [@chefe](mention:c)!");
    expect(mentionsToMarkdown("@Anabela", [ana])).toBe("@Anabela");
  });
  it("detecta o que está sendo digitado depois de @", () => {
    expect(activeMentionQuery("Oi @an", 6)).toEqual({ query: "an", start: 3 });
    expect(activeMentionQuery("@", 1)).toEqual({ query: "", start: 0 });
    expect(activeMentionQuery("email@x", 7)).toBeNull();
    expect(activeMentionQuery("Oi @Ana Lima e mais", 19)).toBeNull();
  });
});
