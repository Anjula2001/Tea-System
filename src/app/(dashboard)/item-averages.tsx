import React, { useMemo, useState } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/colors';
import { useLoadedStore } from '@/components/data-state';
import Header from '@/components/header';
import { LeafIcon } from '@/components/ui-icons';
import { formatAuctionDate, formatPercent, formatRs } from '@/domain/averaging';
import type { DateRange } from '@/domain/types';
import { periodsInRange, selectItemPriceBreakdown, useTeaStore } from '@/store/tea-store';

/**
 * What has 1 kg of each grade been worth, over any stretch of time you choose.
 *
 * The range here is deliberately LOCAL to this screen. Every other figure in
 * the app — the planning forecast, the dashboard, History — is drawn from the
 * shared range, and letting an exploratory question quietly re-base those would
 * be a nasty surprise. Ask what you like here; nothing else moves.
 *
 * Dates are typed rather than picked from a calendar widget: prices only exist
 * at auctions, so the useful boundaries are auction dates, and the shortcuts
 * below set them directly. The text fields are there for the odd question a
 * shortcut does not answer.
 */
export default function ItemAveragesScreen() {
  const { ready, gate } = useLoadedStore();
  const state = useTeaStore();
  const { sellingPeriods } = state;

  const sorted = useMemo(
    () => [...sellingPeriods].sort((a, b) => a.auctionDate.localeCompare(b.auctionDate)),
    [sellingPeriods],
  );
  const bounds = useMemo<DateRange>(
    () =>
      sorted.length > 0
        ? { from: sorted[0]!.auctionDate, to: sorted.at(-1)!.auctionDate }
        : { from: '1970-01-01', to: '9999-12-31' },
    [sorted],
  );

  // The applied range, and the two fields being edited toward it. Keeping them
  // apart means a half-typed date never blanks the table underneath.
  const [range, setRange] = useState<DateRange | null>(null);
  const [fromDraft, setFromDraft] = useState('');
  const [toDraft, setToDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const applied = range ?? bounds;
  const fromValue = fromDraft || applied.from;
  const toValue = toDraft || applied.to;

  const apply = (next: DateRange) => {
    setRange(next);
    setFromDraft(next.from);
    setToDraft(next.to);
    setError(null);
    setExpanded(null);
  };

  const applyTyped = () => {
    if (!isIsoDate(fromValue) || !isIsoDate(toValue)) {
      setError('Dates must be written as YYYY-MM-DD, for example 2026-06-03.');
      return;
    }
    if (fromValue > toValue) {
      setError('The start date must not be after the end date.');
      return;
    }
    apply({ from: fromValue, to: toValue });
  };

  /** Shortcuts over the auctions we actually have, newest-anchored. */
  const presets = useMemo(() => {
    const dates = sorted.map((p) => p.auctionDate);
    const lastN = (count: number) => {
      const slice = dates.slice(-count);
      return slice.length > 0 ? { from: slice[0]!, to: dates.at(-1)! } : null;
    };
    const thisYear = () => {
      const year = dates.at(-1)?.slice(0, 4);
      return year ? { from: `${year}-01-01`, to: `${year}-12-31` } : null;
    };
    return [
      { label: 'All auctions', value: bounds },
      { label: 'Last 3', value: lastN(3) },
      { label: 'Last 6', value: lastN(6) },
      { label: 'This year', value: thisYear() },
    ].filter((p): p is { label: string; value: DateRange } => p.value !== null);
  }, [sorted, bounds]);

  const breakdown = selectItemPriceBreakdown(state, applied);
  const periods = periodsInRange(state, applied);
  const withData = breakdown.filter((row) => row.periodsCounted > 0);

  if (!ready) return gate;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        greeting="Tea Item Prices"
        subTitle={
          periods.length > 0
            ? `${periods.length} auction${periods.length === 1 ? '' : 's'} · ${formatAuctionDate(
                applied.from,
              )} – ${formatAuctionDate(applied.to)}`
            : 'No auctions in this period'
        }
        notificationCount={0}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Choosing the period */}
        <View style={styles.card}>
          <View style={styles.headingRow}>
            <View style={styles.headingIcon}>
              <LeafIcon color={Colors.primary} size={18} />
            </View>
            <View style={styles.headingText}>
              <Text style={styles.sectionTitle}>Period</Text>
              <Text style={styles.sectionSubtitle}>
                What 1 kg of each grade averaged between these dates. This period applies to this
                screen only — nothing else in the app changes.
              </Text>
            </View>
          </View>

          <View style={styles.pillRow}>
            {presets.map((preset) => {
              const active =
                applied.from === preset.value.from && applied.to === preset.value.to;
              return (
                <Pressable
                  key={preset.label}
                  style={[styles.pill, active && styles.pillActive]}
                  onPress={() => apply(preset.value)}>
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>
                    {preset.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text style={styles.dateLabel}>FROM</Text>
              <TextInput
                style={styles.dateInput}
                value={fromValue}
                onChangeText={setFromDraft}
                placeholder="2026-06-03"
                placeholderTextColor={Colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={styles.dateField}>
              <Text style={styles.dateLabel}>TO</Text>
              <TextInput
                style={styles.dateInput}
                value={toValue}
                onChangeText={setToDraft}
                placeholder="2026-09-16"
                placeholderTextColor={Colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <Pressable style={styles.applyButton} onPress={applyTyped}>
              <Text style={styles.applyButtonText}>Apply</Text>
            </Pressable>
            <Pressable style={styles.resetButton} onPress={() => apply(bounds)}>
              <Text style={styles.resetButtonText}>Reset</Text>
            </Pressable>
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          {periods.length > 0 ? (
            <Text style={styles.periodList}>
              Counting: {periods.map((p) => p.label).join(' · ')}
            </Text>
          ) : (
            <Text style={styles.periodList}>
              No auction falls between these dates, so there is nothing to average.
            </Text>
          )}
        </View>

        {/* The answer */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Average price per kg</Text>
          <Text style={styles.sectionSubtitle}>
            The mean of every auction in the period — one price per auction, corrections resolved.
            The same average the planning screen values a bulk set at. Tap a grade to see the
            sales behind it.
          </Text>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, styles.colItem]}>Tea Item</Text>
              <Text style={[styles.th, styles.colNum]}>Auctions</Text>
              <Text style={[styles.th, styles.colNum]}>Low</Text>
              <Text style={[styles.th, styles.colNum]}>High</Text>
              <Text style={[styles.th, styles.colNum]}>Average</Text>
            </View>

            {breakdown.map((row) => {
              const open = expanded === row.teaItemId;
              const hasData = row.periodsCounted > 0;

              return (
                <View key={row.teaItemId}>
                  <Pressable
                    style={[styles.tableRow, open && styles.tableRowOpen]}
                    onPress={() => hasData && setExpanded(open ? null : row.teaItemId)}>
                    <View style={styles.colItem}>
                      <Text style={styles.tdBold}>{row.teaItemCode}</Text>
                      <Text style={styles.tdMuted}>{row.teaItemName}</Text>
                    </View>
                    <Text style={[styles.tdText, styles.colNum]}>
                      {hasData ? row.periodsCounted : '—'}
                    </Text>
                    <Text style={[styles.tdText, styles.colNum]}>
                      {formatRs(row.lowestPricePerKg)}
                    </Text>
                    <Text style={[styles.tdText, styles.colNum]}>
                      {formatRs(row.highestPricePerKg)}
                    </Text>
                    <Text style={[styles.tdBold, styles.colNum, styles.average]}>
                      {formatRs(row.averagePricePerKg)}
                    </Text>
                  </Pressable>

                  {open && (
                    <View style={styles.detail}>
                      <Text style={styles.detailHeading}>
                        {row.teaItemCode} at each auction in this period
                      </Text>
                      {row.points.map((point) => {
                        const gap =
                          row.averagePricePerKg === null
                            ? null
                            : Math.round((point.pricePerKg - row.averagePricePerKg) * 100) / 100;
                        return (
                          <View key={point.sellingPeriodId} style={styles.detailRow}>
                            <Text style={styles.detailLabel}>
                              {point.label} · {formatAuctionDate(point.auctionDate)}
                            </Text>
                            <Text style={styles.detailValue}>Rs. {formatRs(point.pricePerKg)}</Text>
                            <Text
                              style={[
                                styles.detailGap,
                                {
                                  color:
                                    gap === null || gap === 0
                                      ? Colors.textSecondary
                                      : gap > 0
                                        ? Colors.above
                                        : Colors.below,
                                },
                              ]}>
                              {gap === null ? '' : `${gap > 0 ? '+' : ''}${formatRs(gap)}`}
                            </Text>
                          </View>
                        );
                      })}
                      <Text style={styles.detailFoot}>
                        Latest in period: {row.latestPeriodLabel ?? '—'} at Rs.{' '}
                        {formatRs(row.latestPricePerKg)}
                        {row.latestAgainstAverage.verdict === 'unknown'
                          ? ''
                          : ` — ${formatPercent(
                              row.latestAgainstAverage.differencePercent === null
                                ? null
                                : Math.abs(row.latestAgainstAverage.differencePercent),
                            )} ${
                              row.latestAgainstAverage.verdict === 'below' ? 'below' : 'above'
                            } the period average.`}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {withData.length === 0 && periods.length > 0 && (
            <Text style={styles.emptyNote}>
              These auctions have no per-item prices recorded yet. Enter them on Record Auction
              Results and the averages appear here.
            </Text>
          )}
        </View>

        <Text style={styles.footNote}>
          A grade with no sale in the period shows a dash rather than a zero — no data and no
          rupees are different answers.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/** A calendar-valid YYYY-MM-DD, so 2026-02-31 is rejected rather than shifted. */
function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  scrollContent: { padding: 20, gap: 20, paddingBottom: 48 },

  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 14,
  },
  headingRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  headingIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
  },
  headingText: { flex: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  sectionSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2, lineHeight: 17 },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  pillText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  pillTextActive: { color: Colors.primary },

  dateRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 10 },
  dateField: { flexGrow: 1, flexBasis: 140, minWidth: 130, gap: 4 },
  dateLabel: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.8 },
  dateInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  applyButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  applyButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  resetButton: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  resetButtonText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },

  errorText: { fontSize: 12, color: Colors.below, fontWeight: '600' },
  periodList: { fontSize: 11, color: Colors.textSecondary, lineHeight: 16 },

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
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 8,
  },
  tableRowOpen: { backgroundColor: Colors.primaryLight },
  colItem: { flex: 2.2 },
  colNum: { flex: 1.1, textAlign: 'right' },
  tdBold: { fontSize: 13, fontWeight: '600', color: Colors.text },
  tdText: { fontSize: 13, color: Colors.textSecondary },
  tdMuted: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  average: { fontSize: 14, color: Colors.primary },

  detail: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 6,
  },
  detailHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailLabel: { flex: 1, fontSize: 12, color: Colors.textSecondary },
  detailValue: { fontSize: 12, fontWeight: '700', color: Colors.text, minWidth: 90, textAlign: 'right' },
  detailGap: { fontSize: 12, fontWeight: '600', minWidth: 70, textAlign: 'right' },
  detailFoot: { fontSize: 11, color: Colors.textSecondary, lineHeight: 16, marginTop: 4 },

  emptyNote: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  footNote: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center', lineHeight: 16 },
});
