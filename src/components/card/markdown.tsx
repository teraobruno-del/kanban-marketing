import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Mostra texto em Markdown formatado. HTML embutido é ignorado (segurança).
 * Links "mention:<id>" (criados para @menções) aparecem como nome destacado.
 */
export function Markdown({ children, emptyText = "Sem descrição." }: { children: string; emptyText?: string }) {
  if (!children.trim()) return <p className="text-sm text-muted-foreground italic">{emptyText}</p>;
  return (
    <div className="markdown text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => (url.startsWith("mention:") ? url : defaultUrlTransform(url))}
        components={{
          a: ({ href, children: c, ...props }) =>
            href?.startsWith("mention:") ? (
              <span className="rounded bg-sky-100 px-1 font-medium text-sky-800">{c}</span>
            ) : (
              <a href={href} {...props} target="_blank" rel="noopener noreferrer">{c}</a>
            ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
