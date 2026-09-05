/**
 * Domain types — mirrored from the backend so the swap from local state to the
 * API is a change of data source, not a change of shape.
 *
 * The model is asymmetric, and that asymmetry is the point:
 *
 *   OURS    tea items → per-item price history → bulk sets with quantities
 *           → plus one blended Rs/kg for the whole bulk set, each auction
 *   MARKET  other factories → ONLY one blended Rs/kg each, per auction
 *
 * There is no per-tea-item market price anywhere, because other factories never
 * report per grade. Any UI that appears to offer one would be inventing data.
 */

export type SellingPeriodStatus = 'upcoming' | 'sold';
export type BulkSetStatus = 'draft' | 'pending' | 'sold';
export type ComparisonVerdict = 'above' | 'below' | 'equal' | 'unknown';

export interface TeaItem {
  id: string;
  code: string;
  name: string;
  category: string | null;
  sortOrder: number;
  active: boolean;
}

export interface ExternalFactory {
  id: string;
  code: string;
  name: string;
  region: string | null;
  active: boolean;
}

/** The ~3-week auction event. Every price fact anchors to one. */
export interface SellingPeriod {
  id: string;
  label: string;
  auctionDate: string; // YYYY-MM-DD
  status: SellingPeriodStatus;
}

/** Our achieved price for one tea item at one auction. Append-only. */
export interface OurItemPrice {
  id: string;
  teaItemId: string;
  sellingPeriodId: string;
  pricePerKg: number;
  recordedAt: string;
}

/** Our whole bulk set's achieved blended price at one auction. Append-only. */
export interface OurBulkResult {
  id: string;
  sellingPeriodId: string;
  bulkSetId: string | null;
  pricePerKg: number;
  recordedAt: string;
}

/** One other factory's blended bulk price at one auction. No tea item. */
export interface ExternalFactoryResult {
  id: string;
  externalFactoryId: string;
  sellingPeriodId: string;
  pricePerKg: number;
  recordedAt: string;
}

export interface BulkSetItem {
  teaItemId: string;
  quantityKg: number;
}

export interface BulkSet {
  id: string;
  reference: string;
  targetSellingPeriodId: string | null;
  status: BulkSetStatus;
  notes: string | null;
  createdAt: string;
  items: BulkSetItem[];
}

// ------------------------------------------------------------ computed shapes

export interface DateRange {
  from: string;
  to: string;
}

export interface OurItemAverage {
  teaItemId: string;
  teaItemCode: string;
  teaItemName: string;
  averagePricePerKg: number | null;
  periodsCounted: number;
}

export interface BlendedAverage {
  averagePricePerKg: number | null;
  periodsCounted: number;
}

export interface MarketAverage {
  averagePricePerKg: number | null;
  factoriesCounted: number;
  resultsCounted: number;
}

export interface Comparison {
  differencePerKg: number | null;
  differencePercent: number | null;
  verdict: ComparisonVerdict;
}

/** One auction's actual outcome: our blended price against the market's. */
export interface PeriodComparison extends Comparison {
  sellingPeriodId: string;
  label: string;
  auctionDate: string;
  status: SellingPeriodStatus;
  ourBulkPricePerKg: number | null;
  marketAveragePricePerKg: number | null;
  factoriesReporting: number;
}

export interface ValuationLine {
  teaItemId: string;
  teaItemCode: string;
  teaItemName: string;
  quantityKg: number;
  ourAveragePricePerKg: number | null;
  lineValue: number | null;
  shareOfValue: number | null;
}

export interface BulkSetValuation {
  lines: ValuationLine[];
  totalQuantityKg: number;
  pricedQuantityKg: number;
  totalValue: number | null;
  expectedPricePerKg: number | null;
  unpricedTeaItemCodes: string[];
  coverage: number;
}
