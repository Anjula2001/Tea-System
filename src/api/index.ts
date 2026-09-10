import type {
  BulkSet,
  BulkSetWithItems,
  ExternalFactory,
  ExternalFactoryResult,
  FactoryProfile,
  OurBulkResult,
  OurItemPrice,
  SellingPeriod,
  TeaItem,
} from '@/domain/types';

import { http } from './client';

/**
 * Every endpoint the app uses, typed.
 *
 * Names mirror the routes rather than the screens, so a reader can find the
 * backend handler from the call site without guessing.
 */

export const api = {
  /** Us — the one identity here that is not somebody else's factory. */
  factoryProfile: {
    get: () => http.get<FactoryProfile>('/factory-profile'),
    /** No id: there is exactly one profile. */
    update: (body: { name?: string; shortName?: string; region?: string | null }) =>
      http.patch<FactoryProfile>('/factory-profile', body),
  },

  teaItems: {
    list: (includeInactive = false) =>
      http.get<TeaItem[]>(`/tea-items?includeInactive=${includeInactive}`),
    create: (body: {
      code: string;
      name: string;
      category?: string | null;
      sortOrder?: number;
    }) => http.post<TeaItem>('/tea-items', body),
    update: (
      id: string,
      body: { code?: string; name?: string; category?: string | null; sortOrder?: number },
    ) => http.patch<TeaItem>(`/tea-items/${id}`, body),
    /** Only succeeds while nothing references the grade; 409 otherwise. */
    remove: (id: string) => http.delete<void>(`/tea-items/${id}`),
    setActive: (id: string, active: boolean) =>
      http.patch<TeaItem>(`/tea-items/${id}/active`, { active }),
  },

  externalFactories: {
    list: (includeInactive = false) =>
      http.get<ExternalFactory[]>(`/external-factories?includeInactive=${includeInactive}`),
    create: (body: { code: string; name: string; region?: string | null }) =>
      http.post<ExternalFactory>('/external-factories', body),
    update: (id: string, body: { code?: string; name?: string; region?: string | null }) =>
      http.patch<ExternalFactory>(`/external-factories/${id}`, body),
    /** Only succeeds while the factory has no results on file; 409 otherwise. */
    remove: (id: string) => http.delete<void>(`/external-factories/${id}`),
    setActive: (id: string, active: boolean) =>
      http.patch<ExternalFactory>(`/external-factories/${id}/active`, { active }),
  },

  sellingPeriods: {
    list: () => http.get<SellingPeriod[]>('/selling-periods'),
    create: (body: { label: string; auctionDate: string; status?: 'upcoming' | 'sold' }) =>
      http.post<SellingPeriod>('/selling-periods', body),
    setStatus: (id: string, status: 'upcoming' | 'sold') =>
      http.patch<SellingPeriod>(`/selling-periods/${id}/status`, { status }),
  },

  bulkSets: {
    list: () => http.get<BulkSet[]>('/bulk-sets'),
    /** The set on the bench — what an auction's prices are blended through. */
    latest: () => http.get<BulkSetWithItems | null>('/bulk-sets/latest'),
    get: (id: string) => http.get<BulkSetWithItems>(`/bulk-sets/${id}`),
    create: (body: {
      reference: string;
      targetSellingPeriodId?: string | null;
      notes?: string | null;
      items: { teaItemId: string; quantityKg: number }[];
    }) => http.post<BulkSetWithItems>('/bulk-sets', body),
    update: (
      id: string,
      body: { reference?: string; targetSellingPeriodId?: string | null; notes?: string | null },
    ) => http.patch<BulkSetWithItems>(`/bulk-sets/${id}`, body),
    /** Replaces every line on the set. Rejected once the set is sold. */
    replaceItems: (id: string, items: { teaItemId: string; quantityKg: number }[]) =>
      http.put<BulkSetWithItems>(`/bulk-sets/${id}/items`, { items }),
  },

  prices: {
    ourPrices: (sellingPeriodId: string) =>
      http.get<OurItemPrice[]>(`/selling-periods/${sellingPeriodId}/our-prices`),
    recordOurPrices: (
      sellingPeriodId: string,
      entries: { teaItemId: string; pricePerKg: number }[],
    ) => http.post<OurItemPrice[]>(`/selling-periods/${sellingPeriodId}/our-prices`, { entries }),

    ourBulkResult: (sellingPeriodId: string) =>
      http.get<OurBulkResult | null>(`/selling-periods/${sellingPeriodId}/our-bulk-result`),
    /** Type the figure by hand — the broker's number when it disagrees with ours. */
    recordOurBulkResult: (
      sellingPeriodId: string,
      body: { pricePerKg: number; bulkSetId?: string | null },
    ) => http.post<OurBulkResult>(`/selling-periods/${sellingPeriodId}/our-bulk-result`, body),
    /**
     * Derive the figure from the item prices and record it. Rejected with 422
     * while any grade in the set is still unpriced.
     */
    blendOurBulkResult: (sellingPeriodId: string, body: { bulkSetId?: string | null } = {}) =>
      http.post<OurBulkResult>(`/selling-periods/${sellingPeriodId}/our-bulk-result/blend`, body),

    externalResults: (sellingPeriodId: string) =>
      http.get<ExternalFactoryResult[]>(`/selling-periods/${sellingPeriodId}/external-results`),
    recordExternalResults: (
      sellingPeriodId: string,
      entries: { externalFactoryId: string; pricePerKg: number }[],
    ) =>
      http.post<ExternalFactoryResult[]>(`/selling-periods/${sellingPeriodId}/external-results`, {
        entries,
      }),
  },
};

export { ApiError, API_BASE_URL } from './client';
