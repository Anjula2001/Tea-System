import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api';
import { Colors } from '@/constants/colors';
import { useLoadedStore } from '@/components/data-state';
import Header from '@/components/header';
import { LeafIcon, PlusIcon } from '@/components/ui-icons';
import { formatAuctionDate, formatPercent, formatRs } from '@/domain/averaging';
import { auctionBounds, isIsoDate, rangePresets } from '@/domain/date-range';
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
  const router = useRouter();
  const state = useTeaStore();
  const { sellingPeriods } = state;
  const addTeaItem = useTeaStore((s) => s.addTeaItem);
  const saving = useTeaStore((s) => s.saving);

  const sorted = useMemo(
    () => [...sellingPeriods].sort((a, b) => a.auctionDate.localeCompare(b.auctionDate)),
    [sellingPeriods],
  );
  const bounds = useMemo(() => auctionBounds(sorted), [sorted]);

  // The applied range, and the two fields being edited toward it. Keeping them
  // apart means a half-typed date never blanks the table underneath.
  const [range, setRange] = useState<DateRange | null>(null);
  const [fromDraft, setFromDraft] = useState('');
  const [toDraft, setToDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const applied = range ?? bounds;
  const fromValue = fromDraft || applied.from;
  const toValue = toDraft || applied.to;

  const apply = (next: DateRange) => {
    setRange(next);
    setFromDraft(next.from);
    setToDraft(next.to);
    setError(null);
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
    // "This year" is not a "last N", so it rides along as an extra — and goes
    // through the same de-duplication, which matters in a year whose auctions
    // are the only ones on file.
    const year = sorted.at(-1)?.auctionDate.slice(0, 4);
    return rangePresets(sorted, {
      counts: [3, 6],
      extra: [
        year ? { label: 'This year', value: { from: `${year}-01-01`, to: `${year}-12-31` } } : null,
      ],
    });
  }, [sorted]);

  // ------------------------------------------------------------------ CRUD
  const [notice, setNotice] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'retired'>('all');
  const [draft, setDraft] = useState({ code: '', name: '', category: '' });

  const report = (error: unknown, verb: string) =>
    setNotice({
      text:
        error instanceof ApiError
          ? `${verb} — ${error.message}`
          : `${verb} — the API could not be reached.`,
      tone: 'error',
    });


  const addGrade = async () => {
    if (draft.code.trim() === '' || draft.name.trim() === '') {
      setNotice({ text: 'A grade needs both a code and a name.', tone: 'error' });
      return;
    }
    try {
      const created = await addTeaItem({
        code: draft.code.trim(),
        name: draft.name.trim(),
        category: draft.category.trim() === '' ? null : draft.category.trim(),
      });
      setDraft({ code: '', name: '', category: '' });
      setShowAdd(false);
      setNotice({ text: `Added ${created.code} — ${created.name}.`, tone: 'ok' });
    } catch (error) {
      report(error, 'Not added');
    }
  };




  const breakdown = selectItemPriceBreakdown(state, applied);
  const periods = periodsInRange(state, applied);

  /*
   * Searching matches code, name and category together, because people reach
   * for whichever they remember — "BOPF", "fannings" and "Broken" should all
   * find the same row. Matching is case- and space-insensitive so a pasted code
   * with a stray space still lands.
   */
  const needle = query.trim().toLowerCase();
  const visible = breakdown.filter((row) => {
    if (statusFilter === 'active' && !row.active) return false;
    if (statusFilter === 'retired' && row.active) return false;
    if (needle === '') return true;
    return [row.teaItemCode, row.teaItemName, row.category ?? '']
      .join(' ')
      .toLowerCase()
      .includes(needle);
  });

  const withData = visible.filter((row) => row.periodsCounted > 0);
  const filtering = needle !== '' || statusFilter !== 'all';

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

        {notice && (
          <View style={[styles.notice, notice.tone === 'error' && styles.noticeError]}>
            <Text style={[styles.noticeText, notice.tone === 'error' && styles.noticeErrorText]}>
              {notice.text}
            </Text>
          </View>
        )}

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
          <View style={styles.rowBetween}>
            <View style={styles.flexOne}>
              <Text style={styles.sectionTitle}>Average price per kg</Text>
              <Text style={styles.sectionSubtitle}>
                The mean of every auction in the period — one price per auction, corrections
                resolved. The same average the planning screen values a bulk set at. Tap a grade
                for the sales behind it, and to edit or retire it.
              </Text>
            </View>
            <Pressable style={styles.addToggle} onPress={() => setShowAdd((on) => !on)}>
              <PlusIcon color={Colors.primary} size={14} />
              <Text style={styles.addToggleText}>{showAdd ? 'Cancel' : 'Add grade'}</Text>
            </Pressable>
          </View>

          {showAdd && (
            <View style={styles.addForm}>
              <View style={styles.addField}>
                <Text style={styles.dateLabel}>CODE</Text>
                <TextInput
                  style={styles.dateInput}
                  value={draft.code}
                  onChangeText={(code) => setDraft((d) => ({ ...d, code }))}
                  placeholder="FBOP"
                  placeholderTextColor={Colors.textSecondary}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              </View>
              <View style={[styles.addField, styles.addFieldWide]}>
                <Text style={styles.dateLabel}>NAME</Text>
                <TextInput
                  style={styles.dateInput}
                  value={draft.name}
                  onChangeText={(name) => setDraft((d) => ({ ...d, name }))}
                  placeholder="Flowery Broken Orange Pekoe"
                  placeholderTextColor={Colors.textSecondary}
                />
              </View>
              <View style={styles.addField}>
                <Text style={styles.dateLabel}>CATEGORY</Text>
                <TextInput
                  style={styles.dateInput}
                  value={draft.category}
                  onChangeText={(category) => setDraft((d) => ({ ...d, category }))}
                  placeholder="Flowery Leaf"
                  placeholderTextColor={Colors.textSecondary}
                />
              </View>
              <Pressable
                style={[styles.applyButton, saving && styles.busy]}
                disabled={saving}
                onPress={addGrade}>
                <Text style={styles.applyButtonText}>{saving ? 'Saving…' : 'Add'}</Text>
              </Pressable>
            </View>
          )}

          {/* Finding a grade */}
          <View style={styles.searchRow}>
            <View style={styles.searchField}>
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Search code, name or category…"
                placeholderTextColor={Colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {query !== '' && (
                <Pressable style={styles.clearButton} onPress={() => setQuery('')}>
                  <Text style={styles.clearButtonText}>Clear</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.filterRow}>
              {(['all', 'active', 'retired'] as const).map((option) => {
                const active = statusFilter === option;
                return (
                  <Pressable
                    key={option}
                    style={[styles.filterPill, active && styles.filterPillActive]}
                    onPress={() => setStatusFilter(option)}>
                    <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                      {option === 'all' ? 'All' : option === 'active' ? 'Active' : 'Retired'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Text style={styles.resultCount}>
            {filtering
              ? `${visible.length} of ${breakdown.length} grade${
                  breakdown.length === 1 ? '' : 's'
                }`
              : `${breakdown.length} grade${breakdown.length === 1 ? '' : 's'}`}
          </Text>

          {visible.length > 0 && (
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, styles.colItem]}>Tea Item</Text>
                <Text style={[styles.th, styles.colNum]}>Auctions</Text>
                <Text style={[styles.th, styles.colNum]}>Low</Text>
                <Text style={[styles.th, styles.colNum]}>High</Text>
                <Text style={[styles.th, styles.colNum]}>Average</Text>
              </View>

              {visible.map((row) => {
                const hasData = row.periodsCounted > 0;

                return (
                  <View key={row.teaItemId}>
                    <Pressable
                      style={styles.tableRow}
                      onPress={() =>
                        router.push({ pathname: '/tea-item', params: { id: row.teaItemId } })
                      }>
                      <View style={styles.colItem}>
                        <View style={styles.codeRow}>
                          <Text style={styles.tdBold}>{row.teaItemCode}</Text>
                          {!row.active && <Text style={styles.retiredTag}>retired</Text>}
                        </View>
                        <Text style={styles.tdMuted}>
                          {row.teaItemName}
                          {row.category ? ` · ${row.category}` : ''}
                        </Text>
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
                      <Text style={styles.chevron}>›</Text>
                    </Pressable>

                </View>
              );
            })}
          </View>
          )}

          {visible.length === 0 && (
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyNote}>
                {needle === ''
                  ? `No ${statusFilter} grades.`
                  : `Nothing matches “${query.trim()}”.`}
              </Text>
              {needle !== '' && (
                <Pressable
                  style={styles.addToggle}
                  onPress={() => {
                    setDraft({ code: query.trim().toUpperCase(), name: '', category: '' });
                    setShowAdd(true);
                    setQuery('');
                  }}>
                  <PlusIcon color={Colors.primary} size={14} />
                  <Text style={styles.addToggleText}>
                    Add “{query.trim().toUpperCase()}” as a new grade
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          {visible.length > 0 && withData.length === 0 && periods.length > 0 && (
            <Text style={styles.emptyNote}>
              {filtering ? 'These grades have' : 'These auctions have'} no per-item prices recorded
              in this period. Enter them on Record Auction Results and the averages appear here.
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

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  scrollContent: { padding: 20, gap: 20, paddingBottom: 48 },
  flexOne: { flex: 1 },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  busy: { opacity: 0.6 },

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

  addToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.primary,
  },
  addToggleText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  addForm: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: 10,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 14,
  },
  addField: { flexGrow: 1, flexBasis: 130, minWidth: 120, gap: 4 },
  addFieldWide: { flexBasis: 200 },

  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  retiredTag: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8A6D1F',
    backgroundColor: Colors.accentLight,
    borderWidth: 1,
    borderColor: '#F0D48A',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden',
  },


  searchRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  searchField: {
    flexGrow: 1,
    flexBasis: 220,
    minWidth: 180,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
  },
  clearButton: { paddingHorizontal: 6, paddingVertical: 4 },
  clearButtonText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  filterRow: { flexDirection: 'row', gap: 6 },
  filterPill: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.background,
  },
  filterPillActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  filterPillText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  filterPillTextActive: { color: Colors.primary },
  resultCount: { fontSize: 11, color: Colors.textSecondary, marginTop: -6 },
  emptyBlock: { alignItems: 'flex-start', gap: 10 },

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
  colItem: { flex: 2.2 },
  colNum: { flex: 1.1, textAlign: 'right' },
  tdBold: { fontSize: 13, fontWeight: '600', color: Colors.text },
  tdText: { fontSize: 13, color: Colors.textSecondary },
  tdMuted: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  average: { fontSize: 14, color: Colors.primary },


  chevron: { fontSize: 20, color: Colors.textSecondary, marginLeft: 2, width: 12, textAlign: 'right' },
  emptyNote: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  footNote: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center', lineHeight: 16 },
});
