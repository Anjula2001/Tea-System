import type {
  BlendedAverage,
  BulkSetValuation,
  Comparison,
  ComparisonVerdict,
  MarketAverage,
  ValuationLine,
} from './types';

/**
 * The calculations, mirrored from the backend's domain/averaging.ts.
 *
 * Kept as pure functions so the screens never do arithmetic inline, and so the
 * numbers shown here are the same numbers the API will return once wired.
 *
 * Confirmed rules
 * ---------------
 *  1. Our per-item average — mean of the auctions in the chosen range.
 *  2. Our blended bulk average — mean of our own bulk Rs/kg per auction.
 *  3. Market average — mean across other factories' blended Rs/kg. Unweighted
 *     of necessity: we never record their bulk weights.
 *  4. Bulk set value — QUANTITY-WEIGHTED: Σ(qty × price) ÷ Σ(qty).
 *
 * Rules 2 and 3 are like for like — both are blended Rs/kg for a whole bulk
 * set, so they compare directly with no per-item reasoning.
 */

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Arithmetic mean, or null for an empty set.
 *
 * Null rather than 0 throughout: "no data" and "zero rupees" are different
 * answers and must never render the same.
 */
export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Rule 1 & 2: a flat mean of one price per auction. */
export function blendedAverage(pricesInRange: readonly number[]): BlendedAverage {
  const average = mean(pricesInRange);
  return {
    averagePricePerKg: average === null ? null : round2(average),
    periodsCounted: pricesInRange.length,
  };
}

/** Rule 3: flat mean across other factories; each result counts once. */
export function marketAverage(
  results: readonly { externalFactoryId: string; pricePerKg: number }[],
): MarketAverage {
  const average = mean(results.map((r) => r.pricePerKg));
  return {
    averagePricePerKg: average === null ? null : round2(average),
    factoriesCounted: new Set(results.map((r) => r.externalFactoryId)).size,
    resultsCounted: results.length,
  };
}

/**
 * Rule 4: Σ(qty × price) ÷ Σ(qty).
 *
 * Unpriced lines are excluded entirely — they contribute neither value nor
 * weight, so a tea item we have no history for cannot drag the average toward
 * zero. The coverage gap is reported instead.
 */
export function valueBulkSet(
  items: readonly {
    teaItemId: string;
    teaItemCode: string;
    teaItemName: string;
    quantityKg: number;
    ourAveragePricePerKg: number | null;
  }[],
): BulkSetValuation {
  let totalValue = 0;
  let pricedWeight = 0;
  let totalQuantityKg = 0;

  for (const item of items) {
    if (item.quantityKg > 0) totalQuantityKg += item.quantityKg;
    if (item.ourAveragePricePerKg === null || !(item.quantityKg > 0)) continue;
    totalValue += item.quantityKg * item.ourAveragePricePerKg;
    pricedWeight += item.quantityKg;
  }

  const hasValue = pricedWeight > 0;

  const lines: ValuationLine[] = items.map((item) => {
    const lineValue =
      item.ourAveragePricePerKg === null
        ? null
        : round2(item.quantityKg * item.ourAveragePricePerKg);
    return {
      teaItemId: item.teaItemId,
      teaItemCode: item.teaItemCode,
      teaItemName: item.teaItemName,
      quantityKg: item.quantityKg,
      ourAveragePricePerKg: item.ourAveragePricePerKg,
      lineValue,
      shareOfValue: lineValue === null || !hasValue ? null : lineValue / totalValue,
    };
  });

  return {
    lines,
    totalQuantityKg: round2(totalQuantityKg),
    pricedQuantityKg: round2(pricedWeight),
    totalValue: hasValue ? round2(totalValue) : null,
    expectedPricePerKg: hasValue ? round2(totalValue / pricedWeight) : null,
    unpricedTeaItemCodes: items
      .filter((i) => i.ourAveragePricePerKg === null && i.quantityKg > 0)
      .map((i) => i.teaItemCode),
    coverage: totalQuantityKg === 0 ? 0 : pricedWeight / totalQuantityKg,
  };
}

/**
 * Compare any two blended Rs/kg figures.
 *
 * Returns 'unknown' rather than guessing when either side is missing — showing
 * "equal" when we simply have no data would be worse than showing nothing.
 */
export function compare(ours: number | null, theirs: number | null): Comparison {
  if (ours === null || theirs === null) {
    return { differencePerKg: null, differencePercent: null, verdict: 'unknown' };
  }

  const differencePerKg = round2(ours - theirs);
  const verdict: ComparisonVerdict =
    differencePerKg > 0 ? 'above' : differencePerKg < 0 ? 'below' : 'equal';

  return {
    differencePerKg,
    differencePercent: theirs === 0 ? null : differencePerKg / theirs,
    verdict,
  };
}

// ------------------------------------------------------------------ formatting

/** Rs formatting with a dash for missing data, never a misleading 0.00. */
export function formatRs(value: number | null, decimals = 2): string {
  if (value === null || Number.isNaN(value)) return '—';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatKg(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function formatSignedRs(value: number | null): string {
  if (value === null) return '—';
  return `${value >= 0 ? '+' : '−'}Rs. ${formatRs(Math.abs(value))}`;
}

export function formatPercent(value: number | null): string {
  if (value === null) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

export function formatAuctionDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[m - 1]} ${y}`;
}
