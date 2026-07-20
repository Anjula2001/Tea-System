import { create } from 'zustand';

export interface TeaGrade {
  id: string;
  name: string;
  category: string;
  currentPrice: number;
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
}

export interface WeeklyTrendPoint {
  week: string;
  globalPrice: number;
  factoryBulkAvg: number;
}

interface TeaStoreState {
  globalPrice: number; // Weekly Global Tea Auction Price (Rs / kg)
  teaGrades: TeaGrade[];
  bulkSets: BulkSet[];
  weeklyReports: WeeklyReport[];
  weeklyTrends: WeeklyTrendPoint[];
  
  // Actions
  setGlobalPrice: (price: number) => void;
  updateGradePrice: (gradeId: string, price: number) => void;
  saveWeeklyPrices: (globalPrice: number, updatedPrices: Record<string, number>) => void;
  calculateBulkMetrics: (selectedItems: { gradeId: string; quantityKg: number }[]) => {
    totalQuantityKg: number;
    bulkAvgPrice: number;
    comparisonDiff: number;
    isAboveGlobal: boolean;
    breakdown: BulkItem[];
  };
  addBulkSet: (batchName: string, selectedItems: { gradeId: string; quantityKg: number }[]) => BulkSet | null;
}

const INITIAL_TEA_GRADES: TeaGrade[] = [
  { id: 'op1-34', name: 'Op1-34', category: 'Whole Leaf', currentPrice: 1520 },
  { id: 'pekoe-36', name: 'Pekoe-36', category: 'Pekoe', currentPrice: 1480 },
  { id: 'bopf', name: 'BOPF', category: 'Fannings', currentPrice: 1390 },
  { id: 'dust-1', name: 'Dust-1', category: 'Dust', currentPrice: 1250 },
  { id: 'fbop1', name: 'FBOP1', category: 'Flowery Leaf', currentPrice: 1610 },
  { id: 'bop', name: 'BOP', category: 'Broken Leaf', currentPrice: 1420 },
  { id: 'pekoe-1', name: 'Pekoe-1', category: 'Pekoe', currentPrice: 1550 },
  { id: 'bp', name: 'BP', category: 'Broken Pekoe', currentPrice: 1310 },
];

const INITIAL_REPORTS: WeeklyReport[] = [
  {
    id: 'w29',
    weekName: 'Week 29 (Current)',
    dateRange: 'Jul 14 - Jul 20, 2026',
    globalPrice: 1450,
    factoryBulkAvg: 1492,
    totalVolumeKg: 18400,
    comparisonDiff: 42,
    isAbove: true,
    status: 'Active',
  },
  {
    id: 'w28',
    weekName: 'Week 28',
    dateRange: 'Jul 07 - Jul 13, 2026',
    globalPrice: 1440,
    factoryBulkAvg: 1475,
    totalVolumeKg: 22100,
    comparisonDiff: 35,
    isAbove: true,
    status: 'Completed',
  },
  {
    id: 'w27',
    weekName: 'Week 27',
    dateRange: 'Jun 30 - Jul 06, 2026',
    globalPrice: 1465,
    factoryBulkAvg: 1450,
    totalVolumeKg: 19800,
    comparisonDiff: -15,
    isAbove: false,
    status: 'Completed',
  },
  {
    id: 'w26',
    weekName: 'Week 26',
    dateRange: 'Jun 23 - Jun 29, 2026',
    globalPrice: 1420,
    factoryBulkAvg: 1460,
    totalVolumeKg: 20500,
    comparisonDiff: 40,
    isAbove: true,
    status: 'Completed',
  },
  {
    id: 'w25',
    weekName: 'Week 25',
    dateRange: 'Jun 16 - Jun 22, 2026',
    globalPrice: 1410,
    factoryBulkAvg: 1395,
    totalVolumeKg: 17900,
    comparisonDiff: -15,
    isAbove: false,
    status: 'Completed',
  },
];

const INITIAL_TRENDS: WeeklyTrendPoint[] = [
  { week: 'W24', globalPrice: 1390, factoryBulkAvg: 1410 },
  { week: 'W25', globalPrice: 1410, factoryBulkAvg: 1395 },
  { week: 'W26', globalPrice: 1420, factoryBulkAvg: 1460 },
  { week: 'W27', globalPrice: 1465, factoryBulkAvg: 1450 },
  { week: 'W28', globalPrice: 1440, factoryBulkAvg: 1475 },
  { week: 'W29', globalPrice: 1450, factoryBulkAvg: 1492 },
];

const INITIAL_BULK_SETS: BulkSet[] = [
  {
    id: 'bs-101',
    batchNumber: 'BATCH-2026-07A',
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
];

export const useTeaStore = create<TeaStoreState>((set, get) => ({
  globalPrice: 1450,
  teaGrades: INITIAL_TEA_GRADES,
  bulkSets: INITIAL_BULK_SETS,
  weeklyReports: INITIAL_REPORTS,
  weeklyTrends: INITIAL_TRENDS,

  setGlobalPrice: (price: number) => {
    set({ globalPrice: price });
  },

  updateGradePrice: (gradeId: string, price: number) => {
    set((state) => ({
      teaGrades: state.teaGrades.map((grade) =>
        grade.id === gradeId ? { ...grade, currentPrice: price } : grade
      ),
    }));
  },

  saveWeeklyPrices: (newGlobalPrice: number, updatedPrices: Record<string, number>) => {
    set((state) => {
      const updatedGrades = state.teaGrades.map((grade) => ({
        ...grade,
        currentPrice: updatedPrices[grade.id] !== undefined ? updatedPrices[grade.id] : grade.currentPrice,
      }));

      // Calculate new factory bulk average across grades
      const totalSum = updatedGrades.reduce((sum, g) => sum + g.currentPrice, 0);
      const avgPrice = Math.round(totalSum / updatedGrades.length);

      // Update current week report & trends
      const diff = avgPrice - newGlobalPrice;
      const isAbove = diff >= 0;

      const updatedReports = state.weeklyReports.map((report) =>
        report.id === 'w29'
          ? {
              ...report,
              globalPrice: newGlobalPrice,
              factoryBulkAvg: avgPrice,
              comparisonDiff: diff,
              isAbove,
            }
          : report
      );

      const updatedTrends = state.weeklyTrends.map((pt) =>
        pt.week === 'W29'
          ? { ...pt, globalPrice: newGlobalPrice, factoryBulkAvg: avgPrice }
          : pt
      );

      return {
        globalPrice: newGlobalPrice,
        teaGrades: updatedGrades,
        weeklyReports: updatedReports,
        weeklyTrends: updatedTrends,
      };
    });
  },

  calculateBulkMetrics: (selectedItems) => {
    const { teaGrades, globalPrice } = get();
    let totalQuantityKg = 0;
    let totalPrice = 0;

    const breakdown: BulkItem[] = [];

    selectedItems.forEach((item) => {
      if (item.quantityKg > 0) {
        const grade = teaGrades.find((g) => g.id === item.gradeId);
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

  addBulkSet: (batchName, selectedItems) => {
    const { calculateBulkMetrics, globalPrice } = get();
    const metrics = calculateBulkMetrics(selectedItems);

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

      // Recalculate W29 total volume and avg price based on bulk sets
      const totalVol = newBulkSets.reduce((acc, bs) => acc + bs.totalQuantityKg, 0);
      const totalVal = newBulkSets.reduce((acc, bs) => acc + bs.bulkAvgPrice * bs.totalQuantityKg, 0);
      const factoryBulkAvg = totalVol > 0 ? Math.round(totalVal / totalVol) : state.globalPrice;
      const diff = factoryBulkAvg - state.globalPrice;

      const updatedReports = state.weeklyReports.map((rep) =>
        rep.id === 'w29'
          ? {
              ...rep,
              factoryBulkAvg,
              totalVolumeKg: totalVol,
              comparisonDiff: diff,
              isAbove: diff >= 0,
            }
          : rep
      );

      const updatedTrends = state.weeklyTrends.map((pt) =>
        pt.week === 'W29' ? { ...pt, factoryBulkAvg } : pt
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
