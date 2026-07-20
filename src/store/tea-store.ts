import { create } from 'zustand';

export interface TeaGrade {
  id: string;
  name: string;
  category: string;
  currentPrice: number;
}

export interface Factory {
  id: string;
  name: string;
  location: string;
  code: string;
  weeklyAvgPrice: number;
  totalVolumeKg: number;
  gradePrices: Record<string, number>;
}

export interface FactoryWeeklyStat {
  factoryId: string;
  factoryName: string;
  avgPrice: number;
  totalVolumeKg: number;
  comparisonDiff: number;
  isAbove: boolean;
}

export interface BulkItem {
  gradeId: string;
  gradeName: string;
  quantityKg: number;
  unitPrice: number;
  totalPrice: number;
}

export interface BulkSet {
  id: string;
  batchNumber: string;
  factoryId: string;
  factoryName: string;
  createdAt: string;
  items: BulkItem[];
  totalQuantityKg: number;
  bulkAvgPrice: number;
  globalPriceAtCreation: number;
  comparisonDiff: number; // bulkAvgPrice - globalPriceAtCreation
  isAboveGlobal: boolean;
}

export interface WeeklyReport {
  id: string;
  weekName: string;
  dateRange: string;
  globalPrice: number;
  factoryBulkAvg: number;
  totalVolumeKg: number;
  comparisonDiff: number;
  isAbove: boolean;
  status: 'Completed' | 'Active';
  factoryBreakdown?: FactoryWeeklyStat[];
}

export interface WeeklyTrendPoint {
  week: string;
  globalPrice: number;
  factoryBulkAvg: number;
  factoryAverages?: Record<string, number>;
}

interface TeaStoreState {
  globalPrice: number; // Weekly Global Tea Auction Price (Rs / kg)
  factories: Factory[];
  selectedFactoryId: string;
  teaGrades: TeaGrade[];
  bulkSets: BulkSet[];
  weeklyReports: WeeklyReport[];
  weeklyTrends: WeeklyTrendPoint[];
  
  // Actions
  setSelectedFactoryId: (id: string) => void;
  addFactory: (name: string, location: string, code: string) => void;
  setGlobalPrice: (price: number) => void;
  updateGradePrice: (gradeId: string, price: number, factoryId?: string) => void;
  saveWeeklyPrices: (globalPrice: number, updatedPrices: Record<string, number>, targetFactoryId?: string) => void;
  calculateFactoryAvg: (factoryId: string) => number;
  calculateOverallFactoryAvg: () => number;
  calculateBulkMetrics: (selectedItems: { gradeId: string; quantityKg: number }[], factoryId?: string) => {
    totalQuantityKg: number;
    bulkAvgPrice: number;
    comparisonDiff: number;
    isAboveGlobal: boolean;
    breakdown: BulkItem[];
  };
  addBulkSet: (batchName: string, selectedItems: { gradeId: string; quantityKg: number }[], factoryId?: string) => BulkSet | null;
}

const INITIAL_TEA_GRADES_BASE = [
  { id: 'op1-34', name: 'Op1-34', category: 'Whole Leaf', basePrice: 1520 },
  { id: 'pekoe-36', name: 'Pekoe-36', category: 'Pekoe', basePrice: 1480 },
  { id: 'bopf', name: 'BOPF', category: 'Fannings', basePrice: 1390 },
  { id: 'dust-1', name: 'Dust-1', category: 'Dust', basePrice: 1250 },
  { id: 'fbop1', name: 'FBOP1', category: 'Flowery Leaf', basePrice: 1610 },
  { id: 'bop', name: 'BOP', category: 'Broken Leaf', basePrice: 1420 },
  { id: 'pekoe-1', name: 'Pekoe-1', category: 'Pekoe', basePrice: 1550 },
  { id: 'bp', name: 'BP', category: 'Broken Pekoe', basePrice: 1310 },
];

const INITIAL_FACTORIES: Factory[] = [
  {
    id: 'f1',
    name: 'Green Valley Plantation #4',
    location: 'Nuwara Eliya',
    code: 'GV-04',
    weeklyAvgPrice: 1492,
    totalVolumeKg: 18400,
    gradePrices: {
      'op1-34': 1520,
      'pekoe-36': 1480,
      'bopf': 1390,
      'dust-1': 1250,
      'fbop1': 1610,
      'bop': 1420,
      'pekoe-1': 1550,
      'bp': 1310,
    },
  },
  {
    id: 'f2',
    name: 'Highland Estates #1',
    location: 'Kandy',
    code: 'HE-01',
    weeklyAvgPrice: 1460,
    totalVolumeKg: 15200,
    gradePrices: {
      'op1-34': 1490,
      'pekoe-36': 1450,
      'bopf': 1360,
      'dust-1': 1220,
      'fbop1': 1580,
      'bop': 1390,
      'pekoe-1': 1510,
      'bp': 1280,
    },
  },
  {
    id: 'f3',
    name: 'Mountain Peak Factory #2',
    location: 'Dimbula',
    code: 'MP-02',
    weeklyAvgPrice: 1515,
    totalVolumeKg: 12800,
    gradePrices: {
      'op1-34': 1550,
      'pekoe-36': 1510,
      'bopf': 1420,
      'dust-1': 1270,
      'fbop1': 1640,
      'bop': 1450,
      'pekoe-1': 1580,
      'bp': 1330,
    },
  },
];

const INITIAL_REPORTS: WeeklyReport[] = [
  {
    id: 'w29',
    weekName: 'Week 29 (Current)',
    dateRange: 'Jul 14 - Jul 20, 2026',
    globalPrice: 1450,
    factoryBulkAvg: 1488,
    totalVolumeKg: 46400,
    comparisonDiff: 38,
    isAbove: true,
    status: 'Active',
    factoryBreakdown: [
      { factoryId: 'f1', factoryName: 'Green Valley Plantation #4', avgPrice: 1492, totalVolumeKg: 18400, comparisonDiff: 42, isAbove: true },
      { factoryId: 'f2', factoryName: 'Highland Estates #1', avgPrice: 1460, totalVolumeKg: 15200, comparisonDiff: 10, isAbove: true },
      { factoryId: 'f3', factoryName: 'Mountain Peak Factory #2', avgPrice: 1515, totalVolumeKg: 12800, comparisonDiff: 65, isAbove: true },
    ],
  },
  {
    id: 'w28',
    weekName: 'Week 28',
    dateRange: 'Jul 07 - Jul 13, 2026',
    globalPrice: 1440,
    factoryBulkAvg: 1475,
    totalVolumeKg: 44200,
    comparisonDiff: 35,
    isAbove: true,
    status: 'Completed',
    factoryBreakdown: [
      { factoryId: 'f1', factoryName: 'Green Valley Plantation #4', avgPrice: 1475, totalVolumeKg: 17500, comparisonDiff: 35, isAbove: true },
      { factoryId: 'f2', factoryName: 'Highland Estates #1', avgPrice: 1450, totalVolumeKg: 14700, comparisonDiff: 10, isAbove: true },
      { factoryId: 'f3', factoryName: 'Mountain Peak Factory #2', avgPrice: 1500, totalVolumeKg: 12000, comparisonDiff: 60, isAbove: true },
    ],
  },
  {
    id: 'w27',
    weekName: 'Week 27',
    dateRange: 'Jun 30 - Jul 06, 2026',
    globalPrice: 1465,
    factoryBulkAvg: 1450,
    totalVolumeKg: 41000,
    comparisonDiff: -15,
    isAbove: false,
    status: 'Completed',
    factoryBreakdown: [
      { factoryId: 'f1', factoryName: 'Green Valley Plantation #4', avgPrice: 1450, totalVolumeKg: 16000, comparisonDiff: -15, isAbove: false },
      { factoryId: 'f2', factoryName: 'Highland Estates #1', avgPrice: 1430, totalVolumeKg: 14000, comparisonDiff: -35, isAbove: false },
      { factoryId: 'f3', factoryName: 'Mountain Peak Factory #2', avgPrice: 1475, totalVolumeKg: 11000, comparisonDiff: 10, isAbove: true },
    ],
  },
  {
    id: 'w26',
    weekName: 'Week 26',
    dateRange: 'Jun 23 - Jun 29, 2026',
    globalPrice: 1420,
    factoryBulkAvg: 1460,
    totalVolumeKg: 43000,
    comparisonDiff: 40,
    isAbove: true,
    status: 'Completed',
    factoryBreakdown: [
      { factoryId: 'f1', factoryName: 'Green Valley Plantation #4', avgPrice: 1460, totalVolumeKg: 17000, comparisonDiff: 40, isAbove: true },
      { factoryId: 'f2', factoryName: 'Highland Estates #1', avgPrice: 1440, totalVolumeKg: 14500, comparisonDiff: 20, isAbove: true },
      { factoryId: 'f3', factoryName: 'Mountain Peak Factory #2', avgPrice: 1485, totalVolumeKg: 11500, comparisonDiff: 65, isAbove: true },
    ],
  },
  {
    id: 'w25',
    weekName: 'Week 25',
    dateRange: 'Jun 16 - Jun 22, 2026',
    globalPrice: 1410,
    factoryBulkAvg: 1395,
    totalVolumeKg: 39500,
    comparisonDiff: -15,
    isAbove: false,
    status: 'Completed',
    factoryBreakdown: [
      { factoryId: 'f1', factoryName: 'Green Valley Plantation #4', avgPrice: 1395, totalVolumeKg: 15500, comparisonDiff: -15, isAbove: false },
      { factoryId: 'f2', factoryName: 'Highland Estates #1', avgPrice: 1380, totalVolumeKg: 13000, comparisonDiff: -30, isAbove: false },
      { factoryId: 'f3', factoryName: 'Mountain Peak Factory #2', avgPrice: 1415, totalVolumeKg: 11000, comparisonDiff: 5, isAbove: true },
    ],
  },
];

const INITIAL_TRENDS: WeeklyTrendPoint[] = [
  { week: 'W24', globalPrice: 1390, factoryBulkAvg: 1410, factoryAverages: { f1: 1410, f2: 1395, f3: 1430 } },
  { week: 'W25', globalPrice: 1410, factoryBulkAvg: 1395, factoryAverages: { f1: 1395, f2: 1380, f3: 1415 } },
  { week: 'W26', globalPrice: 1420, factoryBulkAvg: 1460, factoryAverages: { f1: 1460, f2: 1440, f3: 1485 } },
  { week: 'W27', globalPrice: 1465, factoryBulkAvg: 1450, factoryAverages: { f1: 1450, f2: 1430, f3: 1475 } },
  { week: 'W28', globalPrice: 1440, factoryBulkAvg: 1475, factoryAverages: { f1: 1475, f2: 1450, f3: 1500 } },
  { week: 'W29', globalPrice: 1450, factoryBulkAvg: 1488, factoryAverages: { f1: 1492, f2: 1460, f3: 1515 } },
];

const INITIAL_BULK_SETS: BulkSet[] = [
  {
    id: 'bs-101',
    batchNumber: 'BATCH-2026-07A',
    factoryId: 'f1',
    factoryName: 'Green Valley Plantation #4',
    createdAt: '2026-07-19 14:30',
    items: [
      { gradeId: 'op1-34', gradeName: 'Op1-34', quantityKg: 5000, unitPrice: 1520, totalPrice: 7600000 },
      { gradeId: 'pekoe-36', gradeName: 'Pekoe-36', quantityKg: 3500, unitPrice: 1480, totalPrice: 5180000 },
      { gradeId: 'bopf', gradeName: 'BOPF', quantityKg: 4000, unitPrice: 1390, totalPrice: 5560000 },
    ],
    totalQuantityKg: 12500,
    bulkAvgPrice: 1467.2,
    globalPriceAtCreation: 1450,
    comparisonDiff: 17.2,
    isAboveGlobal: true,
  },
  {
    id: 'bs-102',
    batchNumber: 'BATCH-2026-07B',
    factoryId: 'f1',
    factoryName: 'Green Valley Plantation #4',
    createdAt: '2026-07-20 10:15',
    items: [
      { gradeId: 'fbop1', gradeName: 'FBOP1', quantityKg: 2500, unitPrice: 1610, totalPrice: 4025000 },
      { gradeId: 'op1-34', gradeName: 'Op1-34', quantityKg: 3400, unitPrice: 1520, totalPrice: 5168000 },
    ],
    totalQuantityKg: 5900,
    bulkAvgPrice: 1558.14,
    globalPriceAtCreation: 1450,
    comparisonDiff: 108.14,
    isAboveGlobal: true,
  },
  {
    id: 'bs-103',
    batchNumber: 'BATCH-HE-01A',
    factoryId: 'f2',
    factoryName: 'Highland Estates #1',
    createdAt: '2026-07-18 11:20',
    items: [
      { gradeId: 'op1-34', gradeName: 'Op1-34', quantityKg: 6000, unitPrice: 1490, totalPrice: 8940000 },
      { gradeId: 'bopf', gradeName: 'BOPF', quantityKg: 5000, unitPrice: 1360, totalPrice: 6800000 },
    ],
    totalQuantityKg: 11000,
    bulkAvgPrice: 1430.91,
    globalPriceAtCreation: 1450,
    comparisonDiff: -19.09,
    isAboveGlobal: false,
  },
];

function getTeaGradesForFactory(factories: Factory[], selectedFactoryId: string): TeaGrade[] {
  const factory = factories.find((f) => f.id === selectedFactoryId) || factories[0];
  const prices = factory ? factory.gradePrices : {};
  return INITIAL_TEA_GRADES_BASE.map((g) => ({
    id: g.id,
    name: g.name,
    category: g.category,
    currentPrice: prices[g.id] !== undefined ? prices[g.id] : g.basePrice,
  }));
}

export const useTeaStore = create<TeaStoreState>((set, get) => ({
  globalPrice: 1450,
  factories: INITIAL_FACTORIES,
  selectedFactoryId: 'f1',
  teaGrades: getTeaGradesForFactory(INITIAL_FACTORIES, 'f1'),
  bulkSets: INITIAL_BULK_SETS,
  weeklyReports: INITIAL_REPORTS,
  weeklyTrends: INITIAL_TRENDS,

  setSelectedFactoryId: (id: string) => {
    set((state) => ({
      selectedFactoryId: id,
      teaGrades: getTeaGradesForFactory(state.factories, id),
    }));
  },

  addFactory: (name: string, location: string, code: string) => {
    set((state) => {
      const newId = `f-${Date.now().toString().slice(-4)}`;
      const basePrices: Record<string, number> = {};
      INITIAL_TEA_GRADES_BASE.forEach((g) => {
        basePrices[g.id] = g.basePrice;
      });
      const avgPrice = Math.round(
        Object.values(basePrices).reduce((a, b) => a + b, 0) / INITIAL_TEA_GRADES_BASE.length
      );

      const newFactory: Factory = {
        id: newId,
        name: name.trim() || `Factory ${state.factories.length + 1}`,
        location: location.trim() || 'Central Province',
        code: code.trim().toUpperCase() || `F-${state.factories.length + 1}`,
        weeklyAvgPrice: avgPrice,
        totalVolumeKg: 10000,
        gradePrices: basePrices,
      };

      const updatedFactories = [...state.factories, newFactory];
      return {
        factories: updatedFactories,
        selectedFactoryId: newId,
        teaGrades: getTeaGradesForFactory(updatedFactories, newId),
      };
    });
  },

  setGlobalPrice: (price: number) => {
    set({ globalPrice: price });
  },

  updateGradePrice: (gradeId: string, price: number, factoryId?: string) => {
    const targetId = factoryId || get().selectedFactoryId;
    set((state) => {
      const updatedFactories = state.factories.map((f) => {
        if (f.id === targetId) {
          const newPrices = { ...f.gradePrices, [gradeId]: price };
          const sum = Object.values(newPrices).reduce((a, b) => a + b, 0);
          const avg = Math.round(sum / Object.keys(newPrices).length);
          return { ...f, gradePrices: newPrices, weeklyAvgPrice: avg };
        }
        return f;
      });

      return {
        factories: updatedFactories,
        teaGrades: getTeaGradesForFactory(updatedFactories, state.selectedFactoryId),
      };
    });
  },

  calculateFactoryAvg: (factoryId: string) => {
    const factory = get().factories.find((f) => f.id === factoryId);
    if (!factory) return 0;
    const prices = Object.values(factory.gradePrices);
    if (prices.length === 0) return 0;
    return Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
  },

  calculateOverallFactoryAvg: () => {
    const { factories } = get();
    if (factories.length === 0) return 0;
    const totalVal = factories.reduce((acc, f) => acc + f.weeklyAvgPrice * (f.totalVolumeKg || 10000), 0);
    const totalVol = factories.reduce((acc, f) => acc + (f.totalVolumeKg || 10000), 0);
    return totalVol > 0 ? Math.round(totalVal / totalVol) : 0;
  },

  saveWeeklyPrices: (newGlobalPrice: number, updatedPrices: Record<string, number>, targetFactoryId?: string) => {
    const fId = targetFactoryId || get().selectedFactoryId;

    set((state) => {
      const updatedFactories = state.factories.map((factory) => {
        if (factory.id === fId) {
          const newGradePrices = { ...factory.gradePrices };
          Object.keys(updatedPrices).forEach((gid) => {
            newGradePrices[gid] = updatedPrices[gid];
          });

          const priceVals = Object.values(newGradePrices);
          const factoryAvg = priceVals.length > 0 ? Math.round(priceVals.reduce((a, b) => a + b, 0) / priceVals.length) : factory.weeklyAvgPrice;

          return {
            ...factory,
            gradePrices: newGradePrices,
            weeklyAvgPrice: factoryAvg,
          };
        }
        return factory;
      });

      // Recalculate combined weighted average across all factories
      const totalVolume = updatedFactories.reduce((sum, f) => sum + (f.totalVolumeKg || 10000), 0);
      const totalValue = updatedFactories.reduce((sum, f) => sum + f.weeklyAvgPrice * (f.totalVolumeKg || 10000), 0);
      const combinedBulkAvg = totalVolume > 0 ? Math.round(totalValue / totalVolume) : newGlobalPrice;

      const diff = combinedBulkAvg - newGlobalPrice;
      const isAbove = diff >= 0;

      // Update factory breakdown stats for current week (W29)
      const factoryBreakdown: FactoryWeeklyStat[] = updatedFactories.map((f) => {
        const fDiff = f.weeklyAvgPrice - newGlobalPrice;
        return {
          factoryId: f.id,
          factoryName: f.name,
          avgPrice: f.weeklyAvgPrice,
          totalVolumeKg: f.totalVolumeKg,
          comparisonDiff: fDiff,
          isAbove: fDiff >= 0,
        };
      });

      const updatedReports = state.weeklyReports.map((report) =>
        report.id === 'w29'
          ? {
              ...report,
              globalPrice: newGlobalPrice,
              factoryBulkAvg: combinedBulkAvg,
              totalVolumeKg: totalVolume,
              comparisonDiff: diff,
              isAbove,
              factoryBreakdown,
            }
          : report
      );

      const currentFactoryAverages: Record<string, number> = {};
      updatedFactories.forEach((f) => {
        currentFactoryAverages[f.id] = f.weeklyAvgPrice;
      });

      const updatedTrends = state.weeklyTrends.map((pt) =>
        pt.week === 'W29'
          ? { ...pt, globalPrice: newGlobalPrice, factoryBulkAvg: combinedBulkAvg, factoryAverages: currentFactoryAverages }
          : pt
      );

      return {
        globalPrice: newGlobalPrice,
        factories: updatedFactories,
        teaGrades: getTeaGradesForFactory(updatedFactories, state.selectedFactoryId),
        weeklyReports: updatedReports,
        weeklyTrends: updatedTrends,
      };
    });
  },

  calculateBulkMetrics: (selectedItems, factoryId) => {
    const { factories, selectedFactoryId, globalPrice } = get();
    const targetFId = factoryId || selectedFactoryId;
    const factoryGrades = getTeaGradesForFactory(factories, targetFId);

    let totalQuantityKg = 0;
    let totalPrice = 0;

    const breakdown: BulkItem[] = [];

    selectedItems.forEach((item) => {
      if (item.quantityKg > 0) {
        const grade = factoryGrades.find((g) => g.id === item.gradeId);
        const unitPrice = grade ? grade.currentPrice : 0;
        const gradeName = grade ? grade.name : item.gradeId;
        const itemTotal = unitPrice * item.quantityKg;

        totalQuantityKg += item.quantityKg;
        totalPrice += itemTotal;

        breakdown.push({
          gradeId: item.gradeId,
          gradeName,
          quantityKg: item.quantityKg,
          unitPrice,
          totalPrice: itemTotal,
        });
      }
    });

    const bulkAvgPrice = totalQuantityKg > 0 ? Number((totalPrice / totalQuantityKg).toFixed(2)) : 0;
    const comparisonDiff = Number((bulkAvgPrice - globalPrice).toFixed(2));
    const isAboveGlobal = comparisonDiff >= 0;

    return {
      totalQuantityKg,
      bulkAvgPrice,
      comparisonDiff,
      isAboveGlobal,
      breakdown,
    };
  },

  addBulkSet: (batchName, selectedItems, factoryId) => {
    const { calculateBulkMetrics, globalPrice, factories, selectedFactoryId } = get();
    const targetFId = factoryId || selectedFactoryId;
    const factory = factories.find((f) => f.id === targetFId) || factories[0];
    const metrics = calculateBulkMetrics(selectedItems, targetFId);

    if (metrics.totalQuantityKg === 0 || metrics.breakdown.length === 0) {
      return null;
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;

    const newBulkSet: BulkSet = {
      id: `bs-${Date.now()}`,
      batchNumber: batchName.trim() || `BATCH-${Date.now().toString().slice(-4)}`,
      factoryId: factory.id,
      factoryName: factory.name,
      createdAt: dateStr,
      items: metrics.breakdown,
      totalQuantityKg: metrics.totalQuantityKg,
      bulkAvgPrice: metrics.bulkAvgPrice,
      globalPriceAtCreation: globalPrice,
      comparisonDiff: metrics.comparisonDiff,
      isAboveGlobal: metrics.isAboveGlobal,
    };

    set((state) => {
      const newBulkSets = [newBulkSet, ...state.bulkSets];

      // Recalculate W29 total volume and factory averages
      const totalVol = newBulkSets.reduce((acc, bs) => acc + bs.totalQuantityKg, 0);
      const totalVal = newBulkSets.reduce((acc, bs) => acc + bs.bulkAvgPrice * bs.totalQuantityKg, 0);
      const combinedBulkAvg = totalVol > 0 ? Math.round(totalVal / totalVol) : state.globalPrice;
      const diff = combinedBulkAvg - state.globalPrice;

      const updatedReports = state.weeklyReports.map((rep) =>
        rep.id === 'w29'
          ? {
              ...rep,
              factoryBulkAvg: combinedBulkAvg,
              totalVolumeKg: totalVol,
              comparisonDiff: diff,
              isAbove: diff >= 0,
            }
          : rep
      );

      const updatedTrends = state.weeklyTrends.map((pt) =>
        pt.week === 'W29' ? { ...pt, factoryBulkAvg: combinedBulkAvg } : pt
      );

      return {
        bulkSets: newBulkSets,
        weeklyReports: updatedReports,
        weeklyTrends: updatedTrends,
      };
    });

    return newBulkSet;
  },
}));

