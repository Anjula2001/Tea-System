import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api';
import { Colors } from '@/constants/colors';
import { useScreenData } from '@/components/data-state';
import Header from '@/components/header';
import { SearchField } from '@/components/picker-card';
import { MoneyIcon, PlusIcon } from '@/components/ui-icons';
import { formatAuctionDate, formatPercent, formatRs } from '@/domain/averaging';
import { auctionBounds, isIsoDate, rangePresets } from '@/domain/date-range';
import type { DateRange } from '@/domain/types';
import {
  periodsInRange,
  selectActiveExternalFactories,
  selectExternalResultsForPeriod,
  selectFactoryPriceBreakdown,
  selectMarketPerPeriod,
  useTeaStore,
} from '@/store/tea-store';

/**
 * The market side of the ledger: what other factories fetched, and the
 * benchmark our own bulk price is measured against.
 *
 * One blended figure per factory per auction, and never more. Other factories
 * publish a single number for a whole bulk set and never report per grade, so
 * there is no per-tea-item column here and there never can be — any UI offering
 * one would be inventing data.
 *
 * The benchmark is a flat mean, Σ(price) ÷ number of factories. Unweighted of
 * necessity rather than by choice: their bulk weights are not published, so
 * there is nothing to weight by.
 *
 * As on Item Prices, the period is LOCAL to this screen — asking what the
 * market did last quarter should not re-base the planning forecast.
 */
export default function MarketScreen() {
  // other factories' figures only — our own prices are not on this screen
  const { ready, gate } = useScreenData(['externalResults', 'factories', 'periods', 'profile']);
  const router = useRouter();
  const state = useTeaStore();
  const { sellingPeriods } = state;
  // Retired factories still appear in the list, to be found and managed; only
  // the active ones are offered a price box or counted in the benchmark.
  const externalFactories = selectActiveExternalFactories(state);
  const recordExternalResults = useTeaStore((s) => s.recordExternalResults);
  const addExternalFactory = useTeaStore((s) => s.addExternalFactory);
  const saving = useTeaStore((s) => s.saving);

  const sorted = useMemo(
    () => [...sellingPeriods].sort((a, b) => a.auctionDate.localeCompare(b.auctionDate)),
    [sellingPeriods],
  );
  const bounds = useMemo(() => auctionBounds(sorted), [sorted]);

  const [range, setRange] = useState<DateRange | null>(null);
  const [fromDraft, setFromDraft] = useState('');
  const [toDraft, setToDraft] = useState('');
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'retired'>('all');

  const applied = range ?? bounds;
  const fromValue = fromDraft || applied.from;
  const toValue = toDraft || applied.to;

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

  const presets = useMemo(() => rangePresets(sorted, { counts: [3, 6] }), [sorted]);

  // ------------------------------------------------------------- recording
  const orderedPeriods = useMemo(() => [...sorted].reverse(), [sorted]);
  const [entryPeriodId, setEntryPeriodId] = useState('');
  const entryPeriod = sellingPeriods.find((p) => p.id === entryPeriodId) ?? null;
  const savedForEntry = selectExternalResultsForPeriod(state, entryPeriodId);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);

  // Chosen when the data lands, not in useState — the cache is empty on the
  // first render, so an initialiser would only ever see no auctions at all.
  React.useEffect(() => {
    if (entryPeriodId === '' && orderedPeriods.length > 0) setEntryPeriodId(orderedPeriods[0]!.id);
  }, [entryPeriodId, orderedPeriods]);

  const draftValue = (id: string) =>
    drafts[id] ?? (savedForEntry.get(id) !== undefined ? String(savedForEntry.get(id)) : '');

  const saveResults = async () => {
    if (!entryPeriod) return;
    const entries = externalFactories
      .map((f) => ({ externalFactoryId: f.id, pricePerKg: parsePrice(draftValue(f.id)) }))
      .filter((e): e is { externalFactoryId: string; pricePerKg: number } => e.pricePerKg !== null)
      .filter((e) => e.pricePerKg !== savedForEntry.get(e.externalFactoryId));

    if (entries.length === 0) {
      setNotice({ text: 'Nothing changed — no new prices recorded.', tone: 'ok' });
      return;
    }

    try {
      await recordExternalResults(entryPeriod.id, entries);
      setDrafts({});
      setNotice({
        text: `Saved ${entries.length} factory price${entries.length === 1 ? '' : 's'} for ${
          entryPeriod.label
        }.`,
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

  // ---------------------------------------------------------- new factory
  const [showAdd, setShowAdd] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newRegion, setNewRegion] = useState('');

  const addFactory = async () => {
    if (newCode.trim() === '' || newName.trim() === '') {
      setNotice({ text: 'A factory needs both a code and a name.', tone: 'error' });
      return;
    }
    try {
      const created = await addExternalFactory({
        code: newCode.trim(),
        name: newName.trim(),
        region: newRegion.trim() === '' ? null : newRegion.trim(),
      });
      setNewCode('');
      setNewName('');
      setNewRegion('');
      setShowAdd(false);
      setNotice({ text: `Added ${created.code} — ${created.name}.`, tone: 'ok' });
    } catch (error) {
      setNotice({
        text:
          error instanceof ApiError
            ? `Not added — ${error.message}`
            : 'Not added — the API could not be reached.',
        tone: 'error',
      });
    }
  };

  const factories = selectFactoryPriceBreakdown(state, applied);

  /**
   * Searching matches code, name and region together, because people reach for
   * whichever they remember — "MP-02", "Mountain" and "Dimbula" should all find
   * the same row. Case- and space-insensitive, so a pasted code still lands.
   *
   * This narrows the list only. The benchmark below is computed from every
   * factory, because a search is a way of finding a row, not of redefining the
   * market.
   */
  const needle = query.trim().toLowerCase();
  const visibleFactories = factories.filter((row) => {
    if (statusFilter === 'active' && !row.active) return false;
    if (statusFilter === 'retired' && row.active) return false;
    if (needle === '') return true;
    return [row.code, row.name, row.region ?? ''].join(' ').toLowerCase().includes(needle);
  });
  const filtering = needle !== '' || statusFilter !== 'all';
  const retiredCount = factories.filter((row) => !row.active).length;
  const perPeriod = selectMarketPerPeriod(state, applied);
  const periods = periodsInRange(state, applied);

  // The benchmark over the whole period: every recorded result, averaged flat.
  const allPrices = factories.flatMap((f) => f.points.map((p) => p.pricePerKg));
  const marketAverageValue =
    allPrices.length === 0
      ? null
      : Math.round((allPrices.reduce((a, b) => a + b, 0) / allPrices.length) * 100) / 100;
  const reporting = factories.filter((f) => f.periodsCounted > 0).length;

  if (!ready) return gate;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        greeting="Market Prices"
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

        {/* The benchmark */}
        <View style={styles.marketCard}>
          <Text style={styles.marketLabel}>MARKET AVERAGE</Text>
          <Text style={styles.marketValue}>
            Rs. {formatRs(marketAverageValue)}
            <Text style={styles.marketUnit}> /kg</Text>
          </Text>
          <Text style={styles.marketMeta}>
            {reporting} other factor{reporting === 1 ? 'y' : 'ies'} reporting ·{' '}
            {allPrices.length} price{allPrices.length === 1 ? '' : 's'} across {periods.length}{' '}
            auction{periods.length === 1 ? '' : 's'}
          </Text>
          <Text style={styles.marketFormula}>
            Σ(price) ÷ number of factories. Unweighted of necessity — their bulk weights are never
            published, so there is nothing to weight by.
          </Text>
        </View>

        {/* Period */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Period</Text>
          <Text style={styles.sectionSubtitle}>
            This period applies to this screen only — nothing else in the app changes.
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

          {rangeError && <Text style={styles.errorText}>{rangeError}</Text>}
        </View>

        {/* Per factory */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.flexOne}>
              <Text style={styles.sectionTitle}>Average price per factory</Text>
              <Text style={styles.sectionSubtitle}>
                One blended figure per factory per auction, read from the published reports. They
                differ because each factory sold a different mix. Tap a factory for its own chart,
                every result behind the average, and its record.
              </Text>
            </View>
            <Pressable style={styles.addToggle} onPress={() => setShowAdd((on) => !on)}>
              <PlusIcon color={Colors.primary} size={14} />
              <Text style={styles.addToggleText}>{showAdd ? 'Cancel' : 'Add factory'}</Text>
            </Pressable>
          </View>

          {showAdd && (
            <View style={styles.addForm}>
              <View style={styles.addField}>
                <Text style={styles.dateLabel}>CODE</Text>
                <TextInput
                  style={styles.dateInput}
                  value={newCode}
                  onChangeText={setNewCode}
                  placeholder="GV-09"
                  placeholderTextColor={Colors.textSecondary}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              </View>
              <View style={[styles.addField, styles.addFieldWide]}>
                <Text style={styles.dateLabel}>NAME</Text>
                <TextInput
                  style={styles.dateInput}
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Green Vale Estates"
                  placeholderTextColor={Colors.textSecondary}
                />
              </View>
              <View style={styles.addField}>
                <Text style={styles.dateLabel}>REGION</Text>
                <TextInput
                  style={styles.dateInput}
                  value={newRegion}
                  onChangeText={setNewRegion}
                  placeholder="Kandy"
                  placeholderTextColor={Colors.textSecondary}
                />
              </View>
              <Pressable
                style={[styles.applyButton, saving && styles.busy]}
                disabled={saving}
                onPress={addFactory}>
                <Text style={styles.applyButtonText}>{saving ? 'Saving…' : 'Add'}</Text>
              </Pressable>
            </View>
          )}

          {/* Finding a factory */}
          <View style={styles.searchRow}>
            <SearchField value={query} onChangeText={setQuery} placeholder="Search code, name or region…" />

            <View style={styles.filterRow}>
              {(['all', 'active', 'retired'] as const).map((option) => {
                const on = statusFilter === option;
                return (
                  <Pressable
                    key={option}
                    style={[styles.filterPill, on && styles.filterPillActive]}
                    onPress={() => setStatusFilter(option)}>
                    <Text style={[styles.filterPillText, on && styles.filterPillTextActive]}>
                      {option === 'all' ? 'All' : option === 'active' ? 'Active' : 'Retired'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Text style={styles.resultCount}>
            {filtering
              ? `${visibleFactories.length} of ${factories.length} factor${
                  factories.length === 1 ? 'y' : 'ies'
                }`
              : `${factories.length} factor${factories.length === 1 ? 'y' : 'ies'}`}
            {retiredCount > 0
              ? ` · ${retiredCount} retired, left out of the benchmark above`
              : ''}
          </Text>

          {visibleFactories.length > 0 ? (
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, styles.colItem]}>Factory</Text>
                <Text style={[styles.th, styles.colNum]}>Auctions</Text>
                <Text style={[styles.th, styles.colNum]}>Low</Text>
                <Text style={[styles.th, styles.colNum]}>High</Text>
                <Text style={[styles.th, styles.colNum]}>Average</Text>
              </View>

              {visibleFactories.map((row) => (
                <Pressable
                  key={row.externalFactoryId}
                  style={styles.tableRow}
                  onPress={() =>
                    router.push({
                      pathname: '/factory',
                      params: { id: row.externalFactoryId },
                    })
                  }>
                  <View style={styles.colItem}>
                    <View style={styles.codeRow}>
                      <Text style={styles.tdBold}>{row.code}</Text>
                      {!row.active && <Text style={styles.retiredTag}>retired</Text>}
                    </View>
                    <Text style={styles.tdMuted}>
                      {row.name}
                      {row.region ? ` · ${row.region}` : ''}
                    </Text>
                  </View>
                  <Text style={[styles.tdText, styles.colNum]}>
                    {row.periodsCounted > 0 ? row.periodsCounted : '—'}
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
              ))}
            </View>
          ) : (
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyNote}>
                {needle === ''
                  ? `No ${statusFilter} factories.`
                  : `Nothing matches “${query.trim()}”.`}
              </Text>
              {needle !== '' && (
                <Pressable
                  style={styles.addToggle}
                  onPress={() => {
                    setNewCode(query.trim().toUpperCase());
                    setNewName('');
                    setNewRegion('');
                    setShowAdd(true);
                  }}>
                  <PlusIcon color={Colors.primary} size={14} />
                  <Text style={styles.addToggleText}>
                    Add “{query.trim()}” as a new factory
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        {/* The benchmark, auction by auction */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Market average by auction</Text>
          <Text style={styles.sectionSubtitle}>
            The sum over the count, one auction at a time — the benchmark at its most literal.
          </Text>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, styles.colItem]}>Auction</Text>
              <Text style={[styles.th, styles.colItem]}>Factories reporting</Text>
              <Text style={[styles.th, styles.colNum]}>Average</Text>
            </View>
            {perPeriod.map((period) => (
              <View key={period.sellingPeriodId} style={styles.tableRow}>
                <View style={styles.colItem}>
                  <Text style={styles.tdBold}>{period.label}</Text>
                  <Text style={styles.tdMuted}>{formatAuctionDate(period.auctionDate)}</Text>
                </View>
                <Text style={[styles.tdText, styles.colItem]}>
                  {period.factoriesCounted === 0
                    ? 'none reported'
                    : period.prices
                        .map((p) => `${p.code} ${formatRs(p.pricePerKg, 0)}`)
                        .join(' · ')}
                </Text>
                <Text style={[styles.tdBold, styles.colNum, styles.average]}>
                  {formatRs(period.averagePricePerKg)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Recording */}
        <View style={styles.card}>
          <View style={styles.headingRow}>
            <View style={styles.headingIcon}>
              <MoneyIcon color="#B8860B" size={18} />
            </View>
            <View style={styles.headingText}>
              <Text style={styles.sectionTitle}>Record factory prices</Text>
              <Text style={styles.sectionSubtitle}>
                One blended figure per factory, as published. There is deliberately no per-tea-item
                field: other factories do not report per grade, so any such box would be inviting
                you to invent a number.
              </Text>
            </View>
          </View>

          <View style={styles.pillRow}>
            {orderedPeriods.map((p) => {
              const active = p.id === entryPeriodId;
              return (
                <Pressable
                  key={p.id}
                  style={[styles.pill, active && styles.pillActive]}
                  onPress={() => {
                    setEntryPeriodId(p.id);
                    setDrafts({});
                    setNotice(null);
                  }}>
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>{p.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.inputGrid}>
            {externalFactories.map((factory) => (
              <View key={factory.id} style={styles.inputCell}>
                <View style={styles.inputLabelRow}>
                  <Text style={styles.inputCode}>{factory.code}</Text>
                  {savedForEntry.has(factory.id) && (
                    <Text style={styles.savedTag}>on record</Text>
                  )}
                </View>
                <Text style={styles.inputName}>
                  {factory.name}
                  {factory.region ? ` · ${factory.region}` : ''}
                </Text>
                <View style={styles.inputWrap}>
                  <Text style={styles.inputPrefix}>Rs.</Text>
                  <TextInput
                    style={styles.input}
                    value={draftValue(factory.id)}
                    onChangeText={(text) =>
                      setDrafts((prev) => ({ ...prev, [factory.id]: text }))
                    }
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={Colors.textSecondary}
                  />
                  <Text style={styles.inputSuffix}>/kg</Text>
                </View>
              </View>
            ))}
          </View>

          <Pressable
            style={[styles.saveButton, saving && styles.busy]}
            disabled={saving}
            onPress={saveResults}>
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving…' : `Save prices for ${entryPeriod?.label ?? 'this auction'}`}
            </Text>
          </Pressable>
          <Text style={styles.footNote}>
            Saving appends to the record. Re-entering a price keeps the original on file and treats
            the new one as a correction.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Accepts only a sane positive number; anything else is "not entered". */
function parsePrice(raw: string): number | null {
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
  flexOne: { flex: 1 },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },

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

  marketCard: {
    backgroundColor: Colors.accentLight,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F0D48A',
    gap: 3,
  },
  marketLabel: { fontSize: 10, fontWeight: '700', color: '#8A6D1F', letterSpacing: 0.8 },
  marketValue: { fontSize: 30, fontWeight: '700', color: '#B8860B' },
  marketUnit: { fontSize: 15, fontWeight: '600', color: '#8A6D1F' },
  marketMeta: { fontSize: 12, color: '#8A6D1F' },
  marketFormula: { fontSize: 11, color: '#8A6D1F', lineHeight: 16, marginTop: 6 },

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
    backgroundColor: '#FFF8E1',
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
  busy: { opacity: 0.6 },

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
  tdText: { fontSize: 12, color: Colors.textSecondary },
  tdMuted: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  average: { fontSize: 14, color: '#B8860B' },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  retiredTag: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8A6D1F',
    backgroundColor: Colors.accentLight,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  chevron: { fontSize: 20, color: Colors.textSecondary, marginLeft: 2, width: 12, textAlign: 'right' },

  searchRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
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
  emptyBlock: { alignItems: 'flex-start', gap: 10, paddingVertical: 14 },
  emptyNote: { fontSize: 13, color: Colors.textSecondary },

  inputGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  inputCell: { flexGrow: 1, flexBasis: 210, minWidth: 190, maxWidth: 300, gap: 4 },
  inputLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputCode: { fontSize: 13, fontWeight: '700', color: Colors.text },
  savedTag: { fontSize: 10, fontWeight: '600', color: Colors.primary },
  inputName: { fontSize: 11, color: Colors.textSecondary },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    gap: 6,
    marginTop: 2,
  },
  inputPrefix: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600', flexShrink: 0 },
  inputSuffix: { fontSize: 12, color: Colors.textSecondary, flexShrink: 0 },
  input: { flex: 1, minWidth: 0, paddingVertical: 10, fontSize: 15, fontWeight: '600', color: Colors.text },

  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  footNote: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center', lineHeight: 16 },
});
