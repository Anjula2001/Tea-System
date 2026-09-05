import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Line, Polyline, Circle, Text as SvgText } from 'react-native-svg';

import { Colors } from '@/constants/colors';
import { formatRs } from '@/domain/averaging';
import type { PeriodComparison } from '@/domain/types';

/**
 * Our blended bulk price against the market's, auction by auction.
 *
 * Both series are the same kind of number — Rs/kg for a whole bulk set — which
 * is the only reason they belong on one axis. Auctions with no data on a side
 * simply have no point there; the line is not drawn through a fabricated zero.
 */
export default function TrendChart({ comparisons }: { comparisons: PeriodComparison[] }) {
  const width = 720;
  const height = 240;
  const padding = { top: 20, right: 20, bottom: 40, left: 64 };

  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const points = comparisons.filter(
    (c) => c.ourBulkPricePerKg !== null || c.marketAveragePricePerKg !== null,
  );

  if (points.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          No auction results recorded yet. Record one to see the trend.
        </Text>
      </View>
    );
  }

  const values = points.flatMap((c) =>
    [c.ourBulkPricePerKg, c.marketAveragePricePerKg].filter((v): v is number => v !== null),
  );
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  // Pad the band so the lines never sit flat against the top or bottom edge.
  const band = Math.max(rawMax - rawMin, 1);
  const min = rawMin - band * 0.25;
  const max = rawMax + band * 0.25;

  const x = (index: number) =>
    padding.left + (points.length === 1 ? plotW / 2 : (index / (points.length - 1)) * plotW);
  const y = (value: number) => padding.top + plotH - ((value - min) / (max - min)) * plotH;

  const series = (pick: (c: PeriodComparison) => number | null) =>
    points
      .map((c, i) => ({ v: pick(c), i }))
      .filter((p): p is { v: number; i: number } => p.v !== null)
      .map((p) => `${x(p.i)},${y(p.v)}`)
      .join(' ');

  const ticks = [min + (max - min) * 0.1, (min + max) / 2, max - (max - min) * 0.1];

  return (
    <View style={styles.wrapper}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {ticks.map((tick) => (
          <React.Fragment key={tick}>
            <Line
              x1={padding.left}
              y1={y(tick)}
              x2={width - padding.right}
              y2={y(tick)}
              stroke={Colors.border}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <SvgText
              x={padding.left - 10}
              y={y(tick) + 4}
              fill={Colors.textSecondary}
              fontSize={11}
              textAnchor="end">
              {formatRs(tick, 0)}
            </SvgText>
          </React.Fragment>
        ))}

        <Polyline
          points={series((c) => c.marketAveragePricePerKg)}
          fill="none"
          stroke="#D4A017"
          strokeWidth={2.5}
        />
        <Polyline
          points={series((c) => c.ourBulkPricePerKg)}
          fill="none"
          stroke={Colors.primary}
          strokeWidth={2.5}
        />

        {points.map((c, i) => (
          <React.Fragment key={c.sellingPeriodId}>
            {c.marketAveragePricePerKg !== null && (
              <Circle cx={x(i)} cy={y(c.marketAveragePricePerKg)} r={4} fill="#D4A017" />
            )}
            {c.ourBulkPricePerKg !== null && (
              <Circle cx={x(i)} cy={y(c.ourBulkPricePerKg)} r={4} fill={Colors.primary} />
            )}
            <SvgText
              x={x(i)}
              y={height - 14}
              fill={Colors.textSecondary}
              fontSize={11}
              textAnchor="middle">
              {c.label.replace('Auction ', 'A')}
            </SvgText>
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%' },
  empty: {
    paddingVertical: 40,
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 10,
  },
  emptyText: { fontSize: 13, color: Colors.textSecondary },
});
