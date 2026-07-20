import React, { useState, useMemo } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  Pressable,
} from 'react-native';
import { Colors } from '@/constants/colors';
import Header from '@/components/header';
import { ChartIcon, LeafIcon } from '@/components/ui-icons';
import { useTeaStore, WeeklyReport } from '@/store/tea-store';

export default function ReportsScreen() {
  const weeklyReports = useTeaStore((s) => s.weeklyReports);
  const teaGrades = useTeaStore((s) => s.teaGrades);
  const factories = useTeaStore((s) => s.factories);
  const selectedFactoryId = useTeaStore((s) => s.selectedFactoryId);
  const setSelectedFactoryId = useTeaStore((s) => s.setSelectedFactoryId);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'above' | 'below'>('all');
  const [selectedReportId, setSelectedReportId] = useState<string>('w29');

  const filteredReports = useMemo(() => {
    return weeklyReports.filter((report) => {
      const matchesSearch =
        report.weekName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.dateRange.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (filterStatus === 'above') return report.isAbove;
      if (filterStatus === 'below') return !report.isAbove;
      return true;
    });
  }, [weeklyReports, searchQuery, filterStatus]);

  const activeReport = weeklyReports.find((r) => r.id === selectedReportId) || weeklyReports[0];

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        greeting="Reports & Multi-Factory Analytics"
        subTitle="Historical weekly performance, multi-factory average prices, and grade breakdowns"
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Filters Toolbar & Search Row */}
        <View style={styles.filterCard}>
          <View style={styles.filterRow}>
            {/* Search Box */}
            <View style={styles.searchBox}>
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search week (e.g. Week 29, Jul...)"
                placeholderTextColor={Colors.textSecondary}
              />
            </View>

            {/* Status Segmented Filters */}
            <View style={styles.filterPills}>
              <Pressable
                style={[
                  styles.pill,
                  filterStatus === 'all' && styles.pillActive,
                ]}
                onPress={() => setFilterStatus('all')}>
                <Text
                  style={[
                    styles.pillText,
                    filterStatus === 'all' && styles.pillTextActive,
                  ]}>
                  All Weeks
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.pill,
                  filterStatus === 'above' && styles.pillActive,
                ]}
                onPress={() => setFilterStatus('above')}>
                <Text
                  style={[
                    styles.pillText,
                    filterStatus === 'above' && styles.pillTextActive,
                  ]}>
                  Above Global
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.pill,
                  filterStatus === 'below' && styles.pillActive,
                ]}
                onPress={() => setFilterStatus('below')}>
                <Text
                  style={[
                    styles.pillText,
                    filterStatus === 'below' && styles.pillTextActive,
                  ]}>
                  Below Global
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Table 1: Multi-Factory Weekly Performance Breakdown for Current/Selected Week */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconBox, { backgroundColor: Colors.primaryLight }]}>
              <ChartIcon color={Colors.primary} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>
                {activeReport.weekName} • Factory Average Prices Breakdown
              </Text>
              <Text style={styles.cardSubtitle}>
                Individual calculated average prices per tea factory vs global benchmark (Rs. {activeReport.globalPrice}/kg)
              </Text>
            </View>
          </View>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 1.2 }]}>Code</Text>
              <Text style={[styles.th, { flex: 2 }]}>Factory Name</Text>
              <Text style={[styles.th, { flex: 1.5, textAlign: 'right' }]}>Weekly Avg Price</Text>
              <Text style={[styles.th, { flex: 1.5, textAlign: 'right' }]}>Volume (kg)</Text>
              <Text style={[styles.th, { flex: 1.8, textAlign: 'center' }]}>vs. Global Benchmark</Text>
            </View>

            {factories.map((fac) => {
              const fBreakdown = activeReport.factoryBreakdown?.find((b) => b.factoryId === fac.id);
              const avgPrice = fBreakdown ? fBreakdown.avgPrice : fac.weeklyAvgPrice;
              const diffVal = avgPrice - activeReport.globalPrice;
              const isAbove = diffVal >= 0;

              return (
                <View key={fac.id} style={styles.tableRow}>
                  <Text style={[styles.tdBold, { flex: 1.2, color: Colors.primary }]}>
                    {fac.code}
                  </Text>

                  <View style={{ flex: 2 }}>
                    <Text style={styles.tdBold}>{fac.name}</Text>
                    <Text style={styles.dateSub}>{fac.location}</Text>
                  </View>

                  <Text style={[styles.tdBold, { flex: 1.5, textAlign: 'right' }]}>
                    Rs. {avgPrice.toFixed(2)}
                  </Text>

                  <Text style={[styles.tdText, { flex: 1.5, textAlign: 'right' }]}>
                    {fac.totalVolumeKg.toLocaleString()}
                  </Text>

                  <View style={{ flex: 1.8, alignItems: 'center' }}>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: isAbove ? Colors.aboveLight : Colors.belowLight },
                      ]}>
                      <Text
                        style={[
                          styles.statusBadgeText,
                          { color: isAbove ? Colors.above : Colors.below },
                        ]}>
                        {isAbove ? '▲ +' : '▼ '}Rs. {Math.abs(diffVal).toFixed(1)} / kg
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Table 2: Past Weeks Historical Overview */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
              <ChartIcon color="#2563EB" size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Historical Weekly Performance Summary</Text>
              <Text style={styles.cardSubtitle}>
                Historical record of weekly global auction benchmarks & combined multi-factory bulk averages
              </Text>
            </View>
          </View>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 2 }]}>Week / Dates</Text>
              <Text style={[styles.th, { flex: 1.5, textAlign: 'right' }]}>Global Benchmark</Text>
              <Text style={[styles.th, { flex: 1.5, textAlign: 'right' }]}>All-Factory Bulk Avg</Text>
              <Text style={[styles.th, { flex: 1.2, textAlign: 'right' }]}>Total Vol (kg)</Text>
              <Text style={[styles.th, { flex: 1.8, textAlign: 'center' }]}>vs. Global Market</Text>
            </View>

            {filteredReports.map((rep: WeeklyReport) => (
              <Pressable
                key={rep.id}
                style={[styles.tableRow, rep.id === selectedReportId && { backgroundColor: '#F8FAFC' }]}
                onPress={() => setSelectedReportId(rep.id)}>
                <View style={{ flex: 2 }}>
                  <Text style={styles.weekTitle}>{rep.weekName}</Text>
                  <Text style={styles.dateSub}>{rep.dateRange}</Text>
                </View>

                <Text style={[styles.tdText, { flex: 1.5, textAlign: 'right' }]}>
                  Rs. {rep.globalPrice.toFixed(2)}
                </Text>

                <Text style={[styles.tdBold, { flex: 1.5, textAlign: 'right' }]}>
                  Rs. {rep.factoryBulkAvg.toFixed(2)}
                </Text>

                <Text style={[styles.tdText, { flex: 1.2, textAlign: 'right' }]}>
                  {rep.totalVolumeKg.toLocaleString()}
                </Text>

                <View style={{ flex: 1.8, alignItems: 'center' }}>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: rep.isAbove ? Colors.aboveLight : Colors.belowLight },
                    ]}>
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: rep.isAbove ? Colors.above : Colors.below },
                      ]}>
                      {rep.isAbove ? '▲ +' : '▼ '}Rs. {Math.abs(rep.comparisonDiff).toFixed(1)} / kg
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Table 3: Factory-wise Average Prices per Tea Item */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconBox, { backgroundColor: Colors.primaryLight }]}>
              <LeafIcon color={Colors.primary} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Average Prices per Tea Item Across Factories</Text>
              <Text style={styles.cardSubtitle}>
                Side-by-side comparison of grade prices across registered tea factories
              </Text>
            </View>
          </View>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 1.8 }]}>Tea Item Name</Text>
              <Text style={[styles.th, { flex: 1.2 }]}>Category</Text>
              {factories.map((fac) => (
                <Text key={fac.id} style={[styles.th, { flex: 1.5, textAlign: 'right' }]}>
                  {fac.code} (Rs/kg)
                </Text>
              ))}
            </View>

            {teaGrades.map((grade) => (
              <View key={grade.id} style={styles.tableRow}>
                <View style={{ flex: 1.8 }}>
                  <Text style={styles.gradeTitle}>{grade.name}</Text>
                </View>

                <View style={{ flex: 1.2 }}>
                  <Text style={styles.categoryBadge}>{grade.category}</Text>
                </View>

                {factories.map((fac) => {
                  const price = fac.gradePrices[grade.id] !== undefined ? fac.gradePrices[grade.id] : grade.currentPrice;
                  return (
                    <Text key={fac.id} style={[styles.tdBold, { flex: 1.5, textAlign: 'right' }]}>
                      Rs. {price.toFixed(2)}
                    </Text>
                  );
                })}
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
  filterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  searchBox: {
    flex: 1,
    minWidth: 240,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchInput: {
    paddingVertical: 8,
    fontSize: 14,
    color: Colors.text,
  },
  filterPills: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 3,
    gap: 2,
  },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  pillActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  pillTextActive: {
    fontWeight: '700',
    color: Colors.primary,
  },
  card: {
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
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  cardSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
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
    paddingVertical: 12,
    paddingHorizontal: 14,
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
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  weekTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  dateSub: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  tdText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  tdBold: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  gradeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  categoryBadge: {
    fontSize: 11,
    color: Colors.textSecondary,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
});
