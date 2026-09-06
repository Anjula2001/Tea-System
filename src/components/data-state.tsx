import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { API_BASE_URL } from '@/api';
import { Colors } from '@/constants/colors';
import { useTeaStore } from '@/store/tea-store';

/**
 * The gate every screen sits behind.
 *
 * Nothing in this app is worth drawing over stale or absent data — a dashboard
 * of zeroes reads as "we sold nothing", not as "the API is down". So a screen
 * renders its real content only once the cache is filled, and otherwise says
 * plainly which of the two is happening.
 *
 * The failure case names the address it tried, because in development the
 * answer is almost always that the backend is not running or the phone is
 * pointed at the wrong host, and a bare "failed to load" sends someone hunting
 * in the wrong place.
 */
export function useLoadedStore(): { ready: boolean; gate: React.ReactElement | null } {
  const status = useTeaStore((s) => s.status);
  const error = useTeaStore((s) => s.error);
  const load = useTeaStore((s) => s.load);

  useEffect(() => {
    void load();
  }, [load]);

  if (status === 'ready') return { ready: true, gate: null };

  return {
    ready: false,
    gate: status === 'error' ? <LoadFailed message={error} onRetry={() => load({ force: true })} /> : <Loading />,
  };
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
