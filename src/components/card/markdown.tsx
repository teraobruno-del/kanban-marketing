import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Mostra texto em Markdown formatado. HTML embutido é ignorado (segurança). */
export function Markdown({ children }: { children: string }) {
  if (!children.trim()) return <p className="text-sm text-muted-foreground italic">Sem descrição.</p>;
  return (
    <div className="markdown text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" /> }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
