import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { TextInput } from "@/components/ui";

export function StrategySearch({
  options,
  value,
  onChange,
  placeholder = "Search strategy…",
  disabled = false,
}: {
  options: string[];
  value: string;
  onChange: (strategy: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const all = useMemo(() => {
    const set = new Set(options.filter(Boolean));
    if (value) set.add(value);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [options, value]);

  const needle = q.trim().toLowerCase();
  const rows = useMemo(() => {
    if (!needle) return all;
    return all.filter((s) => s.toLowerCase().includes(needle));
  }, [all, needle]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    setHighlight(0);
  }, [needle, open]);

  function choose(strategy: string) {
    onChange(strategy);
    setQ("");
    setOpen(false);
    setHighlight(0);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter") && rows.length) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(rows.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && open && rows[highlight]) {
      e.preventDefault();
      choose(rows[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <TextInput
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />

      {open && !disabled ? (
        <div
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-[var(--color-line)] bg-white shadow-lg"
        >
          <p className="border-b border-[var(--color-line)] px-3 py-1.5 text-[10px] font-medium tracking-wide text-[var(--color-ink-muted)] uppercase">
            {needle ? `${rows.length} match${rows.length === 1 ? "" : "es"}` : `${all.length} strategies`}
          </p>

          {rows.length === 0 ? (
            <p className="px-3 py-2 text-sm text-[var(--color-ink-muted)]">No matching strategies</p>
          ) : (
            rows.map((name, i) => (
              <button
                key={name}
                type="button"
                role="option"
                aria-selected={i === highlight || name === value}
                className={[
                  "flex w-full items-center justify-between gap-3 px-3 py-2 text-left font-mono text-sm",
                  i === highlight ? "bg-[var(--color-paper)]" : "hover:bg-[var(--color-paper)]",
                  name === value ? "font-medium text-[var(--color-accent)]" : "text-[var(--color-ink)]",
                ].join(" ")}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => choose(name)}
              >
                <span className="truncate">{name}</span>
                {name === value ? (
                  <span className="shrink-0 text-[10px] text-[var(--color-ink-muted)]">selected</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
