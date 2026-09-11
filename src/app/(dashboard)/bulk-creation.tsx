import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api';
import { Colors } from '@/constants/colors';
import { useScreenData } from '@/components/data-state';
import Header from '@/components/header';
import {
  FilterPills,
  PickerCard,
  SearchField,
  pickerStyles,
} from '@/components/picker-card';
import VerdictBadge from '@/components/verdict-badge';
import { PlusIcon, LeafIcon } from '@/components/ui-icons';
import {
  compare,
  formatAuctionDate,
  formatKg,
  formatPercent,
  formatRs,
  formatSignedRs,
} from '@/domain/averaging';
import type { BulkSetItem } from '@/domain/types';
import {
  selectActiveTeaItems,
  selectLatestPlannedBulkSet,
  selectMarketAverage,
  selectOurItemAverages,
  selectPlanVersusOutcome,
  selectUpcomingPeriod,
  useTeaStore,
  valueBulkSetItems,
} from '@/store/tea-store';

/**
 * Planning the next bulk set. Half of a two-step story.
 *
 *   HERE   — choose the grades and the kilos, and see what that mix would be
 *            worth per kg AT OUR HISTORICAL AVERAGES. A forecast, not a sale.
 *   THERE  — Record Auction Results takes the very same grades and kilos and
 *            re-prices them at what they actually fetched.
 *
 * Nothing about the mix changes between the two. The only difference is which
 * price each grade is valued at, which is what makes planned and actual
 * comparable at all — and why both screens weight through the same function.
 *
 * Type quantities and the expected value updates live: each item priced at our
 * own historical average, weighted by its share of the kilos, then compared
 * against the one market figure we have.
 *
 * The per-item rows deliberately carry no market column. Other factories report
 * a single blended number, so a market price for BOP does not exist to show.
 *
 * Saving goes to the API and waits for it. The set that comes back is the
 * database's, not the draft — so a reference clash or a rejected quantity shows
 * as the failure it is rather than as a success message over nothing saved.
 */
export default function BulkSetScreen() {
  // values a set at our item averages, against the market benchmark
  const { ready, gate } = useScreenData(['bulkSets', 'externalResults', 'factories', 'itemPrices', 'periods', 'profile', 'teaItems']);
  const state = useTeaStore();
  const { bulkSets, sellingPeriods, range } = state;
  // A retired grade cannot go into a new set; sets that already hold one keep
  // it, because their quantities are on file.
  const teaItems = selectActiveTeaItems(state);
  const saveBulkSet = useTeaStore((s) => s.saveBulkSet);
  const saving = useTeaStore((s) => s.saving);

  const upcoming = selectUpcomingPeriod(state);
  // Newest first, so the pill row reads most-recent-plan to oldest regardless
  // of how the list happens to be ordered in the cache.
  const editable = bulkSets
    .filter((b) => b.status !== 'sold')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = bulkSets.find((b) => b.id === selectedId) ?? null;

  const [reference, setReference] = useState(selected?.reference ?? nextReference(bulkSets));
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    seedQuantities(selected?.items ?? []),
  );
  const [notice, setNotice] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);

  /*
   * Open on the newest plan, once the cache has something to open on.
   *
   * This cannot be a useState initialiser: the store is filled from the API
   * after the first render, so the initialiser only ever sees an empty list.
   * It cannot be a plain "if nothing is selected" guard either — null is a
   * legitimate state here, meaning the user pressed New set, and re-selecting
   * behind them would make that button impossible to use. Hence a one-shot.
   */
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || state.resources.bulkSets.status !== 'ready') return;
    seeded.current = true;

    const latest = selectLatestPlannedBulkSet(state);
    if (latest) {
      setSelectedId(latest.id);
      setReference(latest.reference);
      setQuantities(seedQuantities(latest.items));
    } else {
      // Nothing to edit, but the reference still has to follow the sets that
      // do exist, or a new set is proposed as BS-103 forever.
      setReference(nextReference(state.bulkSets));
    }
  }, [state]);

  const switchSet = (id: string | null) => {
    const target = id ? bulkSets.find((b) => b.id === id) ?? null : null;
    setSelectedId(id);
    setReference(target?.reference ?? nextReference(bulkSets));
    setQuantities(seedQuantities(target?.items ?? []));
    setNotice(null);
  };

  // -------------------------------------------------------- choosing a set
  //
  // As on Auction Results: one set on show, the rest behind a search. There is
  // no date filter here, and that is deliberate — an auction IS a date, but a
  // bulk set is a named plan. You look for BS-103, or for whatever is still a
  // draft; nobody remembers the day a plan was typed. Its date is shown as
  // context instead of offered as a filter.
  const [picking, setPicking] = useState(false);
  const [setQuery, setSetQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'pending'>('all');

  const setNeedle = setQuery.trim().toLowerCase();
  const visibleSets = editable.filter((set) => {
    if (statusFilter !== 'all' && set.status !== statusFilter) return false;
    if (setNeedle === '') return true;
    return `${set.reference} ${set.status} ${set.notes ?? ''}`.toLowerCase().includes(setNeedle);
  });

  const draftItems: BulkSetItem[] = useMemo(
    () =>
      teaItems
        .map((item) => ({ teaItemId: item.id, quantityKg: parseQuantity(quantities[item.id] ?? '') }))
        .filter((item): item is BulkSetItem => item.quantityKg !== null && item.quantityKg > 0)
        .map((item) => ({ teaItemId: item.teaItemId, quantityKg: item.quantityKg })),
    [teaItems, quantities],
  );

  const valuation = valueBulkSetItems(state, draftItems, range);
  const market = selectMarketAverage(state, range);
  const averages = selectOurItemAverages(state, range);
  const averageByItem = new Map(averages.map((a) => [a.teaItemId, a]));
  const verdict = compare(valuation.expectedPricePerKg, market.averagePricePerKg);

  const save = async () => {
    if (draftItems.length === 0) {
      setNotice({ text: 'Add a quantity for at least one tea item before saving.', tone: 'error' });
      return;
    }
    if (reference.trim() === '') {
      setNotice({ text: 'Give the set a reference before saving.', tone: 'error' });
      return;
    }

    try {
      const saved = await saveBulkSet({
        id: selectedId ?? undefined,
        reference: reference.trim(),
        targetSellingPeriodId: selected?.targetSellingPeriodId ?? upcoming?.id ?? null,
        items: draftItems,
      });

      // Re-seed from what the database actually stored, not from the draft.
      setSelectedId(saved.id);
      setReference(saved.reference);
      setQuantities(seedQuantities(saved.items));
      setNotice({
        text: `Saved ${saved.reference} to the database — ${saved.items.length} grades, ${formatKg(
          saved.items.reduce((sum, item) => sum + item.quantityKg, 0),
        )} kg.`,
        tone: 'ok',
      });
    } catch (error) {
      setNotice({
        text:
          error instanceof ApiError
            ? `Not saved — ${error.message}`
            : 'Not saved — the API could not be reached.',
        tone: 'error',
      });
    }
  };

  if (!ready) return gate;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        greeting="Prepare Bulk Set"
        subTitle={
          upcoming
            ? `For ${upcoming.label} · ${formatAuctionDate(upcoming.auctionDate)}`
            : 'No upcoming auction scheduled'
        }
        notificationCount={0}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Which set — the one in hand, with the rest behind a search */}
        <PickerCard
          label="BULK SET"
          open={picking}
          onToggle={() => setPicking((on) => !on)}
          action={{
            label: '+ New set',
            onPress: () => {
              switchSet(null);
              setPicking(false);
            },
          }}
          summary={
            selected ? (
              <View>
                <Text style={pickerStyles.chosenTitle}>{selected.reference}</Text>
                <Text style={pickerStyles.chosenMeta}>
                  {selected.items.length} item{selected.items.length === 1 ? '' : 's'} ·{' '}
                  {selected.status} · created {formatAuctionDate(selected.createdAt.slice(0, 10))}
                </Text>
              </View>
            ) : (
              <View>
                <Text style={pickerStyles.chosenTitle}>New set · {reference}</Text>
                <Text style={pickerStyles.chosenMeta}>
                  {draftItems.length === 0
                    ? 'Nothing entered yet — add kilos below.'
                    : `Not saved yet — ${formatKg(valuation.totalQuantityKg)} kg across ${
                        draftItems.length
                      } grade${draftItems.length === 1 ? '' : 's'}.`}
                </Text>
              </View>
            )
          }>
          <SearchField
            value={setQuery}
            onChangeText={setSetQuery}
            placeholder="Search by reference, status or note…"
          />

          <FilterPills
            options={[
              { value: 'all', label: 'All' },
              { value: 'draft', label: 'Draft' },
              { value: 'pending', label: 'Pending' },
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
          />

          <Text style={pickerStyles.count}>
            {visibleSets.length} of {editable.length} set{editable.length === 1 ? '' : 's'} · sold
            sets are not listed, because their quantities are on the record and cannot be edited
          </Text>

          {visibleSets.length === 0 ? (
            <Text style={pickerStyles.empty}>
              No set matches. Clear the search, or start a new set.
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.pillRow}>
                {visibleSets.map((set) => {
                  const active = set.id === selectedId;
                  return (
                    <Pressable
                      key={set.id}
                      style={[styles.pill, active && styles.pillActive]}
                      onPress={() => {
                        switchSet(set.id);
                        setPicking(false);
                      }}>
                      <Text style={[styles.pillTitle, active && styles.pillTitleActive]}>
                        {set.reference}
                      </Text>
                      <Text style={[styles.pillMeta, active && styles.pillMetaActive]}>
                        {set.items.length} items · {set.status}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  style={styles.pillNew}
                  onPress={() => {
                    switchSet(null);
                    setPicking(false);
                  }}>
                  <PlusIcon color={Colors.primary} size={14} />
                  <Text style={styles.pillNewText}>New set</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}
        </PickerCard>

        {notice && (
          <View style={[styles.notice, notice.tone === 'error' && styles.noticeError]}>
            <Text style={[styles.noticeText, notice.tone === 'error' && styles.noticeErrorText]}>
              {notice.text}
            </Text>
          </View>
        )}

        {/* Headline valuation */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryBlock}>
            <Text style={styles.summaryLabel}>TOTAL QUANTITY</Text>
            <Text style={styles.summaryValue}>{formatKg(valuation.totalQuantityKg)} kg</Text>
            <Text style={styles.summaryMeta}>
              {draftItems.length} tea item{draftItems.length === 1 ? '' : 's'}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryBlock}>
            <Text style={styles.summaryLabel}>PLANNED AVG PER KG</Text>
            <Text style={styles.summaryValue}>
              Rs. {formatRs(valuation.expectedPricePerKg)}
            </Text>
            {/* The working, not just the answer — it moves with every keystroke,
                so showing the division makes clear what the number is made of. */}
            <Text style={styles.summaryMeta}>
              {valuation.totalValue === null
                ? 'Enter quantities to value the set'
                : `Rs. ${formatRs(valuation.totalValue, 0)} ÷ ${formatKg(valuation.pricedQuantityKg)} kg`}
            </Text>
            <Text style={styles.summaryMeta}>at historical averages</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryBlock}>
            <Text style={styles.summaryLabel}>MARKET AVERAGE</Text>
            <Text style={[styles.summaryValue, { color: '#B8860B' }]}>
              Rs. {formatRs(market.averagePricePerKg)}
            </Text>
            <Text style={styles.summaryMeta}>{market.factoriesCounted} other factories</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryBlock}>
            <Text style={styles.summaryLabel}>DIFFERENCE</Text>
            <Text
              style={[
                styles.summaryValue,
                {
                  color:
                    verdict.verdict === 'below'
                      ? Colors.below
                      : verdict.verdict === 'unknown'
                        ? Colors.textSecondary
                        : Colors.above,
                },
              ]}>
              {formatSignedRs(verdict.differencePerKg)}
            </Text>
            <VerdictBadge verdict={verdict.verdict} percent={verdict.differencePercent} compact />
          </View>
        </View>

        {valuation.unpricedTeaItemCodes.length > 0 && (
          <View style={styles.warningRow}>
            <Text style={styles.warningText}>
              {valuation.unpricedTeaItemCodes.join(', ')} ha
              {valuation.unpricedTeaItemCodes.length === 1 ? 's' : 've'} no price history in the
              selected range, so {formatKg(valuation.totalQuantityKg - valuation.pricedQuantityKg)} kg
              is excluded from the expected value. Coverage:{' '}
              {formatPercent(valuation.coverage)}.
            </Text>
          </View>
        )}

        {/* Quantity entry + live line valuation */}
        <View style={styles.sectionCard}>
          <View style={styles.headingRow}>
            <View style={[styles.headingIcon, { backgroundColor: Colors.primaryLight }]}>
              <LeafIcon color={Colors.primary} size={18} />
            </View>
            <View style={styles.headingText}>
              <Text style={styles.sectionTitle}>Set Reference &amp; Quantities</Text>
              <Text style={styles.sectionSubtitle}>
                Each item is valued at our own historical average. There is no market price per
                item — other factories only report one blended figure.
              </Text>
            </View>
          </View>

          <View style={styles.refRow}>
            <Text style={styles.refLabel}>Reference</Text>
            <TextInput
              style={styles.refInput}
              value={reference}
              onChangeText={setReference}
              placeholder="BS-103"
              placeholderTextColor={Colors.textSecondary}
            />
          </View>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, styles.colItem]}>Tea Item</Text>
              <Text style={[styles.th, styles.colQty]}>Quantity (kg)</Text>
              <Text style={[styles.th, styles.colNum]}>Our Avg (Rs/kg)</Text>
              <Text style={[styles.th, styles.colNum]}>Line Value</Text>
              <Text style={[styles.th, styles.colNum]}>Share</Text>
            </View>

            {teaItems.map((item) => {
              const average = averageByItem.get(item.id);
              const line = valuation.lines.find((l) => l.teaItemId === item.id);
              const hasPrice = average?.averagePricePerKg !== null && average !== undefined;

              // A line is "in the set" exactly when it has a quantity — that is
              // what customising the mix means here, so it should look like it.
              const inSet = line !== undefined;

              return (
                <View key={item.id} style={[styles.tableRow, inSet && styles.tableRowInSet]}>
                  <View style={styles.colItem}>
                    <Text style={styles.tdBold}>{item.code}</Text>
                    <Text style={styles.tdMuted}>{item.name}</Text>
                  </View>

                  <View style={styles.colQty}>
                    <TextInput
                      style={styles.qtyInput}
                      value={quantities[item.id] ?? ''}
                      onChangeText={(text) =>
                        setQuantities((prev) => ({ ...prev, [item.id]: text }))
                      }
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={Colors.textSecondary}
                    />
                  </View>

                  <Text
                    style={[
                      styles.tdBold,
                      styles.colNum,
                      !hasPrice && { color: Colors.textSecondary, fontWeight: '400' },
                    ]}>
                    {hasPrice ? formatRs(average!.averagePricePerKg) : 'no history'}
                  </Text>
                  <Text style={[styles.tdText, styles.colNum]}>
                    {line?.lineValue == null ? '—' : formatRs(line.lineValue, 0)}
                  </Text>
                  <Text style={[styles.tdText, styles.colNum]}>
                    {line?.shareOfValue == null ? '—' : formatPercent(line.shareOfValue)}
                  </Text>
                </View>
              );
            })}

            {/* The sum the average comes from, so the column adds up on screen */}
            <View style={styles.tableTotalRow}>
              <Text style={[styles.tdBold, styles.colItem]}>
                {draftItems.length} item{draftItems.length === 1 ? '' : 's'} in set
              </Text>
              <Text style={[styles.tdBold, styles.colQty]}>
                {formatKg(valuation.totalQuantityKg)} kg
              </Text>
              <Text style={[styles.tdBold, styles.colNum, { color: Colors.primary }]}>
                {formatRs(valuation.expectedPricePerKg)}
              </Text>
              <Text style={[styles.tdBold, styles.colNum]}>
                {valuation.totalValue === null ? '—' : formatRs(valuation.totalValue, 0)}
              </Text>
              <Text style={[styles.tdBold, styles.colNum]}>
                {valuation.totalValue === null ? '—' : formatPercent(1)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.planNote}>
          <Text style={styles.planNoteTitle}>This is a plan, not a sale</Text>
          <Text style={styles.planNoteText}>
            Every grade here is valued at what it has averaged for us in the past, so the figure
            above is what this mix would be worth if prices held. When the set actually sells, enter
            the day&rsquo;s prices on Record Auction Results — the same grades and kilos are
            re-priced there, and the two figures sit side by side.
          </Text>
        </View>

        <Pressable
          style={[styles.saveButton, saving && styles.saveButtonBusy]}
          disabled={saving}
          onPress={save}>
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving…' : `Save ${reference || 'bulk set'}`}
          </Text>
        </Pressable>
        <Text style={styles.footNote}>
          This is decision support. The system never sets a selling price — it shows what the set is
          expected to be worth so you can judge it against the market.
        </Text>

        {/* Sold sets, for reference */}
        {bulkSets.some((b) => b.status === 'sold') && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Sold Bulk Sets</Text>
            <Text style={styles.sectionSubtitle}>
              How earlier plans turned out. Each set is valued twice at the same kilos — at the
              averages known before its auction, then at what its grades actually fetched there.
            </Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, styles.colItem]}>Reference</Text>
                <Text style={[styles.th, styles.colNum]}>Total kg</Text>
                <Text style={[styles.th, styles.colNum]}>Planned</Text>
                <Text style={[styles.th, styles.colNum]}>Actual</Text>
                <Text style={[styles.th, styles.colNum]}>Vs plan</Text>
              </View>
              {bulkSets
                .filter((b) => b.status === 'sold')
                .map((set) => {
                  const period = sellingPeriods.find((p) => p.id === set.targetSellingPeriodId);
                  const total = set.items.reduce((sum, i) => sum + i.quantityKg, 0);

                  // Without an auction to sell into there is no outcome to show,
                  // only the mix.
                  const outcome = period
                    ? selectPlanVersusOutcome(state, set.items, period.id, range)
                    : null;

                  return (
                    <View key={set.id} style={styles.tableRow}>
                      <View style={styles.colItem}>
                        <Text style={styles.tdBold}>{set.reference}</Text>
                        <Text style={styles.tdMuted}>
                          {period ? period.label : 'no auction'} · {set.items.length} grades
                        </Text>
                      </View>
                      <Text style={[styles.tdText, styles.colNum]}>{formatKg(total)}</Text>
                      <Text style={[styles.tdText, styles.colNum]}>
                        {formatRs(outcome?.planned.expectedPricePerKg ?? null)}
                      </Text>
                      <Text style={[styles.tdBold, styles.colNum]}>
                        {formatRs(outcome?.actual.expectedPricePerKg ?? null)}
                      </Text>
                      <Text
                        style={[
                          styles.tdBold,
                          styles.colNum,
                          {
                            color:
                              outcome?.comparison.verdict === 'below'
                                ? Colors.below
                                : outcome?.comparison.verdict === 'unknown'
                                  ? Colors.textSecondary
                                  : Colors.above,
                          },
                        ]}>
                        {formatSignedRs(outcome?.comparison.differencePerKg ?? null)}
                      </Text>
                    </View>
                  );
                })}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function seedQuantities(items: readonly BulkSetItem[]): Record<string, string> {
  return Object.fromEntries(items.map((item) => [item.teaItemId, String(item.quantityKg)]));
}

function nextReference(existing: readonly { reference: string }[]): string {
  const numbers = existing
    .map((set) => Number(set.reference.replace(/\D/g, '')))
    .filter((n) => Number.isFinite(n) && n > 0);
  const next = numbers.length > 0 ? Math.max(...numbers) + 1 : 103;
  return `BS-${next}`;
}

function parseQuantity(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100) / 100;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  scrollContent: { padding: 20, gap: 20, paddingBottom: 48 },

  pillRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  pill: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 120,
  },
  pillActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  pillTitle: { fontSize: 13, fontWeight: '700', color: Colors.text },
  pillTitleActive: { color: Colors.primary },
  pillMeta: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  pillMetaActive: { color: Colors.primary },
  pillNew: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.primary,
  },
  pillNewText: { fontSize: 13, fontWeight: '600', color: Colors.primary },

  notice: {
    backgroundColor: Colors.aboveLight,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.above,
  },
  noticeText: { fontSize: 13, color: Colors.above, fontWeight: '600' },
  noticeError: { backgroundColor: Colors.belowLight, borderColor: Colors.below },
  noticeErrorText: { color: Colors.below },

  summaryCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 14,
  },
  summaryBlock: { flex: 1, minWidth: 150, gap: 3 },
  summaryDivider: { width: 1, backgroundColor: Colors.border },
  summaryLabel: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.6 },
  summaryValue: { fontSize: 20, fontWeight: '700', color: Colors.text },
  summaryMeta: { fontSize: 11, color: Colors.textSecondary },

  warningRow: {
    backgroundColor: Colors.accentLight,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F0D48A',
  },
  warningText: { fontSize: 12, color: '#8A6D1F', lineHeight: 18 },

  sectionCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 16,
  },
  headingRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  headingIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  headingText: { flex: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  sectionSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2, lineHeight: 17 },

  refRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  refLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  refInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    minWidth: 160,
  },

  table: { borderRadius: 8, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  th: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 8,
  },
  tableRowInSet: { backgroundColor: '#F6FBF6' },
  tableTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 8,
  },
  colItem: { flex: 2.2 },
  colQty: { flex: 1.4 },
  colNum: { flex: 1.3, textAlign: 'right' },
  tdBold: { fontSize: 13, fontWeight: '600', color: Colors.text },
  tdText: { fontSize: 13, color: Colors.textSecondary },
  tdMuted: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  qtyInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },

  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveButtonBusy: { opacity: 0.6 },
  saveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  footNote: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center', lineHeight: 16 },

  planNote: {
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: '#CDE7CF',
    borderRadius: 10,
    padding: 14,
    gap: 4,
  },
  planNoteTitle: { fontSize: 13, fontWeight: '700', color: Colors.primaryDark },
  planNoteText: { fontSize: 12, color: '#3F6B42', lineHeight: 18 },
});
