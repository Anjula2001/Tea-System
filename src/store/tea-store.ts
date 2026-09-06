import { create } from 'zustand';

import { blendedAverage, compare, marketAverage, valueBulkSet } from '@/domain/averaging';
import type {
  BulkSet,
  BulkSetItem,
  BulkSetValuation,
  Comparison,
  DateRange,
  ExternalFactory,
  ExternalFactoryResult,
  ItemPriceHistory,
  MarketAverage,
  OurBulkResult,
  OurItemAverage,
  OurItemPrice,
  PeriodComparison,
  SellingPeriod,
  TeaItem,
} from '@/domain/types';

/**
 * One factory. Not a network.
 *
 * This store holds exactly what the workflow says gets recorded:
 *
 *   Every auction, for OUR factory —
 *     · the achieved price per kg of each tea item      → ourItemPrices
 *     · the blended price per kg of the whole bulk set  → ourBulkResults
 *
 *   Every auction, for OTHER factories —
 *     · their sold bulk price per kg, one number each   → externalFactoryResults
 *
 * Other factories have no tea items and no bulk sets here, because we never
 * learn theirs. Price facts are append-only: a correction is a new entry with a
 * later `recordedAt`, and every read resolves to the latest per (subject,
 * auction). That mirrors the backend exactly, so replacing this seed data with
 * API calls is a change of source, not of shape.
 */

// ------------------------------------------------------------------ seed data
// Matches backend/src/db/seed.ts so both halves agree before they are wired.

const TEA_ITEM_SEED: { code: string; name: string; category: string; history: number[] }[] = [
  { code: 'BOP',    name: 'Broken Orange Pekoe',           category: 'Broken Leaf',  history: [1210, 1235, 1228, 1262, 1315] },
  { code: 'BOPF',   name: 'Broken Orange Pekoe Fannings',  category: 'Fannings',     history: [1145, 1160, 1152, 1186, 1257] },
  { code: 'OP',     name: 'Orange Pekoe',                  category: 'Whole Leaf',   history: [1288, 1304, 1296, 1331, 1381] },
  { code: 'DUST',   name: 'Dust Grade 1',                  category: 'Dust',         history: [ 930,  948,  941,  967, 1014] },
  { code: 'FBOP1',  name: 'Flowery Broken Orange Pekoe 1', category: 'Flowery Leaf', history: [1572, 1596, 1588, 1621, 1690] },
  { code: 'PEKOE1', name: 'Pekoe 1',                       category: 'Pekoe',        history: [1498, 1521, 1512, 1547, 1604] },
  { code: 'BP',     name: 'Broken Pekoe',                  category: 'Broken Pekoe', history: [1272, 1290, 1281, 1318, 1366] },
];

const EXTERNAL_SEED: { code: string; name: string; region: string; history: number[] }[] = [
  { code: 'HE-01', name: 'Highland Estates No. 1', region: 'Kandy',        history: [1218, 1240, 1231, 1266, 1322] },
  { code: 'MP-02', name: 'Mountain Peak Factory',  region: 'Dimbula',      history: [1265, 1288, 1279, 1314, 1370] },
  { code: 'SV-07', name: 'Silver Valley Tea Co.',  region: 'Nuwara Eliya', history: [1241, 1259, 1252, 1287, 1341] },
  { code: 'RG-03', name: 'Rangala Plantations',    region: 'Uva',          history: [1196, 1217, 1209, 1244, 1298] },
];

const PERIOD_SEED = [
  { label: 'Auction 21', auctionDate: '2026-06-03', status: 'sold' as const },
  { label: 'Auction 22', auctionDate: '2026-06-24', status: 'sold' as const },
  { label: 'Auction 23', auctionDate: '2026-07-15', status: 'sold' as const },
  { label: 'Auction 24', auctionDate: '2026-08-05', status: 'sold' as const },
  { label: 'Auction 25', auctionDate: '2026-08-26', status: 'sold' as const },
  { label: 'Auction 26', auctionDate: '2026-09-16', status: 'upcoming' as const },
];

/** What our own bulk set actually fetched per kg, at each sold auction. */
const OUR_BULK_SEED = [1243, 1264, 1256, 1291, 1347];

const teaItems: TeaItem[] = TEA_ITEM_SEED.map((item, index) => ({
  id: `ti-${item.code.toLowerCase()}`,
  code: item.code,
  name: item.name,
  category: item.category,
  sortOrder: index,
  active: true,
}));

const externalFactories: ExternalFactory[] = EXTERNAL_SEED.map((factory) => ({
  id: `ef-${factory.code.toLowerCase()}`,
  code: factory.code,
  name: factory.name,
  region: factory.region,
  active: true,
}));

const sellingPeriods: SellingPeriod[] = PERIOD_SEED.map((period, index) => ({
  id: `sp-${index + 21}`,
  label: period.label,
  auctionDate: period.auctionDate,
  status: period.status,
}));

const soldPeriods = sellingPeriods.filter((p) => p.status === 'sold');

const ourItemPrices: OurItemPrice[] = TEA_ITEM_SEED.flatMap((item, itemIndex) =>
  soldPeriods.map((period, periodIndex) => ({
    id: `oip-${itemIndex}-${periodIndex}`,
    teaItemId: teaItems[itemIndex]!.id,
    sellingPeriodId: period.id,
    pricePerKg: item.history[periodIndex]!,
    recordedAt: `${period.auctionDate}T10:00:00.000Z`,
  })),
);

const ourBulkResults: OurBulkResult[] = soldPeriods.map((period, index) => ({
  id: `obr-${index}`,
  sellingPeriodId: period.id,
  bulkSetId: null,
  pricePerKg: OUR_BULK_SEED[index]!,
  recordedAt: `${period.auctionDate}T15:00:00.000Z`,
}));

const externalFactoryResults: ExternalFactoryResult[] = EXTERNAL_SEED.flatMap(
  (factory, factoryIndex) =>
    soldPeriods.map((period, periodIndex) => ({
      id: `efr-${factoryIndex}-${periodIndex}`,
      externalFactoryId: externalFactories[factoryIndex]!.id,
      sellingPeriodId: period.id,
      pricePerKg: factory.history[periodIndex]!,
      recordedAt: `${period.auctionDate}T16:00:00.000Z`,
    })),
);

const bulkSets: BulkSet[] = [
  {
    id: 'bs-100',
    reference: 'BS-100',
    targetSellingPeriodId: 'sp-24',
    status: 'sold',
    notes: 'Sold at Auction 24.',
    createdAt: '2026-07-20T09:00:00.000Z',
    items: [
      { teaItemId: 'ti-bop', quantityKg: 520 },
      { teaItemId: 'ti-bopf', quantityKg: 310 },
      { teaItemId: 'ti-op', quantityKg: 240 },
      { teaItemId: 'ti-dust', quantityKg: 130 },
    ],
  },
  {
    id: 'bs-101',
    reference: 'BS-101',
    targetSellingPeriodId: 'sp-25',
    status: 'sold',
    notes: 'Sold at Auction 25.',
    createdAt: '2026-08-10T09:00:00.000Z',
    items: [
      { teaItemId: 'ti-bop', quantityKg: 500 },
      { teaItemId: 'ti-bopf', quantityKg: 300 },
      { teaItemId: 'ti-op', quantityKg: 200 },
      { teaItemId: 'ti-dust', quantityKg: 100 },
    ],
  },
  {
    id: 'bs-102',
    reference: 'BS-102',
    targetSellingPeriodId: 'sp-26',
    status: 'pending',
    notes: 'Being prepared for Auction 26.',
    createdAt: '2026-09-01T09:00:00.000Z',
    items: [
      { teaItemId: 'ti-bop', quantityKg: 400 },
      { teaItemId: 'ti-bopf', quantityKg: 250 },
      { teaItemId: 'ti-op', quantityKg: 350 },
    ],
  },
];

// ---------------------------------------------------------------------- store

interface TeaStoreState {
  teaItems: TeaItem[];
  externalFactories: ExternalFactory[];
  sellingPeriods: SellingPeriod[];
  ourItemPrices: OurItemPrice[];
  ourBulkResults: OurBulkResult[];
  externalFactoryResults: ExternalFactoryResult[];
  bulkSets: BulkSet[];
  /** The date range every average on screen is drawn from. */
  range: DateRange;

  setRange: (range: DateRange) => void;
  resetRange: () => void;

  /** Append our achieved per-item prices for one auction. */
  recordOurPrices: (
    sellingPeriodId: string,
    entries: { teaItemId: string; pricePerKg: number }[],
  ) => void;
  /** Append our whole bulk set's blended price for one auction. */
  recordOurBulkResult: (
    sellingPeriodId: string,
    pricePerKg: number,
    bulkSetId?: string | null,
  ) => void;
  /** Append other factories' sold bulk prices for one auction. */
  recordExternalResults: (
    sellingPeriodId: string,
    entries: { externalFactoryId: string; pricePerKg: number }[],
  ) => void;

  saveBulkSet: (input: {
    id?: string;
    reference: string;
    targetSellingPeriodId: string | null;
    items: BulkSetItem[];
  }) => BulkSet;
  removeBulkSet: (id: string) => void;
  addSellingPeriod: (label: string, auctionDate: string) => SellingPeriod;
  markPeriodSold: (id: string) => void;
}

function fullRange(periods: SellingPeriod[]): DateRange {
  if (periods.length === 0) return { from: '1970-01-01', to: '9999-12-31' };
  const dates = periods.map((p) => p.auctionDate).sort();
  return { from: dates[0]!, to: dates.at(-1)! };
}

export const useTeaStore = create<TeaStoreState>((set, get) => ({
  teaItems,
  externalFactories,
  sellingPeriods,
  ourItemPrices,
  ourBulkResults,
  externalFactoryResults,
  bulkSets,
  range: fullRange(sellingPeriods),

  setRange: (range) => set({ range }),
  resetRange: () => set({ range: fullRange(get().sellingPeriods) }),

  recordOurPrices: (sellingPeriodId, entries) =>
    set((state) => ({
      ourItemPrices: [
        ...state.ourItemPrices,
        ...entries.map((entry, index) => ({
          id: `oip-${Date.now()}-${index}`,
          teaItemId: entry.teaItemId,
          sellingPeriodId,
          pricePerKg: entry.pricePerKg,
          recordedAt: new Date().toISOString(),
        })),
      ],
    })),

  recordOurBulkResult: (sellingPeriodId, pricePerKg, bulkSetId = null) =>
    set((state) => ({
      ourBulkResults: [
        ...state.ourBulkResults,
        {
          id: `obr-${Date.now()}`,
          sellingPeriodId,
          bulkSetId,
          pricePerKg,
          recordedAt: new Date().toISOString(),
        },
      ],
    })),

  recordExternalResults: (sellingPeriodId, entries) =>
    set((state) => ({
      externalFactoryResults: [
        ...state.externalFactoryResults,
        ...entries.map((entry, index) => ({
          id: `efr-${Date.now()}-${index}`,
          externalFactoryId: entry.externalFactoryId,
          sellingPeriodId,
          pricePerKg: entry.pricePerKg,
          recordedAt: new Date().toISOString(),
        })),
      ],
    })),

  saveBulkSet: (input) => {
    const existing = input.id ? get().bulkSets.find((b) => b.id === input.id) : undefined;

    const bulkSet: BulkSet = {
      id: existing?.id ?? `bs-${Date.now()}`,
      reference: input.reference.trim(),
      targetSellingPeriodId: input.targetSellingPeriodId,
      status: existing?.status ?? 'pending',
      notes: existing?.notes ?? null,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      items: input.items.filter((item) => item.quantityKg > 0),
    };

    set((state) => ({
      bulkSets: existing
        ? state.bulkSets.map((b) => (b.id === existing.id ? bulkSet : b))
        : [bulkSet, ...state.bulkSets],
    }));

    return bulkSet;
  },

  removeBulkSet: (id) =>
    set((state) => ({ bulkSets: state.bulkSets.filter((b) => b.id !== id) })),

  addSellingPeriod: (label, auctionDate) => {
    const period: SellingPeriod = {
      id: `sp-${Date.now()}`,
      label: label.trim(),
      auctionDate,
      status: 'upcoming',
    };
    set((state) => ({
      sellingPeriods: [...state.sellingPeriods, period].sort((a, b) =>
        a.auctionDate.localeCompare(b.auctionDate),
      ),
    }));
    return period;
  },

  markPeriodSold: (id) =>
    set((state) => ({
      sellingPeriods: state.sellingPeriods.map((p) =>
        p.id === id ? { ...p, status: 'sold' as const } : p,
      ),
    })),
}));

// ------------------------------------------------------------------ selectors
// Plain functions over a state snapshot, so components stay free of arithmetic.

type Snapshot = Pick<
  TeaStoreState,
  | 'teaItems'
  | 'externalFactories'
  | 'sellingPeriods'
  | 'ourItemPrices'
  | 'ourBulkResults'
  | 'externalFactoryResults'
  | 'bulkSets'
>;

/**
 * Collapse an append-only list to the latest entry per key.
 *
 * This is what makes corrections work: re-entering a price appends a row, and
 * every read here keeps only the newest, so a fixed typo is never counted twice.
 */
function latestPerKey<T extends { recordedAt: string }>(
  rows: readonly T[],
  key: (row: T) => string,
): T[] {
  const winners = new Map<string, T>();
  for (const row of rows) {
    const k = key(row);
    const current = winners.get(k);
    if (!current || row.recordedAt >= current.recordedAt) winners.set(k, row);
  }
  return [...winners.values()];
}

export function periodsInRange(state: Snapshot, range: DateRange): SellingPeriod[] {
  return state.sellingPeriods
    .filter((p) => p.auctionDate >= range.from && p.auctionDate <= range.to)
    .sort((a, b) => a.auctionDate.localeCompare(b.auctionDate));
}

/** Rule 1: our mean price per kg for each tea item, over the range. */
export function selectOurItemAverages(state: Snapshot, range: DateRange): OurItemAverage[] {
  const periodIds = new Set(periodsInRange(state, range).map((p) => p.id));
  const current = latestPerKey(
    state.ourItemPrices.filter((p) => periodIds.has(p.sellingPeriodId)),
    (p) => `${p.teaItemId}|${p.sellingPeriodId}`,
  );

  const byItem = new Map<string, number[]>();
  for (const price of current) {
    const bucket = byItem.get(price.teaItemId);
    if (bucket) bucket.push(price.pricePerKg);
    else byItem.set(price.teaItemId, [price.pricePerKg]);
  }

  return state.teaItems
    .filter((item) => item.active)
    .map((item) => {
      const summary = blendedAverage(byItem.get(item.id) ?? []);
      return {
        teaItemId: item.id,
        teaItemCode: item.code,
        teaItemName: item.name,
        averagePricePerKg: summary.averagePricePerKg,
        periodsCounted: summary.periodsCounted,
      };
    });
}

/** Rule 2: our own blended bulk price, averaged over the range. */
export function selectOurBulkAverage(state: Snapshot, range: DateRange) {
  const periodIds = new Set(periodsInRange(state, range).map((p) => p.id));
  const current = latestPerKey(
    state.ourBulkResults.filter((r) => periodIds.has(r.sellingPeriodId)),
    (r) => r.sellingPeriodId,
  );
  return blendedAverage(current.map((r) => r.pricePerKg));
}

/** Rule 3: the market benchmark, flat mean across other factories. */
export function selectMarketAverage(state: Snapshot, range: DateRange): MarketAverage {
  const periodIds = new Set(periodsInRange(state, range).map((p) => p.id));
  const activeFactories = new Set(
    state.externalFactories.filter((f) => f.active).map((f) => f.id),
  );
  const current = latestPerKey(
    state.externalFactoryResults.filter(
      (r) => periodIds.has(r.sellingPeriodId) && activeFactories.has(r.externalFactoryId),
    ),
    (r) => `${r.externalFactoryId}|${r.sellingPeriodId}`,
  );
  return marketAverage(current);
}

/** Our range-average bulk price against the market's. */
export function selectOverallComparison(state: Snapshot, range: DateRange): Comparison {
  return compare(
    selectOurBulkAverage(state, range).averagePricePerKg,
    selectMarketAverage(state, range).averagePricePerKg,
  );
}

/**
 * Auction-by-auction: what our bulk fetched against what the market fetched.
 *
 * Each auction gets its own market mean, rather than being measured against the
 * whole-range average — otherwise a rising market would make every early
 * auction look like a loss.
 */
export function selectPeriodComparisons(state: Snapshot, range: DateRange): PeriodComparison[] {
  const periods = periodsInRange(state, range);
  const periodIds = new Set(periods.map((p) => p.id));

  const ourCurrent = latestPerKey(
    state.ourBulkResults.filter((r) => periodIds.has(r.sellingPeriodId)),
    (r) => r.sellingPeriodId,
  );
  const ourByPeriod = new Map(ourCurrent.map((r) => [r.sellingPeriodId, r.pricePerKg]));

  const activeFactories = new Set(
    state.externalFactories.filter((f) => f.active).map((f) => f.id),
  );
  const externalCurrent = latestPerKey(
    state.externalFactoryResults.filter(
      (r) => periodIds.has(r.sellingPeriodId) && activeFactories.has(r.externalFactoryId),
    ),
    (r) => `${r.externalFactoryId}|${r.sellingPeriodId}`,
  );

  const externalByPeriod = new Map<string, ExternalFactoryResult[]>();
  for (const row of externalCurrent) {
    const bucket = externalByPeriod.get(row.sellingPeriodId);
    if (bucket) bucket.push(row);
    else externalByPeriod.set(row.sellingPeriodId, [row]);
  }

  return periods.map((period) => {
    const ours = ourByPeriod.get(period.id) ?? null;
    const theirs = marketAverage(externalByPeriod.get(period.id) ?? []);
    return {
      sellingPeriodId: period.id,
      label: period.label,
      auctionDate: period.auctionDate,
      status: period.status,
      ourBulkPricePerKg: ours,
      marketAveragePricePerKg: theirs.averagePricePerKg,
      factoriesReporting: theirs.factoriesCounted,
      ...compare(ours, theirs.averagePricePerKg),
    };
  });
}

/** Rule 4: value a bulk set at our own per-item averages, quantity-weighted. */
export function selectBulkSetValuation(
  state: Snapshot,
  bulkSetId: string,
  range: DateRange,
): BulkSetValuation | null {
  const bulkSet = state.bulkSets.find((b) => b.id === bulkSetId);
  if (!bulkSet) return null;
  return valueBulkSetItems(state, bulkSet.items, range);
}

/** The same valuation for a set being edited but not yet saved. */
export function valueBulkSetItems(
  state: Snapshot,
  items: readonly BulkSetItem[],
  range: DateRange,
): BulkSetValuation {
  const averages = new Map(
    selectOurItemAverages(state, range).map((a) => [a.teaItemId, a]),
  );

  return valueBulkSet(
    items.map((item) => {
      const teaItem = state.teaItems.find((t) => t.id === item.teaItemId);
      const average = averages.get(item.teaItemId);
      return {
        teaItemId: item.teaItemId,
        teaItemCode: teaItem?.code ?? '—',
        teaItemName: teaItem?.name ?? 'Unknown item',
        quantityKg: item.quantityKg,
        ourAveragePricePerKg: average?.averagePricePerKg ?? null,
      };
    }),
  );
}

/**
 * What each tea item was fetching in the weeks before one auction.
 *
 * Only strictly earlier auctions count. Excluding the auction being entered is
 * the whole point: an average that already contains today's price would pull
 * toward it and flatten the movement the screen exists to show. Corrections are
 * resolved first, so a fixed typo never counts twice in the baseline.
 */
export function selectOurItemHistoryBeforePeriod(
  state: Snapshot,
  sellingPeriodId: string,
): Map<string, ItemPriceHistory> {
  const target = state.sellingPeriods.find((p) => p.id === sellingPeriodId);
  if (!target) return new Map();

  const past = state.sellingPeriods
    .filter((p) => p.auctionDate < target.auctionDate)
    .sort((a, b) => a.auctionDate.localeCompare(b.auctionDate));

  const rank = new Map(past.map((p, index) => [p.id, index]));
  const labels = new Map(past.map((p) => [p.id, p.label]));

  const current = latestPerKey(
    state.ourItemPrices.filter((p) => rank.has(p.sellingPeriodId)),
    (p) => `${p.teaItemId}|${p.sellingPeriodId}`,
  );

  const byItem = new Map<string, OurItemPrice[]>();
  for (const price of current) {
    const bucket = byItem.get(price.teaItemId);
    if (bucket) bucket.push(price);
    else byItem.set(price.teaItemId, [price]);
  }

  return new Map(
    state.teaItems.map((item) => {
      const rows = (byItem.get(item.id) ?? []).sort(
        (a, b) => rank.get(a.sellingPeriodId)! - rank.get(b.sellingPeriodId)!,
      );
      const summary = blendedAverage(rows.map((r) => r.pricePerKg));
      const latest = rows.at(-1) ?? null;

      return [
        item.id,
        {
          teaItemId: item.id,
          averagePricePerKg: summary.averagePricePerKg,
          periodsCounted: summary.periodsCounted,
          lastPricePerKg: latest?.pricePerKg ?? null,
          lastPeriodLabel: latest ? labels.get(latest.sellingPeriodId) ?? null : null,
        },
      ];
    }),
  );
}

/**
 * The most recently built bulk set — the one Prepare Bulk Set shows first.
 *
 * This is the mix the auction screen blends through, whichever auction is
 * selected. The factory prepares one set at a time and sells it; the set on the
 * bench is therefore the set being priced, and pinning the blend to it keeps
 * the two screens describing the same tea.
 */
export function selectLatestBulkSet(state: Snapshot): BulkSet | null {
  return (
    [...state.bulkSets].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1) ?? null
  );
}

/**
 * Rule 4 again — Σ(qty × price) ÷ Σ(qty) — but against one auction's achieved
 * prices rather than historical averages.
 *
 * Deliberately the same function the bulk set screen forecasts with, so the
 * forecast and the result are weighted identically and the difference between
 * them means something. Items in the set with no price entered are excluded
 * from both value and weight, exactly as unpriced items are in a forecast.
 */
export function valueBulkSetAtPrices(
  state: Snapshot,
  items: readonly BulkSetItem[],
  pricePerKgByTeaItem: ReadonlyMap<string, number>,
): BulkSetValuation {
  return valueBulkSet(
    items.map((item) => {
      const teaItem = state.teaItems.find((t) => t.id === item.teaItemId);
      return {
        teaItemId: item.teaItemId,
        teaItemCode: teaItem?.code ?? '—',
        teaItemName: teaItem?.name ?? 'Unknown item',
        quantityKg: item.quantityKg,
        ourAveragePricePerKg: pricePerKgByTeaItem.get(item.teaItemId) ?? null,
      };
    }),
  );
}

/** Current per-item prices recorded for one auction, corrections resolved. */
export function selectOurPricesForPeriod(
  state: Snapshot,
  sellingPeriodId: string,
): Map<string, number> {
  const current = latestPerKey(
    state.ourItemPrices.filter((p) => p.sellingPeriodId === sellingPeriodId),
    (p) => p.teaItemId,
  );
  return new Map(current.map((p) => [p.teaItemId, p.pricePerKg]));
}

/** Our recorded blended bulk price for one auction, if any. */
export function selectOurBulkForPeriod(
  state: Snapshot,
  sellingPeriodId: string,
): number | null {
  const current = latestPerKey(
    state.ourBulkResults.filter((r) => r.sellingPeriodId === sellingPeriodId),
    (r) => r.sellingPeriodId,
  );
  return current[0]?.pricePerKg ?? null;
}

/** Current external results for one auction, corrections resolved. */
export function selectExternalResultsForPeriod(
  state: Snapshot,
  sellingPeriodId: string,
): Map<string, number> {
  const current = latestPerKey(
    state.externalFactoryResults.filter((r) => r.sellingPeriodId === sellingPeriodId),
    (r) => r.externalFactoryId,
  );
  return new Map(current.map((r) => [r.externalFactoryId, r.pricePerKg]));
}

/** The next auction we have not sold at yet — what the app is working toward. */
export function selectUpcomingPeriod(state: Snapshot): SellingPeriod | null {
  return (
    state.sellingPeriods
      .filter((p) => p.status === 'upcoming')
      .sort((a, b) => a.auctionDate.localeCompare(b.auctionDate))[0] ?? null
  );
}

export function selectLatestSoldPeriod(state: Snapshot): SellingPeriod | null {
  return (
    state.sellingPeriods
      .filter((p) => p.status === 'sold')
      .sort((a, b) => a.auctionDate.localeCompare(b.auctionDate))
      .at(-1) ?? null
  );
}
