import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Line, Polyline, Circle, Text as SvgText, G } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { useTeaStore } from '@/store/tea-store';

export default function WeeklyChart() {
  const weeklyTrends = useTeaStore((s) => s.weeklyTrends);

  const chartHeight = 180;
  const paddingLeft = 45;
  const paddingRight = 25;
  const paddingTop = 20;
  const paddingBottom = 30;

  // We can calculate dynamic SVG width or fixed viewBox
  const viewBoxWidth = 600;
  const graphWidth = viewBoxWidth - paddingLeft - paddingRight;
  const graphHeight = chartHeight - paddingTop - paddingBottom;

  const minVal = 1350;
  const maxVal = 1550;
  const yTicks = [1350, 1400, 1450, 1500, 1550];

  const stepX = graphWidth / Math.max(1, weeklyTrends.length - 1);

  // Generate points for polyline
  const factoryPoints = weeklyTrends
    .map((pt, idx) => {
      const x = paddingLeft + idx * stepX;
      const y = paddingTop + graphHeight - ((pt.factoryBulkAvg - minVal) / (maxVal - minVal)) * graphHeight;
      return `${x},${y}`;
    })
    .join(' ');

  const globalPoints = weeklyTrends
    .map((pt, idx) => {
      const x = paddingLeft + idx * stepX;
      const y = paddingTop + graphHeight - ((pt.globalPrice - minVal) / (maxVal - minVal)) * graphHeight;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <View style={styles.container}>
      <Svg width="100%" height={chartHeight} viewBox={`0 0 ${viewBoxWidth} ${chartHeight}`}>
        {/* Y Axis Grid lines & Ticks */}
        {yTicks.map((tick, index) => {
          const y = paddingTop + graphHeight - ((tick - minVal) / (maxVal - minVal)) * graphHeight;
          return (
            <G key={index}>
              <Line
                x1={paddingLeft}
                y1={y}
                x2={viewBoxWidth - paddingRight}
                y2={y}
                stroke="#E2E8F0"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <SvgText
                x={paddingLeft - 8}
                y={y + 4}
                fontSize="10"
                fill={Colors.textSecondary}
                textAnchor="end"
                fontWeight="600">
                {tick}
              </SvgText>
            </G>
          );
        })}

        {/* Global Price Polyline (Blue) */}
        <Polyline
          points={globalPoints}
          fill="none"
          stroke="#3B82F6"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Factory Bulk Avg Polyline (Tea Green) */}
        <Polyline
          points={factoryPoints}
          fill="none"
          stroke={Colors.primary}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Circles & Labels for Data Points */}
        {weeklyTrends.map((pt, idx) => {
          const x = paddingLeft + idx * stepX;
          const yFactory = paddingTop + graphHeight - ((pt.factoryBulkAvg - minVal) / (maxVal - minVal)) * graphHeight;
          const yGlobal = paddingTop + graphHeight - ((pt.globalPrice - minVal) / (maxVal - minVal)) * graphHeight;

          return (
            <G key={idx}>
              {/* X Axis Week Label */}
              <SvgText
                x={x}
                y={chartHeight - 8}
                fontSize="11"
                fill={Colors.text}
                fontWeight="600"
                textAnchor="middle">
                {pt.week}
              </SvgText>

              {/* Global price point */}
              <Circle cx={x} cy={yGlobal} r="4" fill="#3B82F6" stroke="#FFFFFF" strokeWidth="1.5" />

              {/* Factory bulk price point */}
              <Circle cx={x} cy={yFactory} r="5" fill={Colors.primary} stroke="#FFFFFF" strokeWidth="2" />
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 4,
  },
});
