import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import * as api from "@/api/endpoints";
import type { Instrument } from "@/types/api";
import { TextInput } from "@/components/ui";

const RECENT_KEY = "algocraft_recent_tickers";

function readRecent(): string[] {
  try {
    const raw = sessionStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function pushRecent(ticker: string): void {
  const next = [ticker, ...readRecent().filter((t) => t !== ticker)].slice(0, 8);
  sessionStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

export function InstrumentSearch({
  onSelect,
  placeholder = "Search NSE ticker or name…",
  autoFocus = false,
  disabled = false,
}: {
  onSelect: (instrument: Instrument) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 200);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const searchQuery = useQuery({
    queryKey: ["instruments", "search", debounced],
    queryFn: () => api.searchInstruments(debounced, 20),
    enabled: debounced.length >= 2 && !disabled,
    staleTime: 60_000,
  });

  const results = searchQuery.data ?? [];

  function choose(inst: Instrument) {
    pushRecent(inst.ticker);
    onSelect(inst);
    setQ("");
    setDebounced("");
    setOpen(false);
    setHighlight(0);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter") && results.length) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && open && results[highlight]) {
      e.preventDefault();
      choose(results[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const recent = readRecent();
  const showRecent = open && debounced.length < 2 && recent.length > 0;

  return (
    <div ref={rootRef} className="relative">
      <TextInput
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={placeholder}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />

      {open && !disabled ? (
        <div
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-[var(--color-line)] bg-white shadow-lg"
        >
          {debounced.length >= 2 && searchQuery.isFetching ? (
            <p className="px-3 py-2 text-sm text-[var(--color-ink-muted)]">Searching…</p>
          ) : null}
          {debounced.length >= 2 && searchQuery.isError ? (
            <p className="px-3 py-2 text-sm text-[var(--color-danger)]">
              Search failed — is AlgoCraft running and instruments ingested?
            </p>
          ) : null}
          {debounced.length >= 2 && !searchQuery.isFetching && results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-[var(--color-ink-muted)]">No matches</p>
          ) : null}

          {showRecent ? (
            <div className="border-b border-[var(--color-line)] px-3 py-2">
              <p className="mb-1 text-[10px] font-medium tracking-wide text-[var(--color-ink-muted)] uppercase">
                Recent
              </p>
              <div className="flex flex-wrap gap-1.5">
                {recent.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="rounded-md border border-[var(--color-line)] px-2 py-0.5 font-mono text-xs hover:bg-[var(--color-paper)]"
                    onClick={() => {
                      setQ(t);
                      setDebounced(t);
                      setOpen(true);
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {results.map((inst, i) => (
            <button
              key={inst.ticker}
              type="button"
              role="option"
              aria-selected={i === highlight}
              className={[
                "flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm",
                i === highlight ? "bg-[var(--color-paper)]" : "hover:bg-[var(--color-paper)]",
              ].join(" ")}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => choose(inst)}
            >
              <span className="font-mono font-medium">{inst.ticker}</span>
              <span className="truncate text-[var(--color-ink-muted)]">{inst.name}</span>
            </button>
          ))}

          {debounced.length < 2 && !showRecent ? (
            <p className="px-3 py-2 text-sm text-[var(--color-ink-muted)]">
              Type at least 2 characters
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
