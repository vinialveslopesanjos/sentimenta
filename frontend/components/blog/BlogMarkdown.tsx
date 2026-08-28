import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type BlogMarkdownProps = {
  children: string;
  className?: string;
  size?: "sm" | "lg";
};

export function BlogMarkdown({ children, className = "", size = "lg" }: BlogMarkdownProps) {
  return (
    <div
      className={`prose ${size === "sm" ? "prose-sm" : "prose-lg"} max-w-none ${className}`}
      style={{
        color: "var(--text-secondary)",
        ["--tw-prose-headings" as string]: "var(--text-primary)",
        ["--tw-prose-body" as string]: "var(--text-secondary)",
        ["--tw-prose-links" as string]: "var(--primary)",
        ["--tw-prose-bold" as string]: "var(--text-primary)",
        ["--tw-prose-bullets" as string]: "var(--primary)",
        ["--tw-prose-th-borders" as string]: "var(--border)",
        ["--tw-prose-td-borders" as string]: "var(--border)",
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => (
            <div className="my-6 overflow-x-auto rounded-lg border" style={{ borderColor: "var(--border)" }}>
              <table className="my-0 min-w-full">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="whitespace-nowrap px-4 py-3 text-left align-top">{children}</th>
          ),
          td: ({ children }) => <td className="px-4 py-3 align-top">{children}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
