const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function sliceYmd(v: unknown): string {
  return String(v ?? "").slice(0, 10);
}

/**
 * Supply all `global_rate_history` rows (or any superset); ineligible / future rows are
 * dropped using normalized YYYY-MM-DD from `effective_from`. Primary sort: effective_from
 * DESC. Tie (same calendar day): created_at DESC.
 */
export function pickCurrentGlobalRateFromRows(
  rows: { rate?: unknown; effective_from?: unknown; created_at?: unknown }[] | null | undefined,
  todayYmd: string
): { rate: number; effective_from: string } | null {
  if (!rows?.length) return null;
  const candidates: { rate: number; eff: string; createdMs: number }[] = [];
  for (const r of rows) {
    const eff = sliceYmd(r.effective_from);
    if (!YMD_RE.test(eff) || eff > todayYmd) continue;
    const rate = Number(r.rate);
    if (Number.isNaN(rate)) continue;
    const cm = r.created_at != null ? new Date(String(r.created_at)).getTime() : 0;
    candidates.push({ rate, eff, createdMs: Number.isNaN(cm) ? 0 : cm });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => {
    if (a.eff !== b.eff) return a.eff < b.eff ? 1 : -1;
    return b.createdMs - a.createdMs;
  });
  const c = candidates[0]!;
  return { rate: c.rate, effective_from: c.eff };
}
