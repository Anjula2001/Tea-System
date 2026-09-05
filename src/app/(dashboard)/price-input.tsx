import React, { useMemo, useState } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/colors';
import Header from '@/components/header';
import VerdictBadge from '@/components/verdict-badge';
import { LeafIcon, MoneyIcon, ChartIcon } from '@/components/ui-icons';
import {
  compare,
  formatAuctionDate,
  formatKg,
  formatPercent,
  formatRs,
  formatSignedRs,
  marketAverage,
} from '@/domain/averaging';
import type { Comparison } from '@/domain/types';
import {
  selectBulkSetForPeriod,
  selectExternalResultsForPeriod,
  selectOurBulkForPeriod,
  selectOurItemHistoryBeforePeriod,
  selectOurPricesForPeriod,
  useTeaStore,
  valueBulkSetAtPrices,
} from '@/store/tea-store';

/**
 * Recording one auction's results.
 *
 * Three things get entered, and the screen is split to match, because they are
 * genuinely different kinds of fact:
 *
 *   1. Our price per kg for each tea item      — the detail only we have
 *   2. Our blended price for the whole bulk    — one number, ours
 *   3. Each other factory's blended bulk price — one number each, theirs
 *
 * Only (1) and (3) are typed. (2) falls out of (1): the bulk set attached to
 * this auction already carries the kilos of each item, so the blended figure is
 * Σ(kg × price) ÷ Σ(kg) — the same weighting the bulk set screen forecasts
 * with, which is what makes forecast and result comparable. It stays
 * overridable, because the broker's own blended figure is the figure of record
 * and rounding or unsold lots can move it.
 *
 * Other factories have no per-item fields, and never will: they don't report
 * per grade. Re-saving a value records a correction rather than an error.
 */
export default function AuctionResultsScreen() {
  const state = useTeaStore();
  const { teaItems, externalFactories, sellingPeriods } = state;
  const recordOurPrices = useTeaStore((s) => s.recordOurPrices);
  const recordOurBulkResult = useTeaStore((s) => s.recordOurBulkResult);
  const recordExternalResults = useTeaStore((s) => s.recordExternalResults);
  const markPeriodSold = useTeaStore((s) => s.markPeriodSold);

  const orderedPeriods = useMemo(
    () => [...sellingPeriods].sort((a, b) => b.auctionDate.localeCompare(a.auctionDate)),
    [sellingPeriods],
  );

  const [periodId, setPeriodId] = useState(orderedPeriods[0]?.id ?? '');
  const period = sellingPeriods.find((p) => p.id === periodId) ?? null;

  // Saved values for this auction seed the inputs, so the form opens showing
  // what is already on record rather than blank boxes.
  const savedItemPrices = selectOurPricesForPeriod(state, periodId);
  const savedBulk = selectOurBulkForPeriod(state, periodId);
  const savedExternal = selectExternalResultsForPeriod(state, periodId);

  const [itemDrafts, setItemDrafts] = useState<Record<string, string>>({});
  const [bulkDraft, setBulkDraft] = useState('');
  const [externalDrafts, setExternalDrafts] = useState<Record<string, string>>({});
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  /** Off by default: the blended figure is derived, typing it is the exception. */
  const [bulkOverride, setBulkOverride] = useState(false);

  const itemValue = (id: string) =>
    itemDrafts[id] ?? (savedItemPrices.get(id) !== undefined ? String(savedItemPrices.get(id)) : '');
  const externalValue = (id: string) =>
    externalDrafts[id] ?? (savedExternal.get(id) !== undefined ? String(savedExternal.get(id)) : '');
  const bulkValue = bulkDraft || (savedBulk !== null ? String(savedBulk) : '');

  const switchPeriod = (id: string) => {
    setPeriodId(id);
    setItemDrafts({});
    setBulkDraft('');
    setExternalDrafts({});
    setSavedNotice(null);
    setBulkOverride(false);
  };

  // Each item's price against its own recent weeks — the answer to "what
  // happened to this grade?", which a bare input box cannot give. The baseline
  // stops short of this auction, so a new price never averages against itself.
  const itemHistory = selectOurItemHistoryBeforePeriod(state, periodId);
  const movements = teaItems.map((item) => {
    const enteredPricePerKg = parsePrice(itemValue(item.id));
    const past = itemHistory.get(item.id) ?? null;
    return {
      item,
      past,
      enteredPricePerKg,
      comparison: compare(enteredPricePerKg, past?.averagePricePerKg ?? null),
    };
  });

  const tally = {
    up: movements.filter((m) => m.comparison.verdict === 'above').length,
    down: movements.filter((m) => m.comparison.verdict === 'below').length,
    flat: movements.filter((m) => m.comparison.verdict === 'equal').length,
    pending: movements.filter((m) => m.enteredPricePerKg === null).length,
  };

  // The bulk set this auction sells. Its quantities are the weights that turn
  // the per-item prices above into one blended figure.
  const bulkSet = selectBulkSetForPeriod(state, periodId);

  // Whatever is on screen right now — drafts winning over what is on record.
  const enteredPrices = new Map<string, number>(
    movements
      .filter((m) => m.enteredPricePerKg !== null)
      .map((m) => [m.item.id, m.enteredPricePerKg!]),
  );

  const blend = bulkSet ? valueBulkSetAtPrices(state, bulkSet.items, enteredPrices) : null;
  const blendedBulk = blend?.expectedPricePerKg ?? null;

  // Typed only when there is nothing to blend from, or the user took over.
  const typedBulk = parsePrice(bulkValue);
  const manualEntry = bulkOverride || bulkSet === null;
  const effectiveBulk = manualEntry ? typedBulk : blendedBulk;

  const quantityInSet = new Map(bulkSet?.items.map((i) => [i.teaItemId, i.quantityKg]) ?? []);

  // Live preview of how this auction compares, using whatever is entered now.
  const preview = useMemo(() => {
    const ours = effectiveBulk;
    const theirs = marketAverage(
      externalFactories
        .map((factory) => ({
          externalFactoryId: factory.id,
          pricePerKg: parsePrice(externalValue(factory.id)),
        }))
        .filter((r): r is { externalFactoryId: string; pricePerKg: number } => r.pricePerKg !== null),
    );
    return { ours, market: theirs, ...compare(ours, theirs.averagePricePerKg) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveBulk, externalDrafts, savedExternal, externalFactories]);

  const save = () => {
    if (!period) return;

    const itemEntries = movements
      .filter((m) => m.enteredPricePerKg !== null)
      .map((m) => ({ teaItemId: m.item.id, pricePerKg: m.enteredPricePerKg! }))
      .filter((e) => e.pricePerKg !== savedItemPrices.get(e.teaItemId));

    const externalEntries = externalFactories
      .map((f) => ({ externalFactoryId: f.id, pricePerKg: parsePrice(externalValue(f.id)) }))
      .filter((e): e is { externalFactoryId: string; pricePerKg: number } => e.pricePerKg !== null)
      .filter((e) => e.pricePerKg !== savedExternal.get(e.externalFactoryId));

    // The blended figure is derived, so it is saved whenever it moves — no
    // separate field to remember to update.
    const bulk = effectiveBulk;
    const bulkChanged = bulk !== null && bulk !== savedBulk;

    if (itemEntries.length > 0) recordOurPrices(period.id, itemEntries);
    if (bulkChanged) recordOurBulkResult(period.id, bulk, bulkSet?.id ?? null);
    if (externalEntries.length > 0) recordExternalResults(period.id, externalEntries);

    const changed = itemEntries.length + externalEntries.length + (bulkChanged ? 1 : 0);
    if (changed === 0) {
      setSavedNotice('Nothing changed — no new entries recorded.');
    } else {
      if (period.status === 'upcoming') markPeriodSold(period.id);
      setSavedNotice(`Recorded ${changed} ${changed === 1 ? 'entry' : 'entries'} for ${period.label}.`);
      setItemDrafts({});
      setBulkDraft('');
      setExternalDrafts({});
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        greeting="Record Auction Results"
        subTitle={
          period
            ? `${period.label} · ${formatAuctionDate(period.auctionDate)}`
            : 'No auction selected'
        }
        notificationCount={0}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Which auction */}
        <View style={styles.selectorCard}>
          <Text style={styles.selectorLabel}>AUCTION</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.pillRow}>
              {orderedPeriods.map((p) => {
                const active = p.id === periodId;
                return (
                  <Pressable
                    key={p.id}
                    style={[styles.pill, active && styles.pillActive]}
                    onPress={() => switchPeriod(p.id)}>
                    <Text style={[styles.pillTitle, active && styles.pillTitleActive]}>
                      {p.label}
                    </Text>
                    <Text style={[styles.pillMeta, active && styles.pillMetaActive]}>
                      {formatAuctionDate(p.auctionDate)}
                    </Text>
                    {p.status === 'upcoming' && <View style={styles.upcomingDot} />}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {savedNotice && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{savedNotice}</Text>
          </View>
        )}

        {/* 1 — our per-item prices */}
        <View style={styles.sectionCard}>
          <SectionHeading
            icon={<LeafIcon color={Colors.primary} size={18} />}
            tint={Colors.primaryLight}
            title="Our Tea Item Prices"
            subtitle={
              bulkSet
                ? `What 1 kg of each item fetched at this auction, each set against that grade's own average from earlier auctions. Weighted by the kilos in ${bulkSet.reference}, they also give the blended bulk price below.`
                : "What 1 kg of each item fetched at this auction, each set against that grade's own average from earlier auctions."
            }
          />
          {/* What moved, at a glance, before reading the grid item by item */}
          {tally.up + tally.down + tally.flat > 0 && (
            <View style={styles.tallyRow}>
              <Text style={styles.tallyText}>
                <Text style={styles.tallyUp}>{tally.up} up</Text>
                <Text style={styles.tallySep}> · </Text>
                <Text style={styles.tallyDown}>{tally.down} down</Text>
                <Text style={styles.tallySep}> · </Text>
                {tally.flat} unchanged against their own past averages
                {tally.pending > 0 ? ` · ${tally.pending} still to enter` : ''}
              </Text>
            </View>
          )}

          <View style={styles.inputGrid}>
            {movements.map(({ item, past, comparison }) => (
              <View key={item.id} style={styles.inputCell}>
                <View style={styles.inputLabelRow}>
                  <Text style={styles.inputCode}>{item.code}</Text>
                  {quantityInSet.has(item.id) && (
                    <Text style={styles.setTag}>
                      {formatKg(quantityInSet.get(item.id)!)} kg in set
                    </Text>
                  )}
                  {savedItemPrices.has(item.id) && <Text style={styles.savedTag}>on record</Text>}
                </View>
                <Text style={styles.inputName}>{item.name}</Text>
                <View style={styles.inputWrap}>
                  <Text style={styles.inputPrefix}>Rs.</Text>
                  <TextInput
                    style={styles.input}
                    value={itemValue(item.id)}
                    onChangeText={(text) =>
                      setItemDrafts((prev) => ({ ...prev, [item.id]: text }))
                    }
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={Colors.textSecondary}
                  />
                  <Text style={styles.inputSuffix}>/kg</Text>
                </View>

                {/* This grade against its own recent weeks */}
                {past && past.averagePricePerKg !== null ? (
                  <View style={styles.pastBlock}>
                    <View style={styles.pastLine}>
                      <Text style={styles.pastLabel}>
                        Avg of {past.periodsCounted} auction{past.periodsCounted === 1 ? '' : 's'}
                      </Text>
                      <Text style={styles.pastValue}>Rs. {formatRs(past.averagePricePerKg)}</Text>
                    </View>
                    {past.lastPricePerKg !== null && (
                      <View style={styles.pastLine}>
                        <Text style={styles.pastLabel}>{past.lastPeriodLabel}</Text>
                        <Text style={styles.pastValue}>Rs. {formatRs(past.lastPricePerKg)}</Text>
                      </View>
                    )}
                    <MovementChip comparison={comparison} />
                  </View>
                ) : (
                  <View style={styles.pastBlock}>
                    <Text style={styles.pastEmpty}>No earlier auctions to compare against.</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* 2 — our blended bulk price, worked out from the prices above */}
        <View style={styles.sectionCard}>
          <SectionHeading
            icon={<ChartIcon color={Colors.primary} size={18} />}
            tint="#F0FDF4"
            title="Our Bulk Set Price"
            subtitle="One blended figure for the whole bulk set we sold. This is what compares directly against other factories."
          />

          {bulkSet && blend ? (
            <>
              <View style={styles.blendCard}>
                <View style={styles.blendFigure}>
                  <Text style={styles.blendLabel}>
                    {manualEntry ? 'BLENDED FROM ITEM PRICES · NOT IN USE' : 'BLENDED FROM ITEM PRICES'}
                  </Text>
                  <Text style={[styles.blendValue, manualEntry && styles.blendValueMuted]}>
                    Rs. {formatRs(blendedBulk)}
                    <Text style={styles.blendUnit}> /kg</Text>
                  </Text>
                  <Text style={styles.blendMeta}>
                    {blendedBulk === null
                      ? `Enter the item prices above and ${bulkSet.reference} blends them here.`
                      : `${bulkSet.reference} · Σ(kg × price) ÷ Σ(kg) over ${formatKg(blend.pricedQuantityKg)} of ${formatKg(blend.totalQuantityKg)} kg`}
                  </Text>
                </View>
                <Pressable
                  style={styles.overrideToggle}
                  onPress={() => setBulkOverride((on) => !on)}>
                  <Text style={styles.overrideToggleText}>
                    {manualEntry ? 'Use blended figure' : 'Enter manually'}
                  </Text>
                </Pressable>
              </View>

              {/* How each line reached that figure */}
              <View style={styles.blendTable}>
                <View style={styles.blendTableHeader}>
                  <Text style={[styles.blendTh, styles.blendColItem]}>Tea Item</Text>
                  <Text style={[styles.blendTh, styles.blendColNum]}>Quantity</Text>
                  <Text style={[styles.blendTh, styles.blendColNum]}>Price /kg</Text>
                  <Text style={[styles.blendTh, styles.blendColNum]}>Share</Text>
                </View>
                {blend.lines.map((line) => {
                  const priced = line.ourAveragePricePerKg !== null;
                  return (
                    <View key={line.teaItemId} style={styles.blendTableRow}>
                      <View style={styles.blendColItem}>
                        <Text style={styles.blendTdBold}>{line.teaItemCode}</Text>
                        <Text style={styles.blendTdMuted}>{line.teaItemName}</Text>
                      </View>
                      <Text style={[styles.blendTdText, styles.blendColNum]}>
                        {formatKg(line.quantityKg)} kg
                      </Text>
                      <Text
                        style={[
                          styles.blendTdBold,
                          styles.blendColNum,
                          !priced && styles.blendTdWaiting,
                        ]}>
                        {priced ? formatRs(line.ourAveragePricePerKg) : 'not entered'}
                      </Text>
                      <Text style={[styles.blendTdText, styles.blendColNum]}>
                        {formatPercent(line.shareOfValue)}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {blend.unpricedTeaItemCodes.length > 0 && (
                <View style={styles.blendWarning}>
                  <Text style={styles.blendWarningText}>
                    {blend.unpricedTeaItemCodes.join(', ')} still ha
                    {blend.unpricedTeaItemCodes.length === 1 ? 's' : 've'} no price for this
                    auction, so {formatKg(blend.totalQuantityKg - blend.pricedQuantityKg)} kg is
                    left out of the blend. Coverage: {formatPercent(blend.coverage)}.
                  </Text>
                </View>
              )}
            </>
          ) : (
            <Text style={styles.blendMissing}>
              No bulk set is attached to this auction, so there are no kilos to weight the item
              prices by. Enter the blended figure by hand, or create the set on Prepare Bulk Set.
            </Text>
          )}

          {manualEntry && (
            <View style={styles.bulkRow}>
              <View style={styles.bulkInputWrap}>
                <Text style={styles.inputPrefix}>Rs.</Text>
                <TextInput
                  style={[styles.input, styles.bulkInput]}
                  value={bulkValue}
                  onChangeText={setBulkDraft}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={Colors.textSecondary}
                />
                <Text style={styles.inputSuffix}>/kg</Text>
              </View>
              {bulkSet && (
                <Text style={styles.bulkSaved}>
                  Typed by hand — this is what gets recorded, not the blended figure above.
                </Text>
              )}
            </View>
          )}

          {savedBulk !== null && (
            <Text style={styles.bulkSaved}>
              Currently on record: Rs. {formatRs(savedBulk)}
              {effectiveBulk !== null && effectiveBulk !== savedBulk
                ? ` — saving records Rs. ${formatRs(effectiveBulk)} as a correction.`
                : ''}
            </Text>
          )}
        </View>

        {/* 3 — other factories */}
        <View style={styles.sectionCard}>
          <SectionHeading
            icon={<MoneyIcon color="#B8860B" size={18} />}
            tint="#FFF8E1"
            title="Other Factories' Bulk Prices"
            subtitle="One blended figure per factory, read from the published auction reports. They differ because each factory sold a different mix — and none of them report per tea item."
          />
          <View style={styles.inputGrid}>
            {externalFactories.map((factory) => (
              <View key={factory.id} style={styles.inputCell}>
                <View style={styles.inputLabelRow}>
                  <Text style={styles.inputCode}>{factory.code}</Text>
                  {savedExternal.has(factory.id) && <Text style={styles.savedTag}>on record</Text>}
                </View>
                <Text style={styles.inputName}>
                  {factory.name}
                  {factory.region ? ` · ${factory.region}` : ''}
                </Text>
                <View style={styles.inputWrap}>
                  <Text style={styles.inputPrefix}>Rs.</Text>
                  <TextInput
                    style={styles.input}
                    value={externalValue(factory.id)}
                    onChangeText={(text) =>
                      setExternalDrafts((prev) => ({ ...prev, [factory.id]: text }))
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
        </View>

        {/* Live comparison for this auction */}
        <View style={styles.previewCard}>
          <View style={styles.previewBlock}>
            <Text style={styles.previewLabel}>OUR BULK</Text>
            <Text style={styles.previewValue}>Rs. {formatRs(preview.ours)}</Text>
          </View>
          <View style={styles.previewDivider} />
          <View style={styles.previewBlock}>
            <Text style={styles.previewLabel}>
              MARKET · {preview.market.factoriesCounted} FACTORIES
            </Text>
            <Text style={[styles.previewValue, { color: '#B8860B' }]}>
              Rs. {formatRs(preview.market.averagePricePerKg)}
            </Text>
          </View>
          <View style={styles.previewDivider} />
          <View style={styles.previewBlock}>
            <Text style={styles.previewLabel}>DIFFERENCE</Text>
            <Text
              style={[
                styles.previewValue,
                {
                  color:
                    preview.verdict === 'below'
                      ? Colors.below
                      : preview.verdict === 'unknown'
                        ? Colors.textSecondary
                        : Colors.above,
                },
              ]}>
              {formatSignedRs(preview.differencePerKg)}
            </Text>
            <VerdictBadge verdict={preview.verdict} percent={preview.differencePercent} compact />
          </View>
        </View>

        <Pressable style={styles.saveButton} onPress={save}>
          <Text style={styles.saveButtonText}>
            Save results for {period?.label ?? 'this auction'}
          </Text>
        </Pressable>
        <Text style={styles.appendNote}>
          Saving appends to the record — the item prices, and the blended bulk figure they produce.
          Entering a value that already exists keeps the original on file and treats the new one as
          a correction.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeading({
  icon,
  tint,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  tint: string;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.headingRow}>
      <View style={[styles.headingIcon, { backgroundColor: tint }]}>{icon}</View>
      <View style={styles.headingText}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

/**
 * How one grade's new price sits against its own past weeks.
 *
 * Kept apart from VerdictBadge deliberately: that badge reads "ABOVE MARKET",
 * and this is not a market comparison — other factories never report per grade.
 * It borrows the same palette so the two read as one family.
 */
function MovementChip({ comparison }: { comparison: Comparison }) {
  const palette = {
    above:   { bg: Colors.aboveLight, fg: Colors.above,         mark: '▲' },
    below:   { bg: Colors.belowLight, fg: Colors.below,         mark: '▼' },
    equal:   { bg: '#EFF6FF',         fg: '#2563EB',            mark: '=' },
    unknown: { bg: '#F1F5F9',         fg: Colors.textSecondary, mark: '·' },
  }[comparison.verdict];

  const label =
    comparison.verdict === 'unknown'
      ? 'Enter a price to compare'
      : comparison.verdict === 'equal'
        ? '= Same as average'
        : `${palette.mark} ${formatSignedRs(comparison.differencePerKg)} · ${formatPercent(
            comparison.differencePercent === null ? null : Math.abs(comparison.differencePercent),
          )} vs avg`;

  return (
    <View style={[styles.movementChip, { backgroundColor: palette.bg }]}>
      <Text style={[styles.movementText, { color: palette.fg }]}>{label}</Text>
    </View>
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

  selectorCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  selectorLabel: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.8 },
  pillRow: { flexDirection: 'row', gap: 8 },
  pill: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 130,
  },
  pillActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  pillTitle: { fontSize: 13, fontWeight: '700', color: Colors.text },
  pillTitleActive: { color: Colors.primary },
  pillMeta: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  pillMetaActive: { color: Colors.primary },
  upcomingDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
  },

  notice: {
    backgroundColor: Colors.aboveLight,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.above,
  },
  noticeText: { fontSize: 13, color: Colors.above, fontWeight: '600' },

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

  inputGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  // flexBasis + maxWidth rather than flex:1 — otherwise a short final row
  // stretches two cells across the whole card and the columns stop lining up.
  inputCell: { flexGrow: 1, flexBasis: 210, minWidth: 190, maxWidth: 300, gap: 4 },
  inputLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputCode: { fontSize: 13, fontWeight: '700', color: Colors.text },
  savedTag: { fontSize: 10, fontWeight: '600', color: Colors.primary },
  setTag: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textSecondary,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  inputName: { fontSize: 11, color: Colors.textSecondary },

  // The baseline sits under its own input, quiet enough to stay a reference
  // rather than competing with the figure being typed.
  pastBlock: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 3,
  },
  pastLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  pastLabel: { fontSize: 11, color: Colors.textSecondary, flexShrink: 1 },
  pastValue: { fontSize: 11, fontWeight: '600', color: Colors.text, flexShrink: 0 },
  pastEmpty: { fontSize: 11, color: Colors.textSecondary, fontStyle: 'italic' },
  movementChip: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginTop: 2,
  },
  movementText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

  tallyRow: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  tallyText: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
  tallyUp: { fontWeight: '700', color: Colors.above },
  tallyDown: { fontWeight: '700', color: Colors.below },
  tallySep: { color: Colors.border },
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
  // The affixes must not shrink, or a tight column clips "/kg" mid-glyph.
  inputPrefix: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600', flexShrink: 0 },
  inputSuffix: { fontSize: 12, color: Colors.textSecondary, flexShrink: 0 },
  input: { flex: 1, minWidth: 0, paddingVertical: 10, fontSize: 15, fontWeight: '600', color: Colors.text },

  // The derived figure reads as a result, not a field: no input chrome, and the
  // weighting spelled out underneath so the number is never a black box.
  blendCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 10,
    padding: 16,
  },
  blendFigure: { flexGrow: 1, flexBasis: 220, gap: 2 },
  blendLabel: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.6 },
  blendValue: { fontSize: 26, fontWeight: '700', color: Colors.primary },
  blendValueMuted: { color: Colors.textSecondary },
  blendUnit: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  blendMeta: { fontSize: 11, color: Colors.textSecondary, lineHeight: 16 },
  overrideToggle: {
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.card,
  },
  overrideToggleText: { fontSize: 12, fontWeight: '600', color: Colors.primary },

  blendTable: { borderRadius: 8, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  blendTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  blendTh: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase' },
  blendTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 8,
  },
  blendColItem: { flex: 2.2 },
  blendColNum: { flex: 1.2, textAlign: 'right' },
  blendTdBold: { fontSize: 13, fontWeight: '600', color: Colors.text },
  blendTdText: { fontSize: 13, color: Colors.textSecondary },
  blendTdMuted: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  blendTdWaiting: { fontWeight: '400', color: Colors.textSecondary },

  blendWarning: {
    backgroundColor: Colors.accentLight,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F0D48A',
  },
  blendWarningText: { fontSize: 12, color: '#8A6D1F', lineHeight: 18 },
  blendMissing: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },

  bulkRow: { gap: 8 },
  bulkInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    gap: 8,
    maxWidth: 320,
  },
  bulkInput: { fontSize: 20, paddingVertical: 12 },
  bulkSaved: { fontSize: 12, color: Colors.textSecondary },

  previewCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 14,
  },
  previewBlock: { flex: 1, minWidth: 150, gap: 4 },
  previewDivider: { width: 1, backgroundColor: Colors.border },
  previewLabel: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.6 },
  previewValue: { fontSize: 20, fontWeight: '700', color: Colors.text },

  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  appendNote: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center', lineHeight: 16 },
});
