import React, { useState } from 'react';
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
import { MoneyIcon, LeafIcon } from '@/components/ui-icons';
import { useTeaStore } from '@/store/tea-store';

export default function PriceInputScreen() {
  const storeGlobalPrice = useTeaStore((s) => s.globalPrice);
  const teaGrades = useTeaStore((s) => s.teaGrades);
  const saveWeeklyPrices = useTeaStore((s) => s.saveWeeklyPrices);

  const [globalPriceInput, setGlobalPriceInput] = useState<string>(storeGlobalPrice.toString());
  
  // Local state for grade prices
  const [gradePrices, setGradePrices] = useState<Record<string, string>>(() => {
    const initialMap: Record<string, string> = {};
    teaGrades.forEach((g) => {
      initialMap[g.id] = g.currentPrice.toString();
    });
    return initialMap;
  });

  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  const handlePriceChange = (gradeId: string, val: string) => {
    setGradePrices((prev) => ({ ...prev, [gradeId]: val }));
  };

  const handleSave = () => {
    const parsedGlobal = parseFloat(globalPriceInput) || 0;
    const parsedGradePrices: Record<string, number> = {};

    Object.keys(gradePrices).forEach((id) => {
      parsedGradePrices[id] = parseFloat(gradePrices[id]) || 0;
    });

    saveWeeklyPrices(parsedGlobal, parsedGradePrices);

    setSaveSuccessMessage('Weekly prices successfully updated and saved!');
    setTimeout(() => {
      setSaveSuccessMessage(null);
    }, 4000);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        greeting="Weekly Price Input"
        subTitle="Set weekly market benchmark & grade-wise per kg prices"
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Global Average Price Form */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
              <MoneyIcon color="#2563EB" size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Global Average Price Form</Text>
              <Text style={styles.cardSubtitle}>
                Enter the weekly global tea auction benchmark price (Rs / kg)
              </Text>
            </View>
          </View>

          <View style={styles.formRow}>
            <Text style={styles.inputLabel}>Global Average Price (Rs/kg):</Text>
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

        {/* Grade Price Table */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconBox, { backgroundColor: Colors.primaryLight }]}>
              <LeafIcon color={Colors.primary} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Tea Grade Prices (per kg)</Text>
              <Text style={styles.cardSubtitle}>
                Update current market prices for factory tea grades
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
                      value={gradePrices[grade.id] || ''}
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
              <Text style={styles.saveButtonText}>Save Weekly Prices</Text>
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
