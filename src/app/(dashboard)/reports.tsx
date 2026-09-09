import React, { useMemo, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/colors';
import { useLoadedStore } from '@/components/data-state';
import Header from '@/components/header';
import VerdictBadge from '@/components/verdict-badge';
import { ChartIcon } from '@/components/ui-icons';
import { formatAuctionDate, formatRs, formatSignedRs } from '@/domain/averaging';
import {
  periodsInRange,
  selectExternalResultsForPeriod,
  selectMarketAverage,
  selectOurBulkAverage,
  selectOurItemAverages,
  selectActiveTeaItems,
  selectOurPricesForPeriod,
  selectOverallComparison,
  selectPeriodComparisons,
  useTeaStore,
} from '@/store/tea-store';

type Filter = 'all' | 'above' | 'below';

/**
 * The record: every auction, what we got, what the market got.
 *
 * The date range at the top drives every figure on the screen — our averages
 * and the market benchmark alike — so the two sides are always measured over
 * the same span.
 */
export default function ReportsScreen() {
  const { ready, gate } = useLoadedStore();
  const state = useTeaStore();
  const { sellingPeriods, externalFactories } = state;
  const teaItems = selectActiveTeaItems(state);
  const setRange = useTeaStore((s) => s.setRange);
  const resetRange = useTeaStore((s) => s.resetRange);
  const { range } = state;

  const [filter, setFilter] = useState<Filter>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const comparisons = selectPeriodComparisons(state, range);
  const ourBulk = selectOurBulkAverage(state, range);
  const market = selectMarketAverage(state, range);
  const overall = selectOverallComparison(state, range);
  const itemAverages = selectOurItemAverages(state, range);

  const visible = comparisons.filter((c) =>
    filter === 'all' ? true : filter === 'above' ? c.verdict === 'above' : c.verdict === 'below',
  );

  // Quick range presets over the auctions we actually have.
  const presets = useMemo(() => {
    const sorted = [...sellingPeriods].sort((a, b) => a.auctionDate.localeCompare(b.auctionDate));
    const dates = sorted.map((p) => p.auctionDate);
    const build = (count: number) => {
      const slice = dates.slice(-count);
      return slice.length > 0 ? { from: slice[0]!, to: dates.at(-1)! } : null;
    };
    return [
      { label: 'All auctions', value: null },
      { label: 'Last 3', value: build(3) },
      { label: 'Last 5', value: build(5) },
    ];
  }, [sellingPeriods]);

  const allPeriods = periodsInRange(state, range);

  if (!ready) return gate;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        greeting="Auction History"
        subTitle={`${formatAuctionDate(range.from)} — ${formatAuctionDate(range.to)} · ${allPeriods.length} auctions`}
        notificationCount={0}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Range + filter */}
        <View style={styles.controlsCard}>
          <View style={styles.controlGroup}>
            <Text style={styles.controlLabel}>RANGE</Text>
            <View style={styles.chipRow}>
              {presets.map((preset) => {
                const active = preset.value
                  ? range.from === preset.value.from && range.to === preset.value.to
                  : false;
                return (
                  <Pressable
                    key={preset.label}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => (preset.value ? setRange(preset.value) : resetRange())}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {preset.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.controlGroup}>
            <Text style={styles.controlLabel}>SHOW</Text>
            <View style={styles.chipRow}>
              {(['all', 'above', 'below'] as Filter[]).map((option) => (
                <Pressable
                  key={option}
                  style={[styles.chip, filter === option && styles.chipActive]}
                  onPress={() => setFilter(option)}>
                  <Text style={[styles.chipText, filter === option && styles.chipTextActive]}>
                    {option === 'all' ? 'All' : option === 'above' ? 'Above market' : 'Below market'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* Range summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryBlock}>
            <Text style={styles.summaryLabel}>OUR BULK AVERAGE</Text>
            <Text style={styles.summaryValue}>Rs. {formatRs(ourBulk.averagePricePerKg)}</Text>
            <Text style={styles.summaryMeta}>across {ourBulk.periodsCounted} auctions</Text>
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
                { color: overall.verdict === 'below' ? Colors.below : Colors.above },
              ]}>
              {formatSignedRs(overall.differencePerKg)}
            </Text>
            <VerdictBadge verdict={overall.verdict} percent={overall.differencePercent} compact />
          </View>
        </View>

        {/* Auction by auction */}
        <View style={styles.sectionCard}>
          <View style={styles.headingRow}>
            <View style={[styles.headingIcon, { backgroundColor: '#F0FDF4' }]}>
              <ChartIcon color={Colors.primary} size={18} />
            </View>
            <View style={styles.headingText}>
              <Text style={styles.sectionTitle}>Auction by Auction</Text>
              <Text style={styles.sectionSubtitle}>
                Our blended bulk price against the market&apos;s for that same auction. Tap a row to
                see what each factory reported.
              </Text>
            </View>
          </View>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, styles.colAuction]}>Auction</Text>
              <Text style={[styles.th, styles.colNum]}>Our Bulk</Text>
              <Text style={[styles.th, styles.colNum]}>Market</Text>
              <Text style={[styles.th, styles.colNum]}>Difference</Text>
              <Text style={[styles.th, styles.colVerdict]}>Result</Text>
            </View>

            {visible.length === 0 && (
              <View style={styles.emptyRow}>
                <Text style={styles.emptyText}>No auctions match this filter.</Text>
              </View>
            )}

            {visible.map((comparison) => {
              const open = expanded === comparison.sellingPeriodId;
              const factoryPrices = open
                ? selectExternalResultsForPeriod(state, comparison.sellingPeriodId)
                : null;
              const itemPrices = open
                ? selectOurPricesForPeriod(state, comparison.sellingPeriodId)
                : null;

              return (
                <View key={comparison.sellingPeriodId}>
                  <Pressable
                    style={[styles.tableRow, open && styles.tableRowOpen]}
                    onPress={() => setExpanded(open ? null : comparison.sellingPeriodId)}>
                    <View style={styles.colAuction}>
                      <Text style={styles.tdBold}>{comparison.label}</Text>
                      <Text style={styles.tdMuted}>
                        {formatAuctionDate(comparison.auctionDate)}
                        {comparison.status === 'upcoming' ? ' · upcoming' : ''}
                      </Text>
                    </View>
                    <Text style={[styles.tdBold, styles.colNum]}>
                      {formatRs(comparison.ourBulkPricePerKg)}
                    </Text>
                    <Text style={[styles.tdText, styles.colNum]}>
                      {formatRs(comparison.marketAveragePricePerKg)}
                    </Text>
                    <Text
                      style={[
                        styles.tdBold,
                        styles.colNum,
                        {
                          color:
                            comparison.verdict === 'below'
                              ? Colors.below
                              : comparison.verdict === 'above'
                                ? Colors.above
                                : Colors.textSecondary,
                        },
                      ]}>
                      {formatSignedRs(comparison.differencePerKg)}
                    </Text>
                    <View style={styles.colVerdict}>
                      <VerdictBadge
                        verdict={comparison.verdict}
                        percent={comparison.differencePercent}
                        compact
                      />
                    </View>
                  </Pressable>

                  {open && (
                    <View style={styles.detail}>
                      <View style={styles.detailColumn}>
                        <Text style={styles.detailHeading}>
                          Our tea item prices at this auction
                        </Text>
                        {teaItems.map((item) => (
                          <View key={item.id} style={styles.detailRow}>
                            <Text style={styles.detailKey}>{item.code}</Text>
                            <Text style={styles.detailValue}>
                              {itemPrices?.has(item.id)
                                ? `Rs. ${formatRs(itemPrices.get(item.id)!)}`
                                : '—'}
                            </Text>
                          </View>
                        ))}
                      </View>

                      <View style={styles.detailColumn}>
                        <Text style={styles.detailHeading}>
                          Other factories&apos; bulk prices
                        </Text>
                        {externalFactories.map((factory) => (
                          <View key={factory.id} style={styles.detailRow}>
                            <Text style={styles.detailKey}>{factory.code}</Text>
                            <Text style={styles.detailValue}>
                              {factoryPrices?.has(factory.id)
                                ? `Rs. ${formatRs(factoryPrices.get(factory.id)!)}`
                                : '—'}
                            </Text>
                          </View>
                        ))}
                        <Text style={styles.detailNote}>
                          One blended figure each — no per-item breakdown exists for other
                          factories.
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Our per-item averages over the range */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Our Tea Item Averages</Text>
          <Text style={styles.sectionSubtitle}>
            Mean achieved price per kg over the selected range, one entry per auction.
          </Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, styles.colAuction]}>Tea Item</Text>
              <Text style={[styles.th, styles.colNum]}>Auctions</Text>
              <Text style={[styles.th, styles.colNum]}>Average (Rs/kg)</Text>
            </View>
            {itemAverages.map((average) => (
              <View key={average.teaItemId} style={styles.tableRow}>
                <View style={styles.colAuction}>
                  <Text style={styles.tdBold}>{average.teaItemCode}</Text>
                  <Text style={styles.tdMuted}>{average.teaItemName}</Text>
                </View>
                <Text style={[styles.tdText, styles.colNum]}>{average.periodsCounted}</Text>
                <Text style={[styles.tdBold, styles.colNum]}>
                  {average.averagePricePerKg === null
                    ? 'no history'
                    : formatRs(average.averagePricePerKg)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  scrollContent: { padding: 20, gap: 20, paddingBottom: 48 },

  controlsCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  controlGroup: { gap: 8, minWidth: 200, flex: 1 },
  controlLabel: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.8 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive: { color: Colors.primary },

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
  summaryBlock: { flex: 1, minWidth: 160, gap: 3 },
  summaryDivider: { width: 1, backgroundColor: Colors.border },
  summaryLabel: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.6 },
  summaryValue: { fontSize: 20, fontWeight: '700', color: Colors.text },
  summaryMeta: { fontSize: 11, color: Colors.textSecondary },

  sectionCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 14,
  },
  headingRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  headingIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  headingText: { flex: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  sectionSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2, lineHeight: 17 },

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
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 8,
  },
  tableRowOpen: { backgroundColor: '#F8FAFC' },
  colAuction: { flex: 2.2 },
  colNum: { flex: 1.3, textAlign: 'right' },
  colVerdict: { flex: 1.6, alignItems: 'flex-end' },
  tdBold: { fontSize: 13, fontWeight: '600', color: Colors.text },
  tdText: { fontSize: 13, color: Colors.textSecondary },
  tdMuted: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },

  emptyRow: { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 13, color: Colors.textSecondary },

  detail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
    padding: 16,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailColumn: { flex: 1, minWidth: 220, gap: 5 },
  detailHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  detailKey: { fontSize: 12, color: Colors.text, fontWeight: '600' },
  detailValue: { fontSize: 12, color: Colors.textSecondary },
  detailNote: { fontSize: 11, color: Colors.textSecondary, marginTop: 6, lineHeight: 15 },
});
