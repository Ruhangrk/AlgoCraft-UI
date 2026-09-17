import type { Workbook } from "@/types/api";

const KEY = "algocraft_known_workbooks";

/** Local merge cache — backend GET /workbooks can return [] after POST today. */
export function readKnownWorkbooks(userId: number): Workbook[] {
  try {
    const raw = localStorage.getItem(`${KEY}:${userId}`);
    if (!raw) {
      return [];
    }
    return JSON.parse(raw) as Workbook[];
  } catch {
    return [];
  }
}

export function rememberWorkbook(userId: number, workbook: Workbook): void {
  const existing = readKnownWorkbooks(userId).filter((w) => w.id !== workbook.id);
  const next = [workbook, ...existing];
  localStorage.setItem(`${KEY}:${userId}`, JSON.stringify(next));
}

export function mergeWorkbooks(apiList: Workbook[], known: Workbook[]): Workbook[] {
  const map = new Map<number, Workbook>();
  for (const w of known) {
    map.set(w.id, w);
  }
  for (const w of apiList) {
    map.set(w.id, w);
  }
  return [...map.values()].sort((a, b) => b.id - a.id);
}
