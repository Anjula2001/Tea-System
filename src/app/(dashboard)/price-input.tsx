import React, { useState, useEffect } from 'react';
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
import { MoneyIcon, LeafIcon, PlusIcon, ChartIcon } from '@/components/ui-icons';
import { useTeaStore } from '@/store/tea-store';

export default function PriceInputScreen() {
  const storeGlobalPrice = useTeaStore((s) => s.globalPrice);
  const factories = useTeaStore((s) => s.factories);
  const selectedFactoryId = useTeaStore((s) => s.selectedFactoryId);
  const setSelectedFactoryId = useTeaStore((s) => s.setSelectedFactoryId);
  const addFactory = useTeaStore((s) => s.addFactory);
  const teaGrades = useTeaStore((s) => s.teaGrades);
  const saveWeeklyPrices = useTeaStore((s) => s.saveWeeklyPrices);
  const calculateOverallFactoryAvg = useTeaStore((s) => s.calculateOverallFactoryAvg);

  const activeFactory = factories.find((f) => f.id === selectedFactoryId) || factories[0];

  const [globalPriceInput, setGlobalPriceInput] = useState<string>(storeGlobalPrice.toString());
  
  // Local state for grade prices of the active factory
  const [gradePrices, setGradePrices] = useState<Record<string, string>>({});

  // Form state for adding a new factory
  const [showAddFactory, setShowAddFactory] = useState<boolean>(false);
  const [newFactoryName, setNewFactoryName] = useState<string>('');
  const [newFactoryLocation, setNewFactoryLocation] = useState<string>('');
  const [newFactoryCode, setNewFactoryCode] = useState<string>('');

  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Sync grade prices state when active factory or teaGrades change
  useEffect(() => {
    const initialMap: Record<string, string> = {};
    teaGrades.forEach((g) => {
      initialMap[g.id] = g.currentPrice.toString();
    });
    setGradePrices(initialMap);
  }, [selectedFactoryId, teaGrades]);

  const handlePriceChange = (gradeId: string, val: string) => {
    setGradePrices((prev) => ({ ...prev, [gradeId]: val }));
  };

  // Live calculation of selected factory's weekly average price
  const calculatedActiveFactoryAvg = React.useMemo(() => {
    const vals = Object.values(gradePrices)
      .map((v) => parseFloat(v) || 0)
      .filter((v) => v > 0);
    if (vals.length === 0) return 0;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }, [gradePrices]);

  const overallAvg = calculateOverallFactoryAvg();
  const parsedGlobal = parseFloat(globalPriceInput) || 0;
  const activeDiff = calculatedActiveFactoryAvg - parsedGlobal;
  const isActiveAbove = activeDiff >= 0;

  const handleSave = () => {
    const parsedGradePrices: Record<string, number> = {};

    Object.keys(gradePrices).forEach((id) => {
      parsedGradePrices[id] = parseFloat(gradePrices[id]) || 0;
    });

    saveWeeklyPrices(parsedGlobal, parsedGradePrices, activeFactory.id);

    setSaveSuccessMessage(`Weekly prices for "${activeFactory.name}" successfully updated & calculated!`);
    setTimeout(() => {
      setSaveSuccessMessage(null);
    }, 4000);
  };

  const handleAddFactorySubmit = () => {
    if (!newFactoryName.trim()) {
      alert('Please enter a factory name');
      return;
    }
    addFactory(newFactoryName, newFactoryLocation, newFactoryCode);
    setNewFactoryName('');
    setNewFactoryLocation('');
    setNewFactoryCode('');
    setShowAddFactory(false);
    setSaveSuccessMessage('New tea factory successfully registered!');
    setTimeout(() => setSaveSuccessMessage(null), 3000);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        greeting="Weekly Price Input"
        subTitle="Manage multi-factory weekly prices & calculate average prices per factory"
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Factory Selector Bar */}
        <View style={styles.factorySelectorCard}>
          <View style={styles.selectorHeader}>
            <Text style={styles.selectorTitle}>Select Tea Factory</Text>
            <Pressable
              style={styles.addFactoryButton}
              onPress={() => setShowAddFactory(!showAddFactory)}>
              <PlusIcon color={Colors.primary} size={16} />
              <Text style={styles.addFactoryText}>
                {showAddFactory ? 'Cancel' : 'Add Factory'}
              </Text>
            </Pressable>
          </View>

          {/* Add Factory Inline Form */}
          {showAddFactory && (
            <View style={styles.addFactoryForm}>
              <Text style={styles.formSectionTitle}>Register New Tea Factory</Text>
              <View style={styles.addFactoryRow}>
                <View style={{ flex: 2 }}>
                  <Text style={styles.miniLabel}>Factory Name *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newFactoryName}
                    onChangeText={setNewFactoryName}
                    placeholder="e.g. Ceylon Highland Estate"
                    placeholderTextColor={Colors.textSecondary}
                  />
                </View>
                <View style={{ flex: 1.5 }}>
                  <Text style={styles.miniLabel}>Location</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newFactoryLocation}
                    onChangeText={setNewFactoryLocation}
                    placeholder="e.g. Ella"
                    placeholderTextColor={Colors.textSecondary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.miniLabel}>Code</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newFactoryCode}
                    onChangeText={setNewFactoryCode}
                    placeholder="CH-01"
                    placeholderTextColor={Colors.textSecondary}
                  />
                </View>
                <View style={{ justifyContent: 'flex-end' }}>
                  <Pressable style={styles.submitFactoryBtn} onPress={handleAddFactorySubmit}>
                    <Text style={styles.submitFactoryBtnText}>Save</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.factoryPillsScroll}>
            <View style={styles.factoryPillsContainer}>
              {factories.map((fac) => {
                const isSelected = fac.id === selectedFactoryId;
                return (
                  <Pressable
                    key={fac.id}
                    style={[styles.factoryPill, isSelected && styles.factoryPillActive]}
                    onPress={() => setSelectedFactoryId(fac.id)}>
                    <Text style={[styles.factoryCode, isSelected && styles.factoryCodeActive]}>
                      {fac.code}
                    </Text>
                    <Text style={[styles.factoryPillName, isSelected && styles.factoryPillNameActive]}>
                      {fac.name}
                    </Text>
                    <View style={[styles.avgTag, isSelected && styles.avgTagActive]}>
                      <Text style={[styles.avgTagText, isSelected && styles.avgTagTextActive]}>
                        Rs. {fac.weeklyAvgPrice}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Live Multi-Factory Calculation Summary Banner */}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryBoxLabel}>Active Factory Avg</Text>
            <Text style={styles.summaryBoxValue}>
              Rs. {calculatedActiveFactoryAvg.toLocaleString()} <Text style={styles.unitText}>/ kg</Text>
            </Text>
            <Text style={styles.summaryBoxSub}>{activeFactory.name}</Text>
          </View>

          <View style={styles.summaryBox}>
            <Text style={styles.summaryBoxLabel}>Overall All-Factory Avg</Text>
            <Text style={styles.summaryBoxValue}>
              Rs. {overallAvg.toLocaleString()} <Text style={styles.unitText}>/ kg</Text>
            </Text>
            <Text style={styles.summaryBoxSub}>Weighted across {factories.length} factories</Text>
          </View>

          <View style={styles.summaryBox}>
            <Text style={styles.summaryBoxLabel}>Variance vs Global</Text>
            <View style={styles.badgeRow}>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: isActiveAbove ? Colors.aboveLight : Colors.belowLight },
                ]}>
                <Text
                  style={[
                    styles.badgeText,
                    { color: isActiveAbove ? Colors.above : Colors.below },
                  ]}>
                  {isActiveAbove ? '▲ ABOVE' : '▼ BELOW'}
                </Text>
              </View>
              <Text
                style={[
                  styles.diffValText,
                  { color: isActiveAbove ? Colors.above : Colors.below },
                ]}>
                {isActiveAbove ? '+' : ''}Rs. {activeDiff.toFixed(1)}
              </Text>
            </View>
            <Text style={styles.summaryBoxSub}>Benchmark: Rs. {parsedGlobal}</Text>
          </View>
        </View>

        {/* Global Average Price Form */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
              <MoneyIcon color="#2563EB" size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Global Auction Benchmark Price</Text>
              <Text style={styles.cardSubtitle}>
                Set the weekly global market benchmark price (Rs / kg)
              </Text>
            </View>
          </View>

          <View style={styles.formRow}>
            <Text style={styles.inputLabel}>Global Benchmark Price (Rs/kg):</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.currencyPrefix}>Rs.</Text>
              <TextInput
                style={styles.textInput}
                value={globalPriceInput}
                onChangeText={setGlobalPriceInput}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor={Colors.textSecondary}
              />
            </View>
          </View>
        </View>

        {/* Success Feedback Banner */}
        {saveSuccessMessage && (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>✓ {saveSuccessMessage}</Text>
          </View>
        )}

        {/* Grade Price Table for Selected Factory */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconBox, { backgroundColor: Colors.primaryLight }]}>
              <LeafIcon color={Colors.primary} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>
                {activeFactory.name} • Grade Prices
              </Text>
              <Text style={styles.cardSubtitle}>
                Update current market prices per kg for this factory to calculate its weekly average price properly
              </Text>
            </View>
          </View>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 2 }]}>Tea Item Name</Text>
              <Text style={[styles.th, { flex: 1.5 }]}>Category</Text>
              <Text style={[styles.th, { flex: 2, textAlign: 'right' }]}>Price per kg (Rs)</Text>
            </View>

            {teaGrades.map((grade) => (
              <View key={grade.id} style={styles.tableRow}>
                <View style={{ flex: 2 }}>
                  <Text style={styles.gradeName}>{grade.name}</Text>
                </View>
                
                <View style={{ flex: 1.5 }}>
                  <Text style={styles.categoryTag}>{grade.category}</Text>
                </View>

                <View style={{ flex: 2, alignItems: 'flex-end' }}>
                  <View style={styles.tableInputWrapper}>
                    <Text style={styles.tableCurrency}>Rs.</Text>
                    <TextInput
                      style={styles.tableInput}
                      value={gradePrices[grade.id] !== undefined ? gradePrices[grade.id] : grade.currentPrice.toString()}
                      onChangeText={(val) => handlePriceChange(grade.id, val)}
                      keyboardType="numeric"
                      placeholder="0.00"
                      placeholderTextColor={Colors.textSecondary}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Clear Call-To-Action Save Button */}
          <View style={styles.actionRow}>
            <Pressable style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>
                Save & Calculate Avg for {activeFactory.code}
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
  factorySelectorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
  },
  selectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addFactoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  addFactoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  addFactoryForm: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  formSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  addFactoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'flex-end',
  },
  miniLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  formInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: Colors.text,
  },
  submitFactoryBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  submitFactoryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  factoryPillsScroll: {
    flexGrow: 0,
  },
  factoryPillsContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  factoryPill: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 4,
    minWidth: 160,
  },
  factoryPillActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  factoryCode: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  factoryCodeActive: {
    color: Colors.primary,
  },
  factoryPillName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  factoryPillNameActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  avgTag: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  avgTagActive: {
    backgroundColor: Colors.primary,
  },
  avgTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text,
  },
  avgTagTextActive: {
    color: '#FFFFFF',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryBox: {
    flex: 1,
    minWidth: 180,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  summaryBoxLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  summaryBoxValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  unitText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  summaryBoxSub: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  diffValText: {
    fontSize: 13,
    fontWeight: '700',
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
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    width: 220,
  },
  currencyPrefix: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginRight: 6,
  },
  textInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
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
    fontSize: 12,
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
  categoryTag: {
    fontSize: 12,
    color: Colors.textSecondary,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  tableInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    width: 130,
  },
  tableCurrency: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginRight: 4,
  },
  tableInput: {
    flex: 1,
    paddingVertical: 6,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'right',
  },
  actionRow: {
    alignItems: 'flex-end',
    paddingTop: 8,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
