import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api';
import { Colors } from '@/constants/colors';
import { useLoadedStore } from '@/components/data-state';
import Header from '@/components/header';
import { formatAuctionDate } from '@/domain/averaging';
import { selectActiveExternalFactories, useTeaStore } from '@/store/tea-store';

/**
 * Our own factory's record.
 *
 * This exists because the app used to say "Green Valley Tea Factory" in three
 * source files, which meant it belonged to one factory and could not be handed
 * to another without a code change. Now the name comes from the database, and
 * this is where it is set.
 *
 * There is no code field and no retire button: every other factory is a row in
 * a list where those matter, but there is exactly one of us, and the app cannot
 * function without it.
 */
export default function ProfileScreen() {
  const { ready, gate } = useLoadedStore();
  const router = useRouter();

  // A whole-store subscription, then selectors as plain functions over it —
  // the pattern every other screen uses, and not a matter of taste: these
  // selectors build a new array per call, so handing one to `useTeaStore` as a
  // subscription would make every render look like a change and loop forever.
  const state = useTeaStore();
  const { factoryProfile: profile, sellingPeriods, teaItems } = state;
  const updateFactoryProfile = useTeaStore((s) => s.updateFactoryProfile);
  const saving = useTeaStore((s) => s.saving);

  const others = selectActiveExternalFactories(state);

  const [edit, setEdit] = useState({ name: '', shortName: '', region: '' });
  const [notice, setNotice] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);

  // Seeded when the profile arrives, not in useState — the cache fills after
  // the first render, so an initialiser would only ever see nulls.
  useEffect(() => {
    if (!profile) return;
    setEdit({
      name: profile.name,
      shortName: profile.shortName,
      region: profile.region ?? '',
    });
  }, [profile?.id, profile?.name, profile?.shortName, profile?.region]);

  const save = async () => {
    if (edit.name.trim() === '' || edit.shortName.trim() === '') {
      setNotice({ text: 'Both the full name and the short name are needed.', tone: 'error' });
      return;
    }
    try {
      const saved = await updateFactoryProfile({
        name: edit.name.trim(),
        shortName: edit.shortName.trim(),
        region: edit.region.trim() === '' ? null : edit.region.trim(),
      });
      setNotice({ text: `Saved. This app now reads as ${saved.name}.`, tone: 'ok' });
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

  const sold = sellingPeriods.filter((p) => p.status === 'sold');
  const activeGrades = teaItems.filter((t) => t.active).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        greeting="Our Factory"
        subTitle={profile?.name ?? 'Loading…'}
        notificationCount={0}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        <Pressable style={styles.backLink} onPress={() => router.push('/')}>
          <Text style={styles.backLinkText}>← Dashboard</Text>
        </Pressable>

        {notice && (
          <View style={[styles.notice, notice.tone === 'error' && styles.noticeError]}>
            <Text style={[styles.noticeText, notice.tone === 'error' && styles.noticeErrorText]}>
              {notice.text}
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Our factory</Text>
          <Text style={styles.sectionSubtitle}>
            The name this app runs under. It appears in the sidebar, on every screen heading, and
            wherever our own figures are labelled — so changing it here changes it everywhere,
            with nothing to edit in the code.
          </Text>

          <View style={styles.editForm}>
            <View style={[styles.editField, styles.editFieldWide]}>
              <Text style={styles.fieldLabel}>FULL NAME</Text>
              <TextInput
                style={styles.textInput}
                value={edit.name}
                onChangeText={(name) => setEdit((e) => ({ ...e, name }))}
                placeholder="Green Valley Tea Factory"
                placeholderTextColor={Colors.textSecondary}
              />
            </View>
            <View style={styles.editField}>
              <Text style={styles.fieldLabel}>SHORT NAME</Text>
              <TextInput
                style={styles.textInput}
                value={edit.shortName}
                onChangeText={(shortName) => setEdit((e) => ({ ...e, shortName }))}
                placeholder="Green Valley"
                placeholderTextColor={Colors.textSecondary}
              />
            </View>
            <View style={styles.editField}>
              <Text style={styles.fieldLabel}>REGION</Text>
              <TextInput
                style={styles.textInput}
                value={edit.region}
                onChangeText={(region) => setEdit((e) => ({ ...e, region }))}
                placeholder="none"
                placeholderTextColor={Colors.textSecondary}
              />
            </View>
          </View>

          <Pressable
            style={[styles.applyButton, saving && styles.busy]}
            disabled={saving}
            onPress={save}>
            <Text style={styles.applyButtonText}>{saving ? 'Saving…' : 'Save changes'}</Text>
          </Pressable>

          <Text style={styles.footNote}>
            The short name is what fits the sidebar, and its initials become the badge in the top
            right. The region is the same field every other factory carries, so ours reads the
            same way theirs do.
          </Text>
        </View>

        {/* What the name is attached to */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>What we have on file</Text>
          <Text style={styles.sectionSubtitle}>
            Not editable here — each has its own screen. Shown so this page says what &ldquo;our
            factory&rdquo; actually amounts to in the database.
          </Text>

          <View style={styles.statRow}>
            <Stat label="TEA GRADES" value={String(activeGrades)} meta="active" />
            <Stat label="AUCTIONS SOLD" value={String(sold.length)} meta={
              sold.length > 0
                ? `latest ${formatAuctionDate(sold.at(-1)!.auctionDate)}`
                : 'none yet'
            } />
            <Stat label="FACTORIES TRACKED" value={String(others.length)} meta="in the benchmark" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, meta }: { label: string; value: string; meta?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {meta && <Text style={styles.statMeta}>{meta}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  scrollContent: { padding: 20, gap: 20, paddingBottom: 48 },
  busy: { opacity: 0.6 },

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
  editForm: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 10 },
  editField: { flexGrow: 1, flexBasis: 150, minWidth: 140, gap: 4 },
  editFieldWide: { flexBasis: 240 },

  applyButton: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  applyButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  stat: { flexGrow: 1, flexBasis: 150, minWidth: 130, gap: 2 },
  statLabel: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.6 },
  statValue: { fontSize: 20, fontWeight: '700', color: Colors.text },
  statMeta: { fontSize: 11, color: Colors.textSecondary },

  footNote: { fontSize: 11, color: Colors.textSecondary, lineHeight: 16 },
});
