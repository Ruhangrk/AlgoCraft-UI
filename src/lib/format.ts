const RUPEE = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

export function formatPaise(paise: number): string {
  return RUPEE.format(paise / 100);
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function formatNs(timestampNs: number): string {
  if (!timestampNs) {
    return "—";
  }
  const ms = Math.floor(timestampNs / 1_000_000);
  return new Date(ms).toLocaleString("en-IN", { hour12: false });
}
