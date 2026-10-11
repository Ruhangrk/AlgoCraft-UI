import { Fragment, type ReactNode } from "react";

/**
 * Lightweight markdown for agent replies (no npm dep).
 * Supports: **bold**, *italic*, `code`, lists, headings, links, fenced code.
 */
export function AgentMarkdown({ content }: { content: string }) {
  const blocks = splitBlocks(content.trimEnd());
  return (
    <div className="agent-md space-y-2 text-sm leading-relaxed text-[var(--color-ink)]">
      {blocks.map((block, i) => (
        <Fragment key={i}>{renderBlock(block)}</Fragment>
      ))}
    </div>
  );
}

type Block =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "h"; level: 1 | 2 | 3; text: string }
  | { type: "pre"; text: string }
  | { type: "quote"; text: string };

function splitBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (!line.trim()) {
      i += 1;
      continue;
    }
    if (line.startsWith("```")) {
      const buf: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i] ?? "").startsWith("```")) {
        buf.push(lines[i] ?? "");
        i += 1;
      }
      i += 1; // closing fence
      out.push({ type: "pre", text: buf.join("\n") });
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      out.push({
        type: "h",
        level: heading[1].length as 1 | 2 | 3,
        text: heading[2],
      });
      i += 1;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i] ?? "")) {
        buf.push((lines[i] ?? "").replace(/^>\s?/, ""));
        i += 1;
      }
      out.push({ type: "quote", text: buf.join("\n") });
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(/^[-*]\s+/, ""));
        i += 1;
      }
      out.push({ type: "ul", items });
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      out.push({ type: "ol", items });
      continue;
    }
    const buf: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() &&
      !/^(#{1,3}\s+|```|[-*]\s+|\d+\.\s+|>\s?)/.test(lines[i] ?? "")
    ) {
      buf.push(lines[i] ?? "");
      i += 1;
    }
    out.push({ type: "p", text: buf.join("\n") });
  }
  return out;
}

function renderBlock(block: Block): ReactNode {
  switch (block.type) {
    case "h": {
      const cls =
        block.level === 1
          ? "text-base font-semibold tracking-tight"
          : block.level === 2
            ? "text-sm font-semibold tracking-tight"
            : "text-sm font-semibold";
      const Tag = (`h${block.level}` as "h1" | "h2" | "h3");
      return <Tag className={cls}>{renderInline(block.text)}</Tag>;
    }
    case "ul":
      return (
        <ul className="list-disc space-y-1 pl-4">
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="list-decimal space-y-1 pl-4">
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ol>
      );
    case "pre":
      return (
        <pre className="overflow-x-auto rounded-md bg-white/70 p-2 font-mono text-[11px]">
          {block.text}
        </pre>
      );
    case "quote":
      return (
        <blockquote className="border-l-2 border-[var(--color-line)] pl-2 text-[var(--color-ink-muted)]">
          {renderInline(block.text)}
        </blockquote>
      );
    default:
      return <p className="whitespace-pre-wrap">{renderInline(block.text)}</p>;
  }
}

/** Inline: `code`, **bold**, *italic*, [text](url) — order matters. */
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re =
    /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(text.slice(last, m.index));
    }
    const tok = m[0];
    if (tok.startsWith("`")) {
      nodes.push(
        <code
          key={key++}
          className="rounded bg-white/80 px-1 py-0.5 font-mono text-[11px]"
        >
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (tok.startsWith("**") || tok.startsWith("__")) {
      nodes.push(
        <strong key={key++} className="font-semibold">
          {tok.slice(2, -2)}
        </strong>,
      );
    } else if (tok.startsWith("*") || tok.startsWith("_")) {
      nodes.push(
        <em key={key++} className="italic">
          {tok.slice(1, -1)}
        </em>,
      );
    } else if (tok.startsWith("[")) {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok);
      if (link) {
        nodes.push(
          <a
            key={key++}
            href={link[2]}
            className="text-[var(--color-accent)] underline underline-offset-2"
            target="_blank"
            rel="noreferrer"
          >
            {link[1]}
          </a>,
        );
      } else {
        nodes.push(tok);
      }
    } else {
      nodes.push(tok);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) {
    nodes.push(text.slice(last));
  }
  return nodes;
}
