import React from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import Header from '@/components/header';
import WeeklyChart from '@/components/weekly-chart';
import {
  MoneyIcon,
  LeafIcon,
  ChartIcon,
  PlusIcon,
  ChevronRightIcon,
} from '@/components/ui-icons';
import { useTeaStore } from '@/store/tea-store';

export default function DashboardScreen() {
  const router = useRouter();
  const globalPrice = useTeaStore((s) => s.globalPrice);
  const weeklyReports = useTeaStore((s) => s.weeklyReports);
  const bulkSets = useTeaStore((s) => s.bulkSets);

  const currentReport = weeklyReports[0] || {
    factoryBulkAvg: 1492,
    comparisonDiff: 42,
    isAbove: true,
    totalVolumeKg: 18400,
  };

  const isAbove = currentReport.isAbove;
  const diff = Math.abs(currentReport.comparisonDiff);
  const percentDiff = globalPrice > 0 ? ((diff / globalPrice) * 100).toFixed(1) : '0';

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        greeting="Tea Factory Dashboard"
        subTitle="Green Valley Plantation #4 • Week 29 Active"
        notificationCount={2}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        
        {/* KPI Metrics Cards Grid */}
        <View style={styles.metricsGrid}>
          {/* Card 1: Weekly Global Tea Price */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>Weekly Global Price</Text>
              <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
                <MoneyIcon color="#2563EB" size={20} />
              </View>
            </View>
            <Text style={styles.metricValue}>
              Rs. {globalPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              <Text style={styles.unitText}> / kg</Text>
            </Text>
            <Text style={styles.subtext}>Global Tea Auction Benchmark</Text>
          </View>

          {/* Card 2: Factory Bulk Average Price */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>Factory Bulk Average</Text>
              <View style={[styles.iconBox, { backgroundColor: Colors.primaryLight }]}>
                <LeafIcon color={Colors.primary} size={20} />
              </View>
            </View>
            <Text style={styles.metricValue}>
              Rs. {currentReport.factoryBulkAvg.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              <Text style={styles.unitText}> / kg</Text>
            </Text>
            <Text style={styles.subtext}>Weighted Avg Across All Batches</Text>
          </View>

          {/* Card 3: Comparison Indicator (Above/Below Global) */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>Global Market Variance</Text>
              <View
                style={[
                  styles.iconBox,
                  { backgroundColor: isAbove ? Colors.aboveLight : Colors.belowLight },
                ]}>
                <ChartIcon color={isAbove ? Colors.above : Colors.below} size={20} />
              </View>
            </View>
            
            <View style={styles.comparisonBadgeRow}>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: isAbove ? Colors.aboveLight : Colors.belowLight },
                ]}>
                <Text
                  style={[
                    styles.badgeText,
                    { color: isAbove ? Colors.above : Colors.below },
                  ]}>
                  {isAbove ? '▲ ABOVE GLOBAL' : '▼ BELOW GLOBAL'}
                </Text>
              </View>
            </View>

            <Text style={styles.comparisonValue}>
              {isAbove ? '+' : '-'}Rs. {diff.toFixed(2)}
              <Text style={styles.unitText}> ({percentDiff}%)</Text>
            </Text>
            <Text style={styles.subtext}>Compared to weekly global index</Text>
          </View>

          {/* Card 4: Total Volume */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>Total Production Volume</Text>
              <View style={[styles.iconBox, { backgroundColor: '#FFF7ED' }]}>
                <LeafIcon color="#F97316" size={20} />
              </View>
            </View>
            <Text style={styles.metricValue}>
              {currentReport.totalVolumeKg.toLocaleString()}
              <Text style={styles.unitText}> kg</Text>
            </Text>
            <Text style={styles.subtext}>{bulkSets.length} Created Bulk Batches</Text>
          </View>
        </View>

        {/* Quick Actions Panel */}
        <View style={styles.quickActionsContainer}>
          <Pressable
            style={styles.quickActionButton}
            onPress={() => router.push('/price-input')}>
            <View style={[styles.actionIconCircle, { backgroundColor: '#E0F2FE' }]}>
              <MoneyIcon color="#0284C7" size={18} />
            </View>
            <View style={styles.actionTextGroup}>
              <Text style={styles.actionTitle}>Update Weekly Prices</Text>
              <Text style={styles.actionDesc}>Input grade-wise per kg prices</Text>
            </View>
            <ChevronRightIcon color={Colors.textSecondary} size={16} />
          </Pressable>

          <Pressable
            style={styles.quickActionButton}
            onPress={() => router.push('/bulk-creation')}>
            <View style={[styles.actionIconCircle, { backgroundColor: Colors.primaryLight }]}>
              <PlusIcon color={Colors.primary} size={18} />
            </View>
            <View style={styles.actionTextGroup}>
              <Text style={styles.actionTitle}>Create Bulk Set</Text>
              <Text style={styles.actionDesc}>Combine grades & calculate bulk avg</Text>
            </View>
            <ChevronRightIcon color={Colors.textSecondary} size={16} />
          </Pressable>
        </View>

        {/* Price Trends Line Chart Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Weekly Price Trend Analysis</Text>
              <Text style={styles.sectionSubtitle}>Factory Bulk Average vs. Global Auction Price</Text>
            </View>
            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
                <Text style={styles.legendText}>Factory Bulk Avg</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#3B82F6' }]} />
                <Text style={styles.legendText}>Global Price</Text>
              </View>
            </View>
          </View>

          <WeeklyChart />
        </View>

        {/* Recent Bulk Batches Summary Table */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Recent Bulk Batches</Text>
            <Pressable onPress={() => router.push('/reports')}>
              <Text style={styles.viewAllText}>View All Reports</Text>
            </Pressable>
          </View>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 1.5 }]}>Batch No.</Text>
              <Text style={[styles.th, { flex: 1.2 }]}>Created At</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Volume (kg)</Text>
              <Text style={[styles.th, { flex: 1.2, textAlign: 'right' }]}>Bulk Avg Price</Text>
              <Text style={[styles.th, { flex: 1.2, textAlign: 'center' }]}>vs. Global</Text>
            </View>

            {bulkSets.slice(0, 4).map((set) => (
              <View key={set.id} style={styles.tableRow}>
                <Text style={[styles.tdBold, { flex: 1.5 }]}>{set.batchNumber}</Text>
                <Text style={[styles.tdText, { flex: 1.2 }]}>{set.createdAt}</Text>
                <Text style={[styles.tdText, { flex: 1, textAlign: 'right' }]}>
                  {set.totalQuantityKg.toLocaleString()}
                </Text>
                <Text style={[styles.tdBold, { flex: 1.2, textAlign: 'right' }]}>
                  Rs. {set.bulkAvgPrice.toFixed(2)}
                </Text>
                <View style={[{ flex: 1.2, alignItems: 'center' }]}>
                  <View
                    style={[
                      styles.miniBadge,
                      { backgroundColor: set.isAboveGlobal ? Colors.aboveLight : Colors.belowLight },
                    ]}>
                    <Text
                      style={[
                        styles.miniBadgeText,
                        { color: set.isAboveGlobal ? Colors.above : Colors.below },
                      ]}>
                      {set.isAboveGlobal ? '▲ +' : '▼ '}Rs.{Math.abs(set.comparisonDiff).toFixed(1)}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 20,
    paddingBottom: 40,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  card: {
    flex: 1,
    minWidth: 240,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
  },
  unitText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  subtext: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  comparisonBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  comparisonValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  quickActionButton: {
    flex: 1,
    minWidth: 260,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
  },
  actionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextGroup: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  actionDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    gap: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  chartLegend: {
    flexDirection: 'row',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  table: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  th: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tdBold: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  tdText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  miniBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  miniBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
