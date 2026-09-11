import React from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Colors } from '@/constants/colors';
import { useScreenData } from '@/components/data-state';
import Header from '@/components/header';
import TrendChart from '@/components/weekly-chart';
import VerdictBadge from '@/components/verdict-badge';
import { MoneyIcon, LeafIcon, ChartIcon, PlusIcon, ChevronRightIcon } from '@/components/ui-icons';
import { formatAuctionDate, formatKg, formatRs, formatSignedRs } from '@/domain/averaging';
import {
  selectBulkSetValuation,
  selectLatestPlannedBulkSet,
  selectMarketAverage,
  selectOurBulkAverage,
  selectOurItemAverages,
  selectOverallComparison,
  selectPeriodComparisons,
  selectUpcomingPeriod,
  useTeaStore,
} from '@/store/tea-store';

/**
 * The decision screen.
 *
 * Two comparisons, and they answer different questions:
 *
 *   Looking back — what our bulk actually fetched vs what the market fetched.
 *                  Like for like: both are blended Rs/kg for a whole bulk set.
 *   Looking ahead — the bulk set we are preparing, valued at our own per-item
 *                  averages, against that same market benchmark.
 *
 * There is no per-tea-item market column anywhere, because other factories only
 * ever report one blended number. Showing one would mean inventing it.
 */
export default function DashboardScreen() {
  const router = useRouter();
  // the whole picture: our prices, the market, and the set being prepared
  const { ready, gate } = useScreenData(['bulkResults', 'bulkSets', 'externalResults', 'factories', 'itemPrices', 'periods', 'profile', 'teaItems']);
  const state = useTeaStore();
  const { range, factoryProfile: profile } = state;

  const ourBulk = selectOurBulkAverage(state, range);
  const market = selectMarketAverage(state, range);
  const overall = selectOverallComparison(state, range);
  const itemAverages = selectOurItemAverages(state, range);
  const comparisons = selectPeriodComparisons(state, range);
  const upcoming = selectUpcomingPeriod(state);

  const lastSold = [...comparisons].reverse().find((c) => c.status === 'sold') ?? null;

  // The newest set still on the bench, whatever its status — a draft built
  // today is a later plan than a pending set from last month.
  const pendingSet = selectLatestPlannedBulkSet(state);
  const valuation = pendingSet ? selectBulkSetValuation(state, pendingSet.id, range) : null;
  const forward = valuation
    ? {
        expected: valuation.expectedPricePerKg,
        diff:
          valuation.expectedPricePerKg !== null && market.averagePricePerKg !== null
            ? Math.round((valuation.expectedPricePerKg - market.averagePricePerKg) * 100) / 100
            : null,
      }
    : null;

  if (!ready) return gate;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        greeting={profile?.name ?? 'Loading…'}
        subTitle={
          upcoming
            ? `Preparing for ${upcoming.label} · ${formatAuctionDate(upcoming.auctionDate)}`
            : 'No upcoming auction scheduled'
        }
        notificationCount={valuation?.unpricedTeaItemCodes.length ?? 0}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Headline: our blended bulk price against the market's */}
        <View style={styles.metricsGrid}>
          <MetricCard
            label="Our Bulk Average"
            value={formatRs(ourBulk.averagePricePerKg)}
            unit="/ kg"
            caption={`Blended across ${ourBulk.periodsCounted} auction${ourBulk.periodsCounted === 1 ? '' : 's'}`}
            icon={<LeafIcon color={Colors.primary} size={20} />}
            tint={Colors.primaryLight}
          />
          <MetricCard
            label="Market Average"
            value={formatRs(market.averagePricePerKg)}
            unit="/ kg"
            caption={`${market.factoriesCounted} other factories reporting`}
            icon={<MoneyIcon color="#B8860B" size={20} />}
            tint="#FFF8E1"
          />
          <MetricCard
            label="Our Position"
            value={formatSignedRs(overall.differencePerKg)}
            unit={overall.verdict === 'unknown' ? '' : '/ kg'}
            caption="Our bulk average vs the market"
            icon={
              <ChartIcon
                color={overall.verdict === 'below' ? Colors.below : Colors.above}
                size={20}
              />
            }
            tint={overall.verdict === 'below' ? Colors.belowLight : Colors.aboveLight}
            badge={<VerdictBadge verdict={overall.verdict} percent={overall.differencePercent} />}
          />
          <MetricCard
            label={lastSold ? `Last Auction · ${lastSold.label}` : 'Last Auction'}
            value={formatRs(lastSold?.ourBulkPricePerKg ?? null)}
            unit="/ kg"
            caption={
              lastSold
                ? `Market ${formatRs(lastSold.marketAveragePricePerKg)} · ${formatSignedRs(lastSold.differencePerKg)}`
                : 'No auction recorded yet'
            }
            icon={<ChartIcon color={Colors.primary} size={20} />}
            tint="#F0FDF4"
          />
        </View>

        {/* Quick actions */}
        <View style={styles.quickActionsContainer}>
          <Pressable style={styles.quickActionButton} onPress={() => router.push('/price-input')}>
            <View style={[styles.actionIconCircle, { backgroundColor: '#E0F2FE' }]}>
              <MoneyIcon color="#0284C7" size={18} />
            </View>
            <View style={styles.actionTextGroup}>
              <Text style={styles.actionTitle}>Record Auction Results</Text>
              <Text style={styles.actionDesc}>
                Our per-item prices, our bulk price, and other factories&apos; bulk prices
              </Text>
            </View>
            <ChevronRightIcon color={Colors.textSecondary} size={16} />
          </Pressable>

          <Pressable style={styles.quickActionButton} onPress={() => router.push('/bulk-creation')}>
            <View style={[styles.actionIconCircle, { backgroundColor: Colors.primaryLight }]}>
              <PlusIcon color={Colors.primary} size={18} />
            </View>
            <View style={styles.actionTextGroup}>
              <Text style={styles.actionTitle}>Prepare the Next Bulk Set</Text>
              <Text style={styles.actionDesc}>Choose grades and kilos, see the planned value</Text>
            </View>
            <ChevronRightIcon color={Colors.textSecondary} size={16} />
          </Pressable>
        </View>

        {/* Forward-looking: the set we are preparing */}
        {pendingSet && valuation && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.flexOne}>
                <Text style={styles.sectionTitle}>
                  Upcoming Bulk Set · {pendingSet.reference}
                </Text>
                <Text style={styles.sectionSubtitle}>
                  {formatKg(valuation.totalQuantityKg)} kg valued at our own item averages,
                  quantity-weighted. The actual figure follows once it sells.
                </Text>
              </View>
              <Pressable onPress={() => router.push('/bulk-creation')}>
                <Text style={styles.viewAllText}>Edit set</Text>
              </Pressable>
            </View>

            <View style={styles.expectedRow}>
              <View style={styles.expectedBlock}>
                <Text style={styles.expectedLabel}>PLANNED AVG PER KG</Text>
                <Text style={styles.expectedValue}>Rs. {formatRs(forward?.expected ?? null)}</Text>
                <Text style={styles.expectedUnit}>at historical averages</Text>
              </View>
              <View style={styles.expectedDivider} />
              <View style={styles.expectedBlock}>
                <Text style={styles.expectedLabel}>MARKET AVERAGE</Text>
                <Text style={[styles.expectedValue, { color: '#B8860B' }]}>
                  Rs. {formatRs(market.averagePricePerKg)}
                </Text>
                <Text style={styles.expectedUnit}>per kg</Text>
              </View>
              <View style={styles.expectedDivider} />
              <View style={styles.expectedBlock}>
                <Text style={styles.expectedLabel}>DIFFERENCE</Text>
                <Text
                  style={[
                    styles.expectedValue,
                    { color: (forward?.diff ?? 0) >= 0 ? Colors.above : Colors.below },
                  ]}>
                  {formatSignedRs(forward?.diff ?? null)}
                </Text>
                <Text style={styles.expectedUnit}>per kg</Text>
              </View>
            </View>

            {valuation.unpricedTeaItemCodes.length > 0 && (
              <View style={styles.warningRow}>
                <Text style={styles.warningText}>
                  No price history for {valuation.unpricedTeaItemCodes.join(', ')} — excluded from
                  the average. {Math.round(valuation.coverage * 100)}% of the set is priced.
                </Text>
              </View>
            )}

            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, styles.colItem]}>Tea Item</Text>
                <Text style={[styles.th, styles.colNum]}>Quantity</Text>
                <Text style={[styles.th, styles.colNum]}>Our Avg (Rs/kg)</Text>
                <Text style={[styles.th, styles.colNum]}>Line Value</Text>
              </View>
              {valuation.lines.map((line) => (
                <View key={line.teaItemId} style={styles.tableRow}>
                  <View style={styles.colItem}>
                    <Text style={styles.tdBold}>{line.teaItemCode}</Text>
                    <Text style={styles.tdMuted}>{line.teaItemName}</Text>
                  </View>
                  <Text style={[styles.tdText, styles.colNum]}>
                    {formatKg(line.quantityKg)} kg
                  </Text>
                  <Text style={[styles.tdBold, styles.colNum]}>
                    {line.ourAveragePricePerKg === null
                      ? 'no history'
                      : formatRs(line.ourAveragePricePerKg)}
                  </Text>
                  <Text style={[styles.tdText, styles.colNum]}>
                    {line.lineValue === null ? '—' : formatRs(line.lineValue, 0)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Backward-looking: our bulk vs market, auction by auction */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.flexOne}>
              <Text style={styles.sectionTitle}>Our Bulk Price vs the Market</Text>
              <Text style={styles.sectionSubtitle}>
                Blended Rs/kg for the whole bulk set, auction by auction
              </Text>
            </View>
            <View style={styles.chartLegend}>
              <LegendDot color={Colors.primary} label="Our bulk" />
              <LegendDot color="#D4A017" label="Market" />
            </View>
          </View>
          <TrendChart comparisons={comparisons} />
        </View>

        {/* Our per-item averages — no market column, that data does not exist */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.flexOne}>
              <Text style={styles.sectionTitle}>Our Tea Item Averages</Text>
              <Text style={styles.sectionSubtitle}>
                Mean achieved price per kg across the selected auctions. Other factories report
                only a blended figure, so there is no market price per item.
              </Text>
            </View>
            <Pressable onPress={() => router.push('/reports')}>
              <Text style={styles.viewAllText}>Full history</Text>
            </Pressable>
          </View>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, styles.colItem]}>Tea Item</Text>
              <Text style={[styles.th, styles.colNum]}>Auctions</Text>
              <Text style={[styles.th, styles.colNum]}>Our Average (Rs/kg)</Text>
            </View>
            {itemAverages.map((average) => (
              <View key={average.teaItemId} style={styles.tableRow}>
                <View style={styles.colItem}>
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

function MetricCard({
  label,
  value,
  unit,
  caption,
  icon,
  tint,
  badge,
}: {
  label: string;
  value: string;
  unit?: string;
  caption: string;
  icon: React.ReactNode;
  tint: string;
  badge?: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardLabel}>{label}</Text>
        <View style={[styles.iconBox, { backgroundColor: tint }]}>{icon}</View>
      </View>
      <Text style={styles.metricValue}>
        {value.startsWith('+') || value.startsWith('−') || value === '—' ? '' : 'Rs. '}
        {value}
        {unit ? <Text style={styles.unitText}> {unit}</Text> : null}
      </Text>
      <Text style={styles.subtext}>{caption}</Text>
      {/* Last, and pinned to the floor: only one card carries a badge, and
          above the figure it pushed that card's number a row below every
          other card's. Down here it fills slack the neighbours already had. */}
      {badge ? <View style={styles.cardBadge}>{badge}</View> : null}
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  scrollContent: { padding: 20, gap: 20, paddingBottom: 48 },
  flexOne: { flex: 1, minWidth: 220 },

  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  card: {
    flex: 1,
    minWidth: 220,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  metricValue: { fontSize: 22, fontWeight: '700', color: Colors.text },
  cardBadge: { marginTop: 'auto', paddingTop: 2, flexDirection: 'row' },
  unitText: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  subtext: { fontSize: 11, color: Colors.textSecondary },

  quickActionsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  quickActionButton: {
    flex: 1,
    minWidth: 260,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionIconCircle: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionTextGroup: { flex: 1 },
  actionTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
  actionDesc: { fontSize: 12, color: Colors.textSecondary },

  sectionCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  sectionSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  viewAllText: { fontSize: 13, fontWeight: '600', color: Colors.primary },

  expectedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 12,
  },
  expectedBlock: { flex: 1, minWidth: 130, gap: 2 },
  expectedDivider: { width: 1, backgroundColor: Colors.border },
  expectedLabel: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.6 },
  expectedValue: { fontSize: 20, fontWeight: '700', color: Colors.text },
  expectedUnit: { fontSize: 11, color: Colors.textSecondary },

  warningRow: {
    backgroundColor: Colors.accentLight,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F0D48A',
  },
  warningText: { fontSize: 12, color: '#8A6D1F', lineHeight: 18 },

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
  colItem: { flex: 2.4 },
  colNum: { flex: 1.3, textAlign: 'right' },
  tdBold: { fontSize: 13, fontWeight: '600', color: Colors.text },
  tdText: { fontSize: 13, color: Colors.textSecondary },
  tdMuted: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },

  chartLegend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
});
