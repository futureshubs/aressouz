/** Filial ID: `branch:xxx` / URL-kodlangan variantlar — solishtirish uchun bir xil ko‘rinish. */
export function normalizeBranchIdRef(raw: unknown): string {
  if (raw == null || raw === '') return '';
  let s = String(raw).trim();
  try {
    s = decodeURIComponent(s);
  } catch {
    /* ignore */
  }
  while (s.startsWith('branch:')) {
    s = s.slice('branch:'.length).trim();
  }
  return s;
}

export function branchIdsEqual(a: unknown, b: unknown): boolean {
  const x = normalizeBranchIdRef(a);
  const y = normalizeBranchIdRef(b);
  if (!x || !y) return x === y;
  return x === y;
}
