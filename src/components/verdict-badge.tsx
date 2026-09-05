import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { Colors } from '@/constants/colors';
import { formatPercent } from '@/domain/averaging';
import type { ComparisonVerdict } from '@/domain/types';

/**
 * Above / below / equal against the market.
 *
 * 'unknown' is a real state, not an error: it means one side has no data for
 * the chosen range. It reads as "no comparison" rather than borrowing the
 * colour of a good or bad result.
 */
export default function VerdictBadge({
  verdict,
  percent,
  compact = false,
}: {
  verdict: ComparisonVerdict;
  percent?: number | null;
  compact?: boolean;
}) {
  // Each verdict carries its own short form: deriving one by splitting the
  // long label turned "NO COMPARISON" into a bare "NO".
  const palette = {
    above:   { bg: Colors.aboveLight, fg: Colors.above,          label: '▲ ABOVE MARKET', short: '▲ ABOVE' },
    below:   { bg: Colors.belowLight, fg: Colors.below,          label: '▼ BELOW MARKET', short: '▼ BELOW' },
    equal:   { bg: '#EFF6FF',         fg: '#2563EB',             label: '= AT MARKET',    short: '= EQUAL' },
    unknown: { bg: '#F1F5F9',         fg: Colors.textSecondary,  label: 'NO COMPARISON',  short: 'NO DATA' },
  }[verdict];

  const suffix =
    verdict !== 'unknown' && percent !== null && percent !== undefined
      ? ` ${formatPercent(Math.abs(percent))}`
      : '';

  return (
    <View style={styles.row}>
      <View style={[styles.badge, { backgroundColor: palette.bg }, compact && styles.compact]}>
        <Text style={[styles.text, { color: palette.fg }, compact && styles.compactText]}>
          {compact ? palette.short : palette.label}
          {suffix}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  compact: { paddingHorizontal: 6, paddingVertical: 2 },
  text: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  compactText: { fontSize: 10, letterSpacing: 0.3 },
});
