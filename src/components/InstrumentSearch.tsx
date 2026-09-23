import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import * as api from "@/api/endpoints";
import type { Instrument } from "@/types/api";
import { TextInput } from "@/components/ui";

const RECENT_KEY = "algocraft_recent_tickers";

/** Hardcoded liquid NSE names — empty-field dropdown only (A→Z). */
const TOP_30_POPULAR: { ticker: string; name: string }[] = [
  { ticker: "ADANIENT", name: "Adani Enterprises" },
  { ticker: "APOLLOHOSP", name: "Apollo Hospitals" },
  { ticker: "ASIANPAINT", name: "Asian Paints" },
  { ticker: "AXISBANK", name: "Axis Bank" },
  { ticker: "BAJFINANCE", name: "Bajaj Finance" },
  { ticker: "BHARTIARTL", name: "Bharti Airtel" },
  { ticker: "BPCL", name: "Bharat Petroleum" },
  { ticker: "CIPLA", name: "Cipla" },
  { ticker: "COALINDIA", name: "Coal India" },
  { ticker: "DRREDDY", name: "Dr Reddy's Labs" },
  { ticker: "HCLTECH", name: "HCL Technologies" },
  { ticker: "HDFCBANK", name: "HDFC Bank" },
  { ticker: "HINDALCO", name: "Hindalco" },
  { ticker: "HINDUNILVR", name: "Hindustan Unilever" },
  { ticker: "ICICIBANK", name: "ICICI Bank" },
  { ticker: "INDUSINDBK", name: "IndusInd Bank" },
  { ticker: "INFY", name: "Infosys" },
  { ticker: "ITC", name: "ITC" },
  { ticker: "JSWSTEEL", name: "JSW Steel" },
  { ticker: "KOTAKBANK", name: "Kotak Mahindra Bank" },
  { ticker: "LT", name: "Larsen & Toubro" },
  { ticker: "M&M", name: "Mahindra & Mahindra" },
  { ticker: "MARUTI", name: "Maruti Suzuki" },
  { ticker: "NTPC", name: "NTPC" },
  { ticker: "ONGC", name: "ONGC" },
  { ticker: "POWERGRID", name: "Power Grid" },
  { ticker: "RELIANCE", name: "Reliance Industries" },
  { ticker: "SBIN", name: "State Bank of India" },
  { ticker: "TATAMOTORS", name: "Tata Motors" },
  { ticker: "TCS", name: "Tata Consultancy Services" },
].sort((a, b) => a.ticker.localeCompare(b.ticker));

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

function stubInstrument(ticker: string, name = ""): Instrument {
  return {
    ticker,
    name: name || ticker,
    isin: "",
    exchange: "NSE",
    segment: "EQ",
    lot_size: 1,
    tick_size_paise: 5,
    instrument_key: "",
    active: true,
  };
}

type ListRow = { ticker: string; name: string; source: "popular" | "catalog" | "recent" };

export function InstrumentSearch({
  onSelect,
  placeholder = "Pick popular or type any NSE ticker…",
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

  const typing = q.trim().length > 0;

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 150);
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

  // Full catalog search whenever the user types (not limited to top 30).
  const searchQuery = useQuery({
    queryKey: ["instruments", "search", debounced],
    queryFn: () => api.searchInstruments(debounced, 40),
    enabled: debounced.length >= 1 && !disabled,
    staleTime: 60_000,
  });

  const rows: ListRow[] = useMemo(() => {
    // Typing → catalog results only (entire ingested universe via API).
    if (typing) {
      return (searchQuery.data ?? []).map((inst) => ({
        ticker: inst.ticker,
        name: inst.name,
        source: "catalog" as const,
      }));
    }

    // Empty field → recent + hardcoded popular A–Z.
    const out: ListRow[] = [];
    const seen = new Set<string>();
    for (const t of readRecent()) {
      if (seen.has(t)) {
        continue;
      }
      seen.add(t);
      const pop = TOP_30_POPULAR.find((p) => p.ticker === t);
      out.push({ ticker: t, name: pop?.name ?? t, source: "recent" });
    }
    for (const p of TOP_30_POPULAR) {
      if (seen.has(p.ticker)) {
        continue;
      }
      seen.add(p.ticker);
      out.push({ ticker: p.ticker, name: p.name, source: "popular" });
    }
    return out;
  }, [typing, searchQuery.data]);

  function choose(ticker: string, name: string) {
    const fromSearch = searchQuery.data?.find((i) => i.ticker === ticker);
    pushRecent(ticker);
    onSelect(fromSearch ?? stubInstrument(ticker, name));
    setQ("");
    setDebounced("");
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
      choose(rows[highlight].ticker, rows[highlight].name);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const searching = typing && (debounced !== q.trim() || searchQuery.isFetching);
  const showEmpty =
    open && typing && !searching && !searchQuery.isFetching && rows.length === 0 && debounced.length >= 1;

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
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-[var(--color-line)] bg-white shadow-lg"
        >
          <p className="border-b border-[var(--color-line)] px-3 py-1.5 text-[10px] font-medium tracking-wide text-[var(--color-ink-muted)] uppercase">
            {typing ? "All tickers · catalog search" : "Popular · A–Z"}
          </p>

          {searching ? (
            <p className="px-3 py-2 text-sm text-[var(--color-ink-muted)]">Searching catalog…</p>
          ) : null}
          {typing && searchQuery.isError ? (
            <p className="px-3 py-2 text-sm text-[var(--color-danger)]">
              Catalog search failed — is AlgoCraft running with instruments ingested?
            </p>
          ) : null}
          {showEmpty ? (
            <p className="px-3 py-2 text-sm text-[var(--color-ink-muted)]">No matches in catalog</p>
          ) : null}

          {rows.map((row, i) => (
            <button
              key={`${row.source}-${row.ticker}`}
              type="button"
              role="option"
              aria-selected={i === highlight}
              className={[
                "flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm",
                i === highlight ? "bg-[var(--color-paper)]" : "hover:bg-[var(--color-paper)]",
              ].join(" ")}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => choose(row.ticker, row.name)}
            >
              <span className="font-mono font-medium">{row.ticker}</span>
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-[var(--color-ink-muted)]">{row.name}</span>
                {row.source === "recent" ? (
                  <span className="shrink-0 text-[10px] text-[var(--color-ink-muted)]">recent</span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
