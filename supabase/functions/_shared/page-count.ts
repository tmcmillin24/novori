export function validPageCount(value: unknown): number | undefined {
 const n = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;
 return Number.isSafeInteger(n) && n > 0 && n <= 100000 ? n : undefined;
}
