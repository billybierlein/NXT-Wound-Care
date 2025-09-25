// Handle "160", "160.00", "3x2", "3 x 2 cm", "2.5cm x 1.5cm"
// If it's an "LxW" style, return L*W (area-ish). Otherwise parse the first number.
export function parseWoundSizeToNumber(raw?: string | null): number {
  if (!raw) return 0;
  const s = String(raw).trim().toLowerCase();
  if (!s) return 0;

  // match like "3x2", "3 x 2", with optional units
  const xMatch = s.match(/([\d.]+)\s*[x×]\s*([\d.]+)/i);
  if (xMatch) {
    const a = parseFloat(xMatch[1]);
    const b = parseFloat(xMatch[2]);
    const area = (isFinite(a) ? a : 0) * (isFinite(b) ? b : 0);
    return isFinite(area) ? area : 0;
  }

  // fallback: first number in the string
  const numMatch = s.match(/([\d.]+)/);
  if (!numMatch) return 0;
  const val = parseFloat(numMatch[1]);
  return isFinite(val) ? val : 0;
}