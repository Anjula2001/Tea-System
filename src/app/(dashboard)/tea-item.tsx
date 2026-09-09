import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api';
import { Colors } from '@/constants/colors';
import { useLoadedStore } from '@/components/data-state';
import Header from '@/components/header';
import PriceChart from '@/components/price-chart';
import { formatAuctionDate, formatPercent, formatRs } from '@/domain/averaging';
import type { DateRange } from '@/domain/types';
import { periodsInRange, selectItemPriceBreakdown, useTeaStore } from '@/store/tea-store';

/**
 * One grade, in full: how its price has moved, and everything you can change
 * about it.
 *
 * Split out from the list on purpose. The list answers "what is each grade
 * worth?", which wants every grade on screen at once; this answers "what is
 * happening to THIS grade, and is its record right?", which wants room for a
 * chart and an edit form. Cramming both into an expanding row made each of them
 * worse.
 *
 * The period is local to this screen, as on the list — asking what BOP did last
 * quarter must not re-base the planning forecast.
 */
export default function TeaItemScreen() {
  const { ready, gate } = useLoadedStore();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const state = useTeaStore();
  const { sellingPeriods } = state;
  const updateTeaItem = useTeaStore((s) => s.updateTeaItem);
  const removeTeaItem = useTeaStore((s) => s.removeTeaItem);
  const setTeaItemActive = useTeaStore((s) => s.setTeaItemActive);
  const saving = useTeaStore((s) => s.saving);

  const item = state.teaItems.find((t) => t.id === id) ?? null;

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

  const [range, setRange] = useState<DateRange | null>(null);
  const [fromDraft, setFromDraft] = useState('');
  const [toDraft, setToDraft] = useState('');
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [edit, setEdit] = useState({ code: '', name: '', category: '' });

  const applied = range ?? bounds;
  const fromValue = fromDraft || applied.from;
  const toValue = toDraft || applied.to;

  // Seeded when the grade arrives, not in useState — the cache fills after the
  // first render, so an initialiser would only ever see an empty catalogue.
  useEffect(() => {
    if (!item) return;
    setEdit({ code: item.code, name: item.name, category: item.category ?? '' });
  }, [item?.id, item?.code, item?.name, item?.category]);

  const apply = (next: DateRange) => {
    setRange(next);
    setFromDraft(next.from);
    setToDraft(next.to);
    setRangeError(null);
  };

  const applyTyped = () => {
    if (!isIsoDate(fromValue) || !isIsoDate(toValue)) {
      setRangeError('Dates must be written as YYYY-MM-DD, for example 2026-06-03.');
      return;
    }
    if (fromValue > toValue) {
      setRangeError('The start date must not be after the end date.');
      return;
    }
    apply({ from: fromValue, to: toValue });
  };

  const presets = useMemo(() => {
    const dates = sorted.map((p) => p.auctionDate);
    const lastN = (count: number) => {
      const slice = dates.slice(-count);
      return slice.length > 0 ? { from: slice[0]!, to: dates.at(-1)! } : null;
    };
    return [
      { label: 'All auctions', value: bounds },
      { label: 'Last 3', value: lastN(3) },
      { label: 'Last 6', value: lastN(6) },
      { label: 'Last 12', value: lastN(12) },
    ].filter((p): p is { label: string; value: DateRange } => p.value !== null);
  }, [sorted, bounds]);

  const row = selectItemPriceBreakdown(state, applied).find((r) => r.teaItemId === id) ?? null;
  const periods = periodsInRange(state, applied);

  const report = (error: unknown, verb: string) =>
    setNotice({
      text:
        error instanceof ApiError
          ? `${verb} — ${error.message}`
          : `${verb} — the API could not be reached.`,
      tone: 'error',
    });

  const saveEdit = async () => {
    if (!item) return;
    if (edit.code.trim() === '' || edit.name.trim() === '') {
      setNotice({ text: 'A grade needs both a code and a name.', tone: 'error' });
      return;
    }
    try {
      const saved = await updateTeaItem(item.id, {
        code: edit.code.trim(),
        name: edit.name.trim(),
        category: edit.category.trim() === '' ? null : edit.category.trim(),
      });
      setNotice({ text: `Saved ${saved.code} — ${saved.name}.`, tone: 'ok' });
    } catch (error) {
      report(error, 'Not saved');
    }
  };

  const toggleActive = async () => {
    if (!item) return;
    try {
      await setTeaItemActive(item.id, !item.active);
      setNotice({
        text: item.active
          ? `${item.code} retired. Its history stays on file; it just will not be offered for new prices or bulk sets.`
          : `${item.code} is active again and will appear on the entry screens.`,
        tone: 'ok',
      });
    } catch (error) {
      report(error, 'Not changed');
    }
  };

  const deleteGrade = async () => {
    if (!item) return;
    try {
      await removeTeaItem(item.id);
      router.replace('/item-averages');
    } catch (error) {
      setConfirmDelete(false);
      report(error, 'Not deleted');
    }
  };

  if (!ready) return gate;

  if (!item) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.missing}>
          <Text style={styles.missingTitle}>That grade is no longer on file.</Text>
          <Pressable style={styles.applyButton} onPress={() => router.replace('/item-averages')}>
            <Text style={styles.applyButtonText}>Back to Item Prices</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        greeting={item.code}
        subTitle={`${item.name}${item.category ? ` · ${item.category}` : ''}`}
        notificationCount={0}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        <Pressable style={styles.backLink} onPress={() => router.push('/item-averages')}>
          <Text style={styles.backLinkText}>← All tea items</Text>
        </Pressable>

        {notice && (
          <View style={[styles.notice, notice.tone === 'error' && styles.noticeError]}>
            <Text style={[styles.noticeText, notice.tone === 'error' && styles.noticeErrorText]}>
              {notice.text}
            </Text>
          </View>
        )}

        {!item.active && (
          <View style={styles.retiredBanner}>
            <Text style={styles.retiredBannerText}>
              {item.code} is retired. Its past sales still count toward history and averages, but
              it is not offered for new prices or bulk sets.
            </Text>
          </View>
        )}

        {/* Period */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Period</Text>
          <Text style={styles.sectionSubtitle}>
            Which auctions the chart and the figures below are drawn from. This applies to this
            screen only.
          </Text>

          <View style={styles.pillRow}>
            {presets.map((preset) => {
              const active = applied.from === preset.value.from && applied.to === preset.value.to;
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
              <Text style={styles.fieldLabel}>FROM</Text>
              <TextInput
                style={styles.textInput}
                value={fromValue}
                onChangeText={setFromDraft}
                placeholder="2026-06-03"
                placeholderTextColor={Colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={styles.dateField}>
              <Text style={styles.fieldLabel}>TO</Text>
              <TextInput
                style={styles.textInput}
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
            <Pressable style={styles.outlineButton} onPress={() => apply(bounds)}>
              <Text style={styles.outlineButtonText}>Reset</Text>
            </Pressable>
          </View>

          {rangeError && <Text style={styles.errorText}>{rangeError}</Text>}
        </View>

        {/* How the price moved */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>How {item.code} has moved</Text>
          <Text style={styles.sectionSubtitle}>
            {row && row.periodsCounted > 0
              ? `${row.periodsCounted} auction${
                  row.periodsCounted === 1 ? '' : 's'
                } between ${formatAuctionDate(applied.from)} and ${formatAuctionDate(
                  applied.to,
                )}. The axis is fitted to the range Rs. ${formatRs(
                  row.lowestPricePerKg,
                  0,
                )}–${formatRs(row.highestPricePerKg, 0)}, not anchored at zero.`
              : `No sale recorded between ${formatAuctionDate(applied.from)} and ${formatAuctionDate(
                  applied.to,
                )}.`}
          </Text>

          <PriceChart
            points={row?.points ?? []}
            averagePricePerKg={row?.averagePricePerKg ?? null}
          />

          <View style={styles.statRow}>
            <Stat label="AVERAGE" value={formatRs(row?.averagePricePerKg ?? null)} tone="primary" />
            <Stat label="LOWEST" value={formatRs(row?.lowestPricePerKg ?? null)} />
            <Stat label="HIGHEST" value={formatRs(row?.highestPricePerKg ?? null)} />
            <Stat
              label="LATEST"
              value={formatRs(row?.latestPricePerKg ?? null)}
              meta={row?.latestPeriodLabel ?? undefined}
              tone={
                row?.latestAgainstAverage.verdict === 'above'
                  ? 'above'
                  : row?.latestAgainstAverage.verdict === 'below'
                    ? 'below'
                    : undefined
              }
            />
          </View>

          {row && row.latestAgainstAverage.verdict !== 'unknown' && (
            <Text style={styles.trendNote}>
              The latest sale, {row.latestPeriodLabel}, came in{' '}
              {formatPercent(
                row.latestAgainstAverage.differencePercent === null
                  ? null
                  : Math.abs(row.latestAgainstAverage.differencePercent),
              )}{' '}
              {row.latestAgainstAverage.verdict === 'below' ? 'below' : 'above'} the period average
              of Rs. {formatRs(row.averagePricePerKg)}.
            </Text>
          )}
        </View>

        {/* The figures behind the chart */}
        {row && row.points.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Every sale in this period</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, styles.colItem]}>Auction</Text>
                <Text style={[styles.th, styles.colNum]}>Price /kg</Text>
                <Text style={[styles.th, styles.colNum]}>vs average</Text>
              </View>
              {row.points.map((point) => {
                const gap =
                  row.averagePricePerKg === null
                    ? null
                    : Math.round((point.pricePerKg - row.averagePricePerKg) * 100) / 100;
                return (
                  <View key={point.sellingPeriodId} style={styles.tableRow}>
                    <View style={styles.colItem}>
                      <Text style={styles.tdBold}>{point.label}</Text>
                      <Text style={styles.tdMuted}>{formatAuctionDate(point.auctionDate)}</Text>
                    </View>
                    <Text style={[styles.tdBold, styles.colNum]}>
                      {formatRs(point.pricePerKg)}
                    </Text>
                    <Text
                      style={[
                        styles.tdBold,
                        styles.colNum,
                        {
                          color:
                            gap === null || gap === 0
                              ? Colors.textSecondary
                              : gap > 0
                                ? Colors.above
                                : Colors.below,
                        },
                      ]}>
                      {gap === null ? '—' : `${gap > 0 ? '+' : ''}${formatRs(gap)}`}
                    </Text>
                  </View>
                );
              })}
            </View>
            <Text style={styles.footNote}>
              {periods.length} auction{periods.length === 1 ? '' : 's'} fall in this period;{' '}
              {row.periodsCounted} recorded a price for {item.code}.
            </Text>
          </View>
        )}

        {/* Editing the grade */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Edit grade</Text>
          <Text style={styles.sectionSubtitle}>
            Renaming relabels every past sale of this grade, because they point at it rather than
            at its code. Right for a typo; to split one grade in two, add a new grade instead.
          </Text>

          <View style={styles.editForm}>
            <View style={styles.editField}>
              <Text style={styles.fieldLabel}>CODE</Text>
              <TextInput
                style={styles.textInput}
                value={edit.code}
                onChangeText={(code) => setEdit((e) => ({ ...e, code }))}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>
            <View style={[styles.editField, styles.editFieldWide]}>
              <Text style={styles.fieldLabel}>NAME</Text>
              <TextInput
                style={styles.textInput}
                value={edit.name}
                onChangeText={(name) => setEdit((e) => ({ ...e, name }))}
              />
            </View>
            <View style={styles.editField}>
              <Text style={styles.fieldLabel}>CATEGORY</Text>
              <TextInput
                style={styles.textInput}
                value={edit.category}
                onChangeText={(category) => setEdit((e) => ({ ...e, category }))}
                placeholder="none"
                placeholderTextColor={Colors.textSecondary}
              />
            </View>
          </View>

          <View style={styles.actionRow}>
            <Pressable
              style={[styles.applyButton, saving && styles.busy]}
              disabled={saving}
              onPress={saveEdit}>
              <Text style={styles.applyButtonText}>{saving ? 'Saving…' : 'Save changes'}</Text>
            </Pressable>

            <Pressable style={styles.outlineButton} disabled={saving} onPress={toggleActive}>
              <Text style={styles.outlineButtonText}>
                {item.active ? 'Retire' : 'Reinstate'}
              </Text>
            </Pressable>

            {confirmDelete ? (
              <>
                <Pressable
                  style={[styles.dangerButton, saving && styles.busy]}
                  disabled={saving}
                  onPress={deleteGrade}>
                  <Text style={styles.dangerButtonText}>
                    {saving ? 'Deleting…' : 'Yes, delete'}
                  </Text>
                </Pressable>
                <Pressable style={styles.outlineButton} onPress={() => setConfirmDelete(false)}>
                  <Text style={styles.outlineButtonText}>Keep</Text>
                </Pressable>
              </>
            ) : (
              <Pressable style={styles.dangerOutline} onPress={() => setConfirmDelete(true)}>
                <Text style={styles.dangerOutlineText}>Delete</Text>
              </Pressable>
            )}
          </View>

          <Text style={styles.footNote}>
            Deleting only works while nothing depends on this grade. Once it has been priced or put
            in a bulk set it is part of the record, and the API will say so — retire it instead.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({
  label,
  value,
  meta,
  tone,
}: {
  label: string;
  value: string;
  meta?: string;
  tone?: 'primary' | 'above' | 'below';
}) {
  const color =
    tone === 'primary'
      ? Colors.primary
      : tone === 'above'
        ? Colors.above
        : tone === 'below'
          ? Colors.below
          : Colors.text;

  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>Rs. {value}</Text>
      {meta && <Text style={styles.statMeta}>{meta}</Text>}
    </View>
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
  busy: { opacity: 0.6 },

  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  missingTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },

  backLink: { alignSelf: 'flex-start' },
  backLinkText: { fontSize: 13, fontWeight: '600', color: Colors.primary },

  notice: {
    backgroundColor: Colors.aboveLight,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.above,
  },
  noticeText: { fontSize: 13, color: Colors.above, fontWeight: '600', lineHeight: 18 },
  noticeError: { backgroundColor: Colors.belowLight, borderColor: Colors.below },
  noticeErrorText: { color: Colors.below },

  retiredBanner: {
    backgroundColor: Colors.accentLight,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F0D48A',
  },
  retiredBannerText: { fontSize: 12, color: '#8A6D1F', lineHeight: 18 },

  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 14,
  },
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
  fieldLabel: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.8 },
  textInput: {
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
  outlineButton: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  outlineButtonText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  errorText: { fontSize: 12, color: Colors.below, fontWeight: '600' },

  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  stat: { flexGrow: 1, flexBasis: 130, minWidth: 110, gap: 2 },
  statLabel: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.6 },
  statValue: { fontSize: 20, fontWeight: '700' },
  statMeta: { fontSize: 11, color: Colors.textSecondary },
  trendNote: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },

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
  colItem: { flex: 2.2 },
  colNum: { flex: 1.2, textAlign: 'right' },
  tdBold: { fontSize: 13, fontWeight: '600', color: Colors.text },
  tdMuted: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },

  editForm: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 10 },
  editField: { flexGrow: 1, flexBasis: 130, minWidth: 120, gap: 4 },
  editFieldWide: { flexBasis: 220 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  dangerButton: {
    backgroundColor: Colors.below,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  dangerButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  dangerOutline: {
    borderWidth: 1,
    borderColor: Colors.below,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dangerOutlineText: { color: Colors.below, fontSize: 14, fontWeight: '600' },

  footNote: { fontSize: 11, color: Colors.textSecondary, lineHeight: 16 },
});
