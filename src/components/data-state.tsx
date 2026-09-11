import { useFocusEffect } from 'expo-router';
import React, { useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { API_BASE_URL } from '@/api';
import { Colors } from '@/constants/colors';
import { useTeaStore, type Resource } from '@/store/tea-store';

/**
 * The gate a screen sits behind, and the request that fills it.
 *
 * A screen names the resources it reads, and the fetch happens when the tab is
 * FOCUSED — not when it mounts. The navigator keeps screens alive in the
 * background once visited, so a mount-time fetch fires for a tab nobody is
 * looking at and never fires again when they come back to it. Focus is the
 * event that means "show me this now".
 *
 * The first visit fetches and waits. Every later visit re-fetches the same
 * resources and keeps the current figures on screen while it does, so clicking
 * a tab always asks the backend for that tab's data — the point of the
 * exercise — without the screen blanking on every navigation. This is what
 * keeps a busy database from being read through a cache that was filled once
 * at page load and never again.
 *
 * Nothing here is worth drawing over absent data — a dashboard of zeroes reads
 * as "we sold nothing", not as "the API is down" — so the screen renders only
 * once its own resources are ready, and otherwise says which of the two is
 * happening. A resource some other screen needed and failed to get is not this
 * screen's problem and does not block it.
 *
 * The failure case names the address it tried, because in development the
 * answer is almost always that the backend is not running or the phone is
 * pointed at the wrong host, and a bare "failed to load" sends someone hunting
 * in the wrong place.
 */
export function useScreenData(needs: readonly Resource[]): {
  ready: boolean;
  gate: React.ReactElement | null;
} {
  const ensure = useTeaStore((s) => s.ensure);
  const resources = useTeaStore((s) => s.resources);

  // A fresh array literal every render, so the effect keys on the contents.
  const key = needs.join(',');

  useFocusEffect(
    useCallback(() => {
      void ensure(key.split(',') as Resource[], { revalidate: true });
    }, [ensure, key]),
  );

  const mine = needs.map((need) => resources[need]);
  const failed = mine.find((r) => r.status === 'error');

  if (failed) {
    return {
      ready: false,
      gate: (
        <LoadFailed
          message={failed.error}
          onRetry={() => void ensure(needs, { force: true })}
        />
      ),
    };
  }

  if (mine.every((r) => r.status === 'ready')) return { ready: true, gate: null };

  return { ready: false, gate: <Loading /> };
}

function Loading() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.centre}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading from the factory database…</Text>
      </View>
    </SafeAreaView>
  );
}

function LoadFailed({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.centre}>
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Could not load your data</Text>
          <Text style={styles.errorMessage}>{message ?? 'The API did not respond.'}</Text>
          <Text style={styles.errorHint}>
            Trying {API_BASE_URL}. Start the backend with{' '}
            <Text style={styles.code}>npm run dev</Text> in the backend folder, and set{' '}
            <Text style={styles.code}>EXPO_PUBLIC_API_URL</Text> if it runs somewhere else.
          </Text>
          <Pressable style={styles.retry} onPress={onRetry}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  loadingText: { fontSize: 13, color: Colors.textSecondary },

  errorCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 22,
    gap: 10,
    maxWidth: 460,
  },
  errorTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  errorMessage: { fontSize: 13, color: Colors.below, fontWeight: '600', lineHeight: 19 },
  errorHint: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  code: { fontWeight: '700', color: Colors.text },
  retry: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 4,
  },
  retryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
