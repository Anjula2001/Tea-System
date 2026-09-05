import React, { useMemo, useState } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/colors';
import Header from '@/components/header';
import VerdictBadge from '@/components/verdict-badge';
import { LeafIcon, MoneyIcon, ChartIcon } from '@/components/ui-icons';
import { compare, formatAuctionDate, formatRs, formatSignedRs, marketAverage } from '@/domain/averaging';
import {
  selectExternalResultsForPeriod,
  selectOurBulkForPeriod,
  selectOurPricesForPeriod,
  useTeaStore,
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
  };

  // Live preview of how this auction compares, using whatever is entered now.
  const preview = useMemo(() => {
    const ours = parsePrice(bulkValue);
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
  }, [bulkValue, externalDrafts, savedExternal, externalFactories]);

  const save = () => {
    if (!period) return;

    const itemEntries = teaItems
      .map((item) => ({ teaItemId: item.id, pricePerKg: parsePrice(itemValue(item.id)) }))
      .filter((e): e is { teaItemId: string; pricePerKg: number } => e.pricePerKg !== null)
      .filter((e) => e.pricePerKg !== savedItemPrices.get(e.teaItemId));

    const externalEntries = externalFactories
      .map((f) => ({ externalFactoryId: f.id, pricePerKg: parsePrice(externalValue(f.id)) }))
      .filter((e): e is { externalFactoryId: string; pricePerKg: number } => e.pricePerKg !== null)
      .filter((e) => e.pricePerKg !== savedExternal.get(e.externalFactoryId));

    const bulk = parsePrice(bulkValue);
    const bulkChanged = bulk !== null && bulk !== savedBulk;

    if (itemEntries.length > 0) recordOurPrices(period.id, itemEntries);
    if (bulkChanged) recordOurBulkResult(period.id, bulk);
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
            subtitle="What 1 kg of each item fetched at this auction. These build our per-item averages."
          />
          <View style={styles.inputGrid}>
            {teaItems.map((item) => (
              <View key={item.id} style={styles.inputCell}>
                <View style={styles.inputLabelRow}>
                  <Text style={styles.inputCode}>{item.code}</Text>
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
              </View>
            ))}
          </View>
        </View>

        {/* 2 — our blended bulk price */}
        <View style={styles.sectionCard}>
          <SectionHeading
            icon={<ChartIcon color={Colors.primary} size={18} />}
            tint="#F0FDF4"
            title="Our Bulk Set Price"
            subtitle="One blended figure for the whole bulk set we sold. This is what compares directly against other factories."
          />
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
            {savedBulk !== null && (
              <Text style={styles.bulkSaved}>Currently on record: Rs. {formatRs(savedBulk)}</Text>
            )}
          </View>
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
          Saving appends to the record. Entering a value that already exists keeps the original on
          file and treats the new one as a correction.
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
  // The affixes must not shrink, or a tight column clips "/kg" mid-glyph.
  inputPrefix: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600', flexShrink: 0 },
  inputSuffix: { fontSize: 12, color: Colors.textSecondary, flexShrink: 0 },
  input: { flex: 1, minWidth: 0, paddingVertical: 10, fontSize: 15, fontWeight: '600', color: Colors.text },

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
