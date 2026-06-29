export const formatDisplayName = (raw?: string | null): string => {
  if (!raw) return "";
  const tokens = String(raw)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return "";
  if (tokens.length === 1) return tokens[0];
  if (tokens.length === 2) {
    const [a, b] = tokens;
    if (a.length === 1 && b.length > 1) return `${a}${b}`;
    if (b.length === 1 && a.length > 1) return `${b}${a}`;
    return `${b}${a}`;
  }
  const last = tokens[tokens.length - 1];
  const rest = tokens.slice(0, -1).join("");
  return `${last}${rest}`;
};

export const formatNameFromParts = (
  first?: string | null,
  last?: string | null
): string => {
  const combined = `${last ?? ""}${first ?? ""}`.trim();
  if (combined) return combined.replace(/\s+/g, "");
  const fallback = [first, last].filter(Boolean).join(" ");
  return formatDisplayName(fallback);
};
