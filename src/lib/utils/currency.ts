/** Display amounts as GHS with Ghana locale grouping — no ₵ or $ symbols. */
export function formatGhsCurrency(n: number): string {
  return `GHS ${n.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
