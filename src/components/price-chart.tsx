import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { Colors } from '@/constants/colors';
import { formatRs } from '@/domain/averaging';

export interface PricePoint {
  sellingPeriodId: string;
  label: string;
  auctionDate: string;
  pricePerKg: number;
}

/**
 * One series' price, auction by auction — a tea grade of ours, or another
 * factory's published bulk figure. The shape of the question is the same, so
 * the chart is; only the caller knows what to call the subject, which is why
 * the empty state is a prop.
 *
 * A single series, so there is no legend: the caller's heading names the grade,
 * and a legend box for one line is noise. The dashed rule is the period average
 * — a reference, not a second series — labelled where it meets the axis so it
 * never has to be guessed at.
 *
 * Only three points carry a number: the highest, the lowest and the latest.
 * Labelling every point turns a trend into a table, and there is a real table
 * underneath this chart for anyone who wants to read the figures.
 *
 * The y-axis is fitted to the data rather than anchored at zero. For a price
 * series that is the honest choice — tea has never been worth nothing, and a
 * zero baseline would flatten every real movement into a hairline — so the
 * axis is always tick-labelled, and the caller states the band beneath it.
 */
export default function PriceChart({
  points,
  averagePricePerKg,
  emptyMessage = 'Nothing recorded in the chosen period.',
}: {
  points: readonly PricePoint[];
  averagePricePerKg: number | null;
  emptyMessage?: string;
}) {
  const width = 720;
  const height = 260;
  const padding = { top: 24, right: 28, bottom: 42, left: 68 };

  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  if (points.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  const values = points.map((p) => p.pricePerKg);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  // A flat series would otherwise divide by zero and draw off the top edge.
  const band = Math.max(rawMax - rawMin, Math.max(rawMax * 0.02, 1));
  const min = rawMin - band * 0.35;
  const max = rawMax + band * 0.35;

  const x = (index: number) =>
    padding.left + (points.length === 1 ? plotW / 2 : (index / (points.length - 1)) * plotW);
  const y = (value: number) => padding.top + plotH - ((value - min) / (max - min)) * plotH;

  const ticks = [min + (max - min) * 0.12, (min + max) / 2, max - (max - min) * 0.12];

  const highest = values.indexOf(rawMax);
  const lowest = values.indexOf(rawMin);
  const latest = points.length - 1;
  // Latest last, so when it coincides with a peak it wins the single slot.
  const labelled = new Set([highest, lowest, latest]);

  return (
    <View style={styles.wrapper}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Recessive grid */}
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

        {/* The period average, as a reference rule rather than a second series */}
        {averagePricePerKg !== null &&
          averagePricePerKg >= min &&
          averagePricePerKg <= max && (
            <>
              <Line
                x1={padding.left}
                y1={y(averagePricePerKg)}
                x2={width - padding.right}
                y2={y(averagePricePerKg)}
                stroke={Colors.textSecondary}
                strokeWidth={1.5}
                strokeDasharray="7 5"
              />
              <SvgText
                x={width - padding.right}
                y={y(averagePricePerKg) - 8}
                fill={Colors.textSecondary}
                fontSize={11}
                fontWeight="600"
                textAnchor="end">
                avg {formatRs(averagePricePerKg)}
              </SvgText>
            </>
          )}

        <Polyline
          points={points.map((p, i) => `${x(i)},${y(p.pricePerKg)}`).join(' ')}
          fill="none"
          stroke={Colors.primary}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {points.map((point, i) => (
          <React.Fragment key={point.sellingPeriodId}>
            {/* A surface ring keeps a marker legible where the line runs under it */}
            <Circle
              cx={x(i)}
              cy={y(point.pricePerKg)}
              r={4.5}
              fill={Colors.primary}
              stroke={Colors.card}
              strokeWidth={2}
            />
            {labelled.has(i) && (
              <SvgText
                x={x(i)}
                // Below the point at the low, above it everywhere else, so a
                // label never sits on the line it belongs to.
                y={i === lowest && i !== highest ? y(point.pricePerKg) + 20 : y(point.pricePerKg) - 12}
                fill={Colors.text}
                fontSize={11}
                fontWeight="700"
                textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}>
                {formatRs(point.pricePerKg, 0)}
              </SvgText>
            )}
            <SvgText
              x={x(i)}
              y={height - 14}
              fill={Colors.textSecondary}
              fontSize={11}
              textAnchor="middle">
              {shortLabel(point.label)}
            </SvgText>
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
}

/** "Auction 24 · Aug 2026" reads as "A24" once it is one of eight on an axis. */
function shortLabel(label: string): string {
  const match = /auction\s*(\d+)/i.exec(label);
  if (match) return `A${match[1]}`;
  return label.split('·')[0]!.trim().slice(0, 8);
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
