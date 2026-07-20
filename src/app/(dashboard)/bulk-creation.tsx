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
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import Header from '@/components/header';
import { LeafIcon, PlusIcon, ChartIcon } from '@/components/ui-icons';
import { useTeaStore } from '@/store/tea-store';

export default function BulkCreationScreen() {
  const router = useRouter();
  const factories = useTeaStore((s) => s.factories);
  const selectedFactoryId = useTeaStore((s) => s.selectedFactoryId);
  const setSelectedFactoryId = useTeaStore((s) => s.setSelectedFactoryId);
  const teaGrades = useTeaStore((s) => s.teaGrades);
  const globalPrice = useTeaStore((s) => s.globalPrice);
  const calculateBulkMetrics = useTeaStore((s) => s.calculateBulkMetrics);
  const addBulkSet = useTeaStore((s) => s.addBulkSet);

  const activeFactory = factories.find((f) => f.id === selectedFactoryId) || factories[0];

  const [batchName, setBatchName] = useState<string>(`BATCH-${activeFactory.code}-${Date.now().toString().slice(-4)}`);
  const [quantities, setQuantities] = useState<Record<string, string>>({
    'op1-34': '4000',
    'pekoe-36': '3000',
    'bopf': '2500',
  });

  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const handleQtyChange = (gradeId: string, val: string) => {
    setQuantities((prev) => ({ ...prev, [gradeId]: val }));
  };

  const selectedItems = useMemo(() => {
    return Object.entries(quantities).map(([gradeId, qtyStr]) => ({
      gradeId,
      quantityKg: parseFloat(qtyStr) || 0,
    }));
  }, [quantities]);

  const metrics = useMemo(() => {
    return calculateBulkMetrics(selectedItems, activeFactory.id);
  }, [selectedItems, activeFactory.id, calculateBulkMetrics]);

  const handleCreateBulkSet = () => {
    if (metrics.totalQuantityKg === 0) {
      alert('Please enter a quantity for at least one tea grade.');
      return;
    }

    const created = addBulkSet(batchName, selectedItems, activeFactory.id);
    if (created) {
      setSuccessBanner(`Bulk Set "${created.batchNumber}" created for ${activeFactory.name}!`);
      setTimeout(() => {
        setSuccessBanner(null);
        router.push('/reports');
      }, 1500);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        greeting="Bulk Set Creation"
        subTitle="Select factory, tea grades, and calculate factory bulk average price"
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Factory Selection Card */}
        <View style={styles.card}>
          <Text style={styles.inputLabel}>Select Processing Factory:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.factoryPillsRow}>
              {factories.map((fac) => {
                const isSelected = fac.id === selectedFactoryId;
                return (
                  <Pressable
                    key={fac.id}
                    style={[styles.factoryPill, isSelected && styles.factoryPillActive]}
                    onPress={() => {
                      setSelectedFactoryId(fac.id);
                      setBatchName(`BATCH-${fac.code}-${Date.now().toString().slice(-4)}`);
                    }}>
                    <Text style={[styles.factoryCode, isSelected && styles.factoryCodeActive]}>
                      {fac.code}
                    </Text>
                    <Text style={[styles.factoryName, isSelected && styles.factoryNameActive]}>
                      {fac.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Real-time Calculation Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconBox, { backgroundColor: Colors.primaryLight }]}>
              <ChartIcon color={Colors.primary} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryTitle}>
                {activeFactory.name} • Analytics
              </Text>
              <Text style={styles.summarySubtitle}>
                Live calculated metrics using {activeFactory.code} grade pricing
              </Text>
            </View>
          </View>

          <View style={styles.metricsGrid}>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Total Quantity</Text>
              <Text style={styles.metricValue}>
                {metrics.totalQuantityKg.toLocaleString()}
                <Text style={styles.metricUnit}> kg</Text>
              </Text>
            </View>

            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Calculated Bulk Avg Price</Text>
              <Text style={styles.metricValue}>
                Rs. {metrics.bulkAvgPrice.toFixed(2)}
                <Text style={styles.metricUnit}> / kg</Text>
              </Text>
            </View>

            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Global Benchmark Price</Text>
              <Text style={styles.metricValue}>
                Rs. {globalPrice.toFixed(2)}
                <Text style={styles.metricUnit}> / kg</Text>
              </Text>
            </View>

            {/* Comparison Indicator */}
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Market Variance</Text>
              <View style={styles.comparisonRow}>
                <View
                  style={[
                    styles.indicatorBadge,
                    {
                      backgroundColor: metrics.isAboveGlobal
                        ? Colors.aboveLight
                        : Colors.belowLight,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.indicatorBadgeText,
                      { color: metrics.isAboveGlobal ? Colors.above : Colors.below },
                    ]}>
                    {metrics.isAboveGlobal ? '▲ ABOVE GLOBAL' : '▼ BELOW GLOBAL'}
                  </Text>
                </View>

                <Text
                  style={[
                    styles.diffText,
                    { color: metrics.isAboveGlobal ? Colors.above : Colors.below },
                  ]}>
                  {metrics.isAboveGlobal ? '+' : ''}Rs. {metrics.comparisonDiff.toFixed(2)} / kg
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Success Banner */}
        {successBanner && (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>✓ {successBanner}</Text>
          </View>
        )}

        {/* Batch Meta & Grade Selection Card */}
        <View style={styles.card}>
          <View style={styles.formRow}>
            <Text style={styles.inputLabel}>Batch Identification Name:</Text>
            <TextInput
              style={styles.batchNameInput}
              value={batchName}
              onChangeText={setBatchName}
              placeholder="e.g. BATCH-GV-04-07C"
              placeholderTextColor={Colors.textSecondary}
            />
          </View>

          <Text style={styles.sectionHeading}>
            {activeFactory.code} Tea Items & Quantities (kg)
          </Text>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 2 }]}>Tea Item Name</Text>
              <Text style={[styles.th, { flex: 1.5, textAlign: 'right' }]}>Factory Price (Rs/kg)</Text>
              <Text style={[styles.th, { flex: 2, textAlign: 'center' }]}>Quantity (kg)</Text>
              <Text style={[styles.th, { flex: 2, textAlign: 'right' }]}>Total Value (Rs)</Text>
            </View>

            {teaGrades.map((grade) => {
              const qtyVal = parseFloat(quantities[grade.id] || '0') || 0;
              const totalGradeValue = qtyVal * grade.currentPrice;

              return (
                <View key={grade.id} style={styles.tableRow}>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.gradeName}>{grade.name}</Text>
                    <Text style={styles.gradeCategory}>{grade.category}</Text>
                  </View>

                  <Text style={[styles.tdText, { flex: 1.5, textAlign: 'right' }]}>
                    Rs. {grade.currentPrice.toFixed(2)}
                  </Text>

                  <View style={{ flex: 2, alignItems: 'center' }}>
                    <View style={styles.qtyInputWrapper}>
                      <TextInput
                        style={styles.qtyInput}
                        value={quantities[grade.id] || ''}
                        onChangeText={(val) => handleQtyChange(grade.id, val)}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={Colors.textSecondary}
                      />
                      <Text style={styles.unitSuffix}>kg</Text>
                    </View>
                  </View>

                  <Text style={[styles.tdBold, { flex: 2, textAlign: 'right' }]}>
                    {totalGradeValue > 0 ? `Rs. ${totalGradeValue.toLocaleString()}` : '-'}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* CTA Create Bulk Set Button */}
          <View style={styles.actionRow}>
            <Pressable style={styles.createButton} onPress={handleCreateBulkSet}>
              <PlusIcon color="#FFFFFF" size={18} />
              <Text style={styles.createButtonText}>
                Create Bulk Set for {activeFactory.code}
              </Text>
            </Pressable>
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
  factoryPillsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 4,
  },
  factoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  factoryPillActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  factoryCode: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  factoryCodeActive: {
    color: Colors.primary,
  },
  factoryName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  factoryNameActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  summaryCard: {
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
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  summarySubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
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
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 4,
  },
  metricBox: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  metricUnit: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  indicatorBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  indicatorBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  diffText: {
    fontSize: 14,
    fontWeight: '700',
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  batchNameInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    width: 220,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 8,
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
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  gradeName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  gradeCategory: {
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
  qtyInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    width: 100,
  },
  qtyInput: {
    flex: 1,
    paddingVertical: 6,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'right',
  },
  unitSuffix: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  actionRow: {
    alignItems: 'flex-end',
    paddingTop: 8,
  },
  createButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  successBanner: {
    backgroundColor: Colors.aboveLight,
    borderWidth: 1,
    borderColor: Colors.above,
    borderRadius: 10,
    padding: 14,
  },
  successText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.above,
  },
});
