import { create } from 'zustand';

import { api, ApiError } from '@/api';
import { blendedAverage, compare, marketAverage, valueBulkSet } from '@/domain/averaging';
import type {
  BulkSet,
  BulkSetItem,
  BulkSetValuation,
  BulkSetWithItems,
  Comparison,
  DateRange,
  ExternalFactory,
  ExternalFactoryResult,
  FactoryProfile,
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
 * learn theirs.
 *
 * Every one of those facts comes from the API — this store is a cache of the
 * database, never a source of truth. Reads are plain selectors over the cached
 * snapshot so the screens stay free of arithmetic; writes go to the backend
 * first and only then refresh what changed. A write that fails throws, and the
 * screen says so, because a success message over an unsaved record is worse
 * than an error.
 *
 * Price facts stay append-only server-side: a correction is a new row with a
 * later `recordedAt`, and the API hands back only the winning row per
 * (subject, auction). `latestPerKey` below is belt-and-braces for the same
 * rule, so a selector cannot double-count if a list ever arrives unresolved.
 */

// ---------------------------------------------------------------------- store

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * One independently loadable slice of the backend.
 *
 * The app used to fetch all of this before drawing anything, which meant
 * opening Market paid for bulk sets, and opening any screen at all paid for
 * every auction's item prices. Each tab now asks for what it actually reads.
 *
 * The three price resources are separate for the same reason: Market needs
 * only what other factories fetched, Item Prices only what we did, and each
 * fans out over every auction — so keeping them apart is worth three fetches
 * per auction to the screens that need one of them.
 */
export type Resource =
  | 'profile'
  | 'teaItems'
  | 'factories'
  | 'periods'
  | 'bulkSets'
  | 'itemPrices'
  | 'bulkResults'
  | 'externalResults';

export interface ResourceState {
  status: LoadStatus;
  error: string | null;
}

export const ALL_RESOURCES: readonly Resource[] = [
  'profile',
  'teaItems',
  'factories',
  'periods',
  'bulkSets',
  'itemPrices',
  'bulkResults',
  'externalResults',
];

/**
 * What must be in the cache before a resource can be fetched.
 *
 * The price endpoints are per auction, so there is nothing to fan out over
 * until the selling periods are known.
 */
const DEPENDS_ON: Partial<Record<Resource, readonly Resource[]>> = {
  itemPrices: ['periods'],
  bulkResults: ['periods'],
  externalResults: ['periods'],
};

interface TeaStoreState {
  teaItems: TeaItem[];
  /** Our own factory. Null only before the first load resolves. */
  factoryProfile: FactoryProfile | null;
  externalFactories: ExternalFactory[];
  sellingPeriods: SellingPeriod[];
  ourItemPrices: OurItemPrice[];
  ourBulkResults: OurBulkResult[];
  externalFactoryResults: ExternalFactoryResult[];
  bulkSets: BulkSet[];
  /** The date range every average on screen is drawn from. */
  range: DateRange;
  /**
   * Whether `range` has been decided yet — by the first sight of the auctions,
   * or by the user. Without it a later resource load could widen a range the
   * user had narrowed.
   */
  rangeInitialised: boolean;

  /** How each slice of the cache is doing. Screens gate on the ones they read. */
  resources: Record<Resource, ResourceState>;
  /** True while a save is in flight, so screens can disable their buttons. */
  saving: boolean;

  /**
   * Fetch these resources.
   *
   * Safe to call repeatedly: one already in flight is joined rather than
   * fetched twice.
   *
   *  · default      — skip anything already loaded. The first visit to a tab.
   *  · revalidate   — fetch again, but keep the current data on screen while
   *                   it is in the air. Every later visit to a tab, so the
   *                   figures are current without the screen blanking.
   *  · force        — fetch again and show the loading gate. The retry button.
   */
  ensure: (
    needs: readonly Resource[],
    options?: { force?: boolean; revalidate?: boolean },
  ) => Promise<void>;

  setRange: (range: DateRange) => void;
  resetRange: () => void;

  /** Record our achieved per-item prices for one auction. */
  recordOurPrices: (
    sellingPeriodId: string,
    entries: { teaItemId: string; pricePerKg: number }[],
  ) => Promise<void>;
  /** Record a hand-typed blended bulk price for one auction. */
  recordOurBulkResult: (
    sellingPeriodId: string,
    pricePerKg: number,
    bulkSetId?: string | null,
  ) => Promise<void>;
  /**
   * Ask the backend to derive the blended bulk price from the item prices it
   * already holds. Throws when a grade in the set is still unpriced.
   */
  blendOurBulkResult: (sellingPeriodId: string, bulkSetId?: string | null) => Promise<void>;
  /** Record other factories' sold bulk prices for one auction. */
  recordExternalResults: (
    sellingPeriodId: string,
    entries: { externalFactoryId: string; pricePerKg: number }[],
  ) => Promise<void>;

  /** Add a grade to the catalogue. */
  addTeaItem: (input: {
    code: string;
    name: string;
    category?: string | null;
    sortOrder?: number;
  }) => Promise<TeaItem>;
  /** Rename, recode or recategorise a grade. Past prices follow it. */
  updateTeaItem: (
    id: string,
    patch: { code?: string; name?: string; category?: string | null; sortOrder?: number },
  ) => Promise<TeaItem>;
  /** Delete a grade outright. Throws when anything on file depends on it. */
  removeTeaItem: (id: string) => Promise<void>;
  /** Retire a grade without deleting its history, or bring one back. */
  setTeaItemActive: (id: string, active: boolean) => Promise<void>;

  /** Rename our own factory. */
  updateFactoryProfile: (patch: {
    name?: string;
    shortName?: string;
    region?: string | null;
  }) => Promise<FactoryProfile>;

  /** Add another factory to the benchmark. */
  addExternalFactory: (input: {
    code: string;
    name: string;
    region?: string | null;
  }) => Promise<ExternalFactory>;
  /** Rename, recode or re-region a factory. Past results follow it. */
  updateExternalFactory: (
    id: string,
    patch: { code?: string; name?: string; region?: string | null },
  ) => Promise<ExternalFactory>;
  /** Delete a factory outright. Throws when it has results on file. */
  removeExternalFactory: (id: string) => Promise<void>;
  /** Retire a factory without deleting its history, or bring one back. */
  setExternalFactoryActive: (id: string, active: boolean) => Promise<void>;

  saveBulkSet: (input: {
    id?: string;
    reference: string;
    targetSellingPeriodId: string | null;
    items: BulkSetItem[];
  }) => Promise<BulkSet>;
  addSellingPeriod: (label: string, auctionDate: string) => Promise<SellingPeriod>;
  markPeriodSold: (id: string) => Promise<void>;
}

function fullRange(periods: SellingPeriod[]): DateRange {
  if (periods.length === 0) return { from: '1970-01-01', to: '9999-12-31' };
  const dates = periods.map((p) => p.auctionDate).sort();
  return { from: dates[0]!, to: dates.at(-1)! };
}

function describe(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong talking to the API.';
}

/**
 * One price endpoint across every auction.
 *
 * The API exposes prices per selling period rather than in one feed, so this
 * fans out. The requests are independent and auctions are few, so they go
 * together rather than in sequence.
 */
async function fanOut<T>(
  periods: readonly SellingPeriod[],
  fetch: (sellingPeriodId: string) => Promise<T>,
): Promise<T[]> {
  return Promise.all(periods.map((period) => fetch(period.id)));
}

/**
 * Bulk sets with their lines.
 *
 * `GET /bulk-sets` returns headers only — the lines are what every screen here
 * actually needs, so each set is fetched in full. Bulk sets are a handful, and
 * a set without its quantities cannot be edited or valued.
 */
async function fetchBulkSets(): Promise<BulkSetWithItems[]> {
  const headers = await api.bulkSets.list();
  return Promise.all(headers.map((header) => api.bulkSets.get(header.id)));
}

/**
 * How to fetch each resource, and what it puts in the cache.
 *
 * Each returns a patch rather than writing directly, so `ensure` owns every
 * transition and a fetcher cannot forget to mark itself ready.
 */
type StorePatch = Partial<{
  factoryProfile: FactoryProfile | null;
  teaItems: TeaItem[];
  externalFactories: ExternalFactory[];
  sellingPeriods: SellingPeriod[];
  bulkSets: BulkSetWithItems[];
  ourItemPrices: OurItemPrice[];
  ourBulkResults: OurBulkResult[];
  externalFactoryResults: ExternalFactoryResult[];
  range: DateRange;
  rangeInitialised: boolean;
}>;

const FETCHERS: Record<Resource, (periods: readonly SellingPeriod[]) => Promise<StorePatch>> = {
  profile: async () => ({ factoryProfile: await api.factoryProfile.get() }),

  // Inactive grades come along: they must stay visible to manage, and every
  // selector that should ignore them already filters on `active`.
  teaItems: async () => ({ teaItems: await api.teaItems.list(true) }),

  factories: async () => ({ externalFactories: await api.externalFactories.list(true) }),

  periods: async () => ({ sellingPeriods: await api.sellingPeriods.list() }),

  bulkSets: async () => ({ bulkSets: await fetchBulkSets() }),

  itemPrices: async (periods) => ({
    ourItemPrices: (await fanOut(periods, api.prices.ourPrices)).flat(),
  }),

  bulkResults: async (periods) => ({
    ourBulkResults: (await fanOut(periods, api.prices.ourBulkResult)).filter(
      (r): r is OurBulkResult => r !== null,
    ),
  }),

  externalResults: async (periods) => ({
    externalFactoryResults: (await fanOut(periods, api.prices.externalResults)).flat(),
  }),
};

/**
 * Fetches currently in the air, so two screens mounting at once — or one
 * screen re-rendering mid-flight — join the same request instead of racing.
 * Module-level rather than in the store: a promise is not state to render.
 */
const inFlight = new Map<Resource, Promise<void>>();

const IDLE: ResourceState = { status: 'idle', error: null };

function idleResources(): Record<Resource, ResourceState> {
  return Object.fromEntries(ALL_RESOURCES.map((r) => [r, IDLE])) as Record<
    Resource,
    ResourceState
  >;
}

export const useTeaStore = create<TeaStoreState>((set, get) => ({
  factoryProfile: null,
  teaItems: [],
  externalFactories: [],
  sellingPeriods: [],
  ourItemPrices: [],
  ourBulkResults: [],
  externalFactoryResults: [],
  bulkSets: [],
  range: fullRange([]),

  resources: idleResources(),
  rangeInitialised: false,
  saving: false,

  ensure: async (needs, options = {}) => {
    const { force = false, revalidate = false } = options;

    const mark = (resource: Resource, next: ResourceState) =>
      set((state) => ({ resources: { ...state.resources, [resource]: next } }));

    /**
     * Fetch one resource. Never rejects: a failure is recorded against that
     * resource and shown by the screens that asked for it, rather than
     * becoming an unhandled rejection in whatever effect happened to call.
     */
    const loadOne = async (resource: Resource): Promise<boolean> => {
      const already = get().resources[resource].status === 'ready';
      if (already && !force && !revalidate) return true;

      const existing = inFlight.get(resource);
      if (existing) {
        await existing;
        return get().resources[resource].status === 'ready';
      }

      // Revalidating data we already hold must not blank the screen: the tab
      // renders what it has while the request is in the air, and swaps in the
      // answer when it lands. Only a first load and an explicit retry show the
      // gate.
      const quiet = already && revalidate && !force;

      const run = (async () => {
        if (!quiet) mark(resource, { status: 'loading', error: null });
        try {
          const patch = await FETCHERS[resource](get().sellingPeriods);
          set((state) => ({
            ...patch,
            resources: { ...state.resources, [resource]: { status: 'ready', error: null } },
          }));

          // The first sight of the auctions decides the default range. Later
          // loads must not: by then the user may have chosen one, and silently
          // widening it would move every figure on screen.
          if (resource === 'periods' && !get().rangeInitialised) {
            set({ range: fullRange(get().sellingPeriods), rangeInitialised: true });
          }
        } catch (error) {
          // A failed revalidation keeps the data we already had. Replacing a
          // working screen with an error page because a background refresh
          // missed would be worse than showing figures a minute old.
          if (!quiet) mark(resource, { status: 'error', error: describe(error) });
        } finally {
          inFlight.delete(resource);
        }
      })();

      inFlight.set(resource, run);
      await run;
      return get().resources[resource].status === 'ready';
    };

    // Pull in what the asked-for resources are built on, then load in two
    // waves: everything independent together, then everything that needed it.
    const wanted = new Set(needs);
    for (const need of needs) for (const dep of DEPENDS_ON[need] ?? []) wanted.add(dep);

    const independent = [...wanted].filter((r) => !DEPENDS_ON[r]);
    const dependent = [...wanted].filter((r) => DEPENDS_ON[r]);

    await Promise.all(independent.map(loadOne));

    // A dependant whose dependency failed would fan out over an empty list and
    // record itself ready with nothing in it — worse than staying unloaded.
    const satisfied = dependent.filter((r) =>
      (DEPENDS_ON[r] ?? []).every((dep) => get().resources[dep].status === 'ready'),
    );
    await Promise.all(satisfied.map(loadOne));
  },

  setRange: (range) => set({ range, rangeInitialised: true }),
  resetRange: () => set({ range: fullRange(get().sellingPeriods), rangeInitialised: true }),

  recordOurPrices: async (sellingPeriodId, entries) => {
    set({ saving: true });
    try {
      await api.prices.recordOurPrices(sellingPeriodId, entries);
      const ourPrices = await api.prices.ourPrices(sellingPeriodId);
      set((state) => ({
        ourItemPrices: [
          ...state.ourItemPrices.filter((p) => p.sellingPeriodId !== sellingPeriodId),
          ...ourPrices,
        ],
      }));
    } finally {
      set({ saving: false });
    }
  },

  recordOurBulkResult: async (sellingPeriodId, pricePerKg, bulkSetId = null) => {
    set({ saving: true });
    try {
      const recorded = await api.prices.recordOurBulkResult(sellingPeriodId, {
        pricePerKg,
        bulkSetId,
      });
      set((state) => ({
        ourBulkResults: [
          ...state.ourBulkResults.filter((r) => r.sellingPeriodId !== sellingPeriodId),
          recorded,
        ],
      }));
    } finally {
      set({ saving: false });
    }
  },

  blendOurBulkResult: async (sellingPeriodId, bulkSetId = null) => {
    set({ saving: true });
    try {
      const recorded = await api.prices.blendOurBulkResult(sellingPeriodId, { bulkSetId });
      set((state) => ({
        ourBulkResults: [
          ...state.ourBulkResults.filter((r) => r.sellingPeriodId !== sellingPeriodId),
          recorded,
        ],
      }));
    } finally {
      set({ saving: false });
    }
  },

  recordExternalResults: async (sellingPeriodId, entries) => {
    set({ saving: true });
    try {
      await api.prices.recordExternalResults(sellingPeriodId, entries);
      const results = await api.prices.externalResults(sellingPeriodId);
      set((state) => ({
        externalFactoryResults: [
          ...state.externalFactoryResults.filter((r) => r.sellingPeriodId !== sellingPeriodId),
          ...results,
        ],
      }));
    } finally {
      set({ saving: false });
    }
  },

  /**
   * Create or update a set, then read it back.
   *
   * The API keeps the header and the lines apart — `PATCH` cannot move
   * quantities and `PUT /items` cannot rename — so an edit is two calls. The
   * set that comes back is the database's version, not the draft, so a rejected
   * or adjusted save can never look like it succeeded.
   */
  addTeaItem: async (input) => {
    set({ saving: true });
    try {
      const item = await api.teaItems.create(input);
      set((state) => ({
        teaItems: [...state.teaItems, item].sort(
          (a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code),
        ),
      }));
      return item;
    } finally {
      set({ saving: false });
    }
  },

  updateTeaItem: async (id, patch) => {
    set({ saving: true });
    try {
      const item = await api.teaItems.update(id, patch);
      set((state) => ({
        teaItems: state.teaItems
          .map((t) => (t.id === id ? item : t))
          .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code)),
      }));
      return item;
    } finally {
      set({ saving: false });
    }
  },

  removeTeaItem: async (id) => {
    set({ saving: true });
    try {
      await api.teaItems.remove(id);
      set((state) => ({ teaItems: state.teaItems.filter((t) => t.id !== id) }));
    } finally {
      set({ saving: false });
    }
  },

  setTeaItemActive: async (id, active) => {
    set({ saving: true });
    try {
      const item = await api.teaItems.setActive(id, active);
      set((state) => ({ teaItems: state.teaItems.map((t) => (t.id === id ? item : t)) }));
    } finally {
      set({ saving: false });
    }
  },

  updateFactoryProfile: async (patch) => {
    set({ saving: true });
    try {
      const profile = await api.factoryProfile.update(patch);
      set({ factoryProfile: profile });
      return profile;
    } finally {
      set({ saving: false });
    }
  },

  addExternalFactory: async (input) => {
    set({ saving: true });
    try {
      const factory = await api.externalFactories.create(input);
      set((state) => ({
        externalFactories: [...state.externalFactories, factory].sort((a, b) =>
          a.code.localeCompare(b.code),
        ),
      }));
      return factory;
    } finally {
      set({ saving: false });
    }
  },

  updateExternalFactory: async (id, patch) => {
    set({ saving: true });
    try {
      const factory = await api.externalFactories.update(id, patch);
      set((state) => ({
        externalFactories: state.externalFactories
          .map((f) => (f.id === id ? factory : f))
          .sort((a, b) => a.code.localeCompare(b.code)),
      }));
      return factory;
    } finally {
      set({ saving: false });
    }
  },

  removeExternalFactory: async (id) => {
    set({ saving: true });
    try {
      await api.externalFactories.remove(id);
      set((state) => ({
        externalFactories: state.externalFactories.filter((f) => f.id !== id),
      }));
    } finally {
      set({ saving: false });
    }
  },

  setExternalFactoryActive: async (id, active) => {
    set({ saving: true });
    try {
      const updated = await api.externalFactories.setActive(id, active);
      set((state) => ({
        externalFactories: state.externalFactories.map((f) => (f.id === id ? updated : f)),
      }));
    } finally {
      set({ saving: false });
    }
  },

  saveBulkSet: async (input) => {
    set({ saving: true });
    try {
      const saved = input.id
        ? await (async () => {
            await api.bulkSets.update(input.id!, {
              reference: input.reference,
              targetSellingPeriodId: input.targetSellingPeriodId,
            });
            return api.bulkSets.replaceItems(input.id!, input.items);
          })()
        : await api.bulkSets.create({
            reference: input.reference,
            targetSellingPeriodId: input.targetSellingPeriodId,
            items: input.items,
          });

      set((state) => ({
        bulkSets: state.bulkSets.some((b) => b.id === saved.id)
          ? state.bulkSets.map((b) => (b.id === saved.id ? saved : b))
          : [saved, ...state.bulkSets],
      }));

      return saved;
    } finally {
      set({ saving: false });
    }
  },

  addSellingPeriod: async (label, auctionDate) => {
    set({ saving: true });
    try {
      const period = await api.sellingPeriods.create({ label, auctionDate });
      set((state) => ({
        sellingPeriods: [...state.sellingPeriods, period].sort((a, b) =>
          a.auctionDate.localeCompare(b.auctionDate),
        ),
      }));
      return period;
    } finally {
      set({ saving: false });
    }
  },

  markPeriodSold: async (id) => {
    const updated = await api.sellingPeriods.setStatus(id, 'sold');
    set((state) => ({
      sellingPeriods: state.sellingPeriods.map((p) => (p.id === id ? updated : p)),
    }));
  },
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

/**
 * The grades in play.
 *
 * The cache holds retired grades too, so they stay manageable on Item Prices —
 * but nothing new should be priced or planned against one, so every screen that
 * offers an input reads this rather than the raw list.
 */
export function selectActiveTeaItems(state: Snapshot): TeaItem[] {
  return state.teaItems.filter((item) => item.active);
}

/**
 * The factories still counted in the benchmark.
 *
 * Retired ones stay in the cache so they can be managed and read, but nothing
 * new should be priced against one — and `selectMarketAverage` already leaves
 * them out of the average, so offering them for entry would collect figures
 * that go nowhere.
 */
export function selectActiveExternalFactories(state: Snapshot): ExternalFactory[] {
  return state.externalFactories.filter((factory) => factory.active);
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
 * The set currently being planned: most recently built, not yet sold.
 *
 * Distinct from [selectLatestBulkSet] on purpose. That one answers "which mix
 * did this auction sell?", so it must still see sold sets. This one answers
 * "what are we working on now?", where a set that has already gone to auction
 * is finished business.
 *
 * Ordered by `createdAt` rather than by status or by position in the array:
 * a draft built today is a newer plan than a pending set from last month, and
 * the array's order is only newest-first by accident of how the API lists them.
 */
export function selectLatestPlannedBulkSet(state: Snapshot): BulkSet | null {
  return (
    state.bulkSets
      .filter((b) => b.status !== 'sold')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .at(-1) ?? null
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

/**
 * One bulk set, valued twice.
 *
 * PLANNED is the plan — the very figure Prepare Bulk Set shows for this set:
 * every grade at our own historical average, weighted by the set's kilos. It
 * goes through `valueBulkSetItems` with the same range that screen uses, so the
 * two screens compute one number by one route and cannot drift apart.
 *
 * ACTUAL is that same set after it sold, each grade at the price it fetched.
 * Same grades, same kilos — only the price source changes.
 *
 * The difference between them is offered only when BOTH sides cover the whole
 * set. A forecast over 1,000 kg set against a sale over 650 kg would report the
 * missing 350 kg as a price movement, so until every grade is both priced and
 * forecastable the verdict is 'unknown' rather than a number that looks whole.
 */
export interface PlanVersusOutcome {
  /** The set at our historical averages — what Prepare Bulk Set shows. */
  planned: BulkSetValuation;
  /** The same set at what its grades actually fetched. */
  actual: BulkSetValuation;
  /** actual − planned. 'unknown' unless both sides cover every grade. */
  comparison: Comparison;
  /** True when both sides price every kilo, so the difference means something. */
  comparable: boolean;
}

export function selectPlanVersusOutcome(
  state: Snapshot,
  items: readonly BulkSetItem[],
  sellingPeriodId: string,
  range: DateRange,
  actualPrices?: ReadonlyMap<string, number>,
): PlanVersusOutcome {
  const planned = valueBulkSetItems(state, items, range);
  const actual = valueBulkSetAtPrices(
    state,
    items,
    actualPrices ?? selectOurPricesForPeriod(state, sellingPeriodId),
  );

  const whole = (v: BulkSetValuation) =>
    v.totalQuantityKg > 0 && v.pricedQuantityKg === v.totalQuantityKg;
  const comparable = whole(planned) && whole(actual);

  return {
    planned,
    actual,
    comparison: comparable
      ? compare(actual.expectedPricePerKg, planned.expectedPricePerKg)
      : { differencePerKg: null, differencePercent: null, verdict: 'unknown' },
    comparable,
  };
}

/**
 * Every grade's price record over one date range, with its average.
 *
 * The average is the plain mean of the auctions in range — one price per
 * auction, corrections already resolved — which is the same rule the planning
 * screen values a bulk set at. The per-auction prices ride along so a figure
 * can be checked against the sales it came from rather than taken on trust.
 */
export interface ItemPricePoint {
  sellingPeriodId: string;
  label: string;
  auctionDate: string;
  pricePerKg: number;
}

export interface ItemPriceBreakdown {
  teaItemId: string;
  teaItemCode: string;
  teaItemName: string;
  category: string | null;
  /** Retired grades still appear here — their history is still worth reading. */
  active: boolean;
  averagePricePerKg: number | null;
  /** How many auctions in range the average is drawn from. */
  periodsCounted: number;
  lowestPricePerKg: number | null;
  highestPricePerKg: number | null;
  /** The most recent price in range, and the auction it came from. */
  latestPricePerKg: number | null;
  latestPeriodLabel: string | null;
  /** Latest against the range average — where this grade is trending. */
  latestAgainstAverage: Comparison;
  /** Oldest first, so a row reads left to right as time passes. */
  points: ItemPricePoint[];
}

export function selectItemPriceBreakdown(
  state: Snapshot,
  range: DateRange,
): ItemPriceBreakdown[] {
  const periods = periodsInRange(state, range);
  const byId = new Map(periods.map((p) => [p.id, p]));

  const current = latestPerKey(
    state.ourItemPrices.filter((p) => byId.has(p.sellingPeriodId)),
    (p) => `${p.teaItemId}|${p.sellingPeriodId}`,
  );

  const pointsByItem = new Map<string, ItemPricePoint[]>();
  for (const price of current) {
    const period = byId.get(price.sellingPeriodId)!;
    const point: ItemPricePoint = {
      sellingPeriodId: period.id,
      label: period.label,
      auctionDate: period.auctionDate,
      pricePerKg: price.pricePerKg,
    };
    const bucket = pointsByItem.get(price.teaItemId);
    if (bucket) bucket.push(point);
    else pointsByItem.set(price.teaItemId, [point]);
  }

  // Retired grades included on purpose: this is the screen where they are
  // managed, and a grade's past sales stay meaningful after it is retired.
  return state.teaItems
    .map((item) => {
      const points = (pointsByItem.get(item.id) ?? []).sort((a, b) =>
        a.auctionDate.localeCompare(b.auctionDate),
      );
      const prices = points.map((p) => p.pricePerKg);
      const summary = blendedAverage(prices);
      const latest = points.at(-1) ?? null;

      return {
        teaItemId: item.id,
        teaItemCode: item.code,
        teaItemName: item.name,
        category: item.category,
        active: item.active,
        averagePricePerKg: summary.averagePricePerKg,
        periodsCounted: summary.periodsCounted,
        lowestPricePerKg: prices.length > 0 ? Math.min(...prices) : null,
        highestPricePerKg: prices.length > 0 ? Math.max(...prices) : null,
        latestPricePerKg: latest?.pricePerKg ?? null,
        latestPeriodLabel: latest?.label ?? null,
        latestAgainstAverage: compare(latest?.pricePerKg ?? null, summary.averagePricePerKg),
        points,
      };
    });
}

/**
 * Every factory's published price over one date range, with its average — and
 * the benchmark those prices make.
 *
 * The market average is a flat mean, Σ(price) ÷ number of factories. Unweighted
 * of necessity: other factories never publish their bulk weights, so there is
 * nothing to weight by. `perPeriod` is that sum and count auction by auction,
 * which is the benchmark at its most literal.
 */
export interface FactoryPriceBreakdown {
  externalFactoryId: string;
  code: string;
  name: string;
  region: string | null;
  /** Retired factories are listed so they can be managed, and marked as such. */
  active: boolean;
  averagePricePerKg: number | null;
  periodsCounted: number;
  lowestPricePerKg: number | null;
  highestPricePerKg: number | null;
  latestPricePerKg: number | null;
  latestPeriodLabel: string | null;
  latestAgainstAverage: Comparison;
  points: ItemPricePoint[];
}

export interface MarketPeriodAverage {
  sellingPeriodId: string;
  label: string;
  auctionDate: string;
  averagePricePerKg: number | null;
  factoriesCounted: number;
  prices: { externalFactoryId: string; code: string; pricePerKg: number }[];
}

export function selectFactoryPriceBreakdown(
  state: Snapshot,
  range: DateRange,
): FactoryPriceBreakdown[] {
  const periods = periodsInRange(state, range);
  const byId = new Map(periods.map((p) => [p.id, p]));

  const current = latestPerKey(
    state.externalFactoryResults.filter((r) => byId.has(r.sellingPeriodId)),
    (r) => `${r.externalFactoryId}|${r.sellingPeriodId}`,
  );

  const pointsByFactory = new Map<string, ItemPricePoint[]>();
  for (const row of current) {
    const period = byId.get(row.sellingPeriodId)!;
    const point: ItemPricePoint = {
      sellingPeriodId: period.id,
      label: period.label,
      auctionDate: period.auctionDate,
      pricePerKg: row.pricePerKg,
    };
    const bucket = pointsByFactory.get(row.externalFactoryId);
    if (bucket) bucket.push(point);
    else pointsByFactory.set(row.externalFactoryId, [point]);
  }

  return state.externalFactories.map((factory) => {
    const points = (pointsByFactory.get(factory.id) ?? []).sort((a, b) =>
      a.auctionDate.localeCompare(b.auctionDate),
    );
    const prices = points.map((p) => p.pricePerKg);
    const summary = blendedAverage(prices);
    const latest = points.at(-1) ?? null;

    return {
      externalFactoryId: factory.id,
      code: factory.code,
      name: factory.name,
      region: factory.region,
      active: factory.active,
      averagePricePerKg: summary.averagePricePerKg,
      periodsCounted: summary.periodsCounted,
      lowestPricePerKg: prices.length > 0 ? Math.min(...prices) : null,
      highestPricePerKg: prices.length > 0 ? Math.max(...prices) : null,
      latestPricePerKg: latest?.pricePerKg ?? null,
      latestPeriodLabel: latest?.label ?? null,
      latestAgainstAverage: compare(latest?.pricePerKg ?? null, summary.averagePricePerKg),
      points,
    };
  });
}

/** The benchmark auction by auction: Σ(price) ÷ factories that reported. */
export function selectMarketPerPeriod(
  state: Snapshot,
  range: DateRange,
): MarketPeriodAverage[] {
  const periods = periodsInRange(state, range);
  const codeById = new Map(state.externalFactories.map((f) => [f.id, f.code]));

  return periods.map((period) => {
    const rows = latestPerKey(
      state.externalFactoryResults.filter((r) => r.sellingPeriodId === period.id),
      (r) => r.externalFactoryId,
    );
    const summary = marketAverage(rows);

    return {
      sellingPeriodId: period.id,
      label: period.label,
      auctionDate: period.auctionDate,
      averagePricePerKg: summary.averagePricePerKg,
      factoriesCounted: summary.factoriesCounted,
      prices: rows.map((r) => ({
        externalFactoryId: r.externalFactoryId,
        code: codeById.get(r.externalFactoryId) ?? '—',
        pricePerKg: r.pricePerKg,
      })),
    };
  });
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
