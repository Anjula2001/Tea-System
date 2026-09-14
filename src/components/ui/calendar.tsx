import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Colors } from '@/constants/colors';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/ui-icons';

export interface CalendarProps {
  /** Selected date in YYYY-MM-DD format */
  selected?: string;
  /** Callback when date is selected */
  onSelect?: (dateIso: string) => void;
  /** Minimum selectable date (YYYY-MM-DD) */
  minDate?: string;
  /** Maximum selectable date (YYYY-MM-DD) */
  maxDate?: string;
  /** Optional initial view date (YYYY-MM-DD). Defaults to selected or today */
  initialDate?: string;
  /** Allow clearing the selection */
  onClear?: () => void;
  /** Additional custom style */
  style?: object;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function toIsoString(year: number, month: number, day: number): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function parseIso(iso?: string): { year: number; month: number; day: number } | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return { year: y, month: m - 1, day: d };
}

/**
 * Shadcn-styled Calendar component for React Native / Web.
 * Renders a clean month grid with navigation, selected highlights, and today indicator.
 */
export function Calendar({
  selected,
  onSelect,
  minDate,
  maxDate,
  initialDate,
  onClear,
  style,
}: CalendarProps) {
  const today = useMemo(() => {
    const d = new Date();
    return {
      year: d.getFullYear(),
      month: d.getMonth(),
      day: d.getDate(),
      iso: toIsoString(d.getFullYear(), d.getMonth(), d.getDate()),
    };
  }, []);

  const parsedInitial = parseIso(selected || initialDate) || today;
  const [viewYear, setViewYear] = useState(parsedInitial.year);
  const [viewMonth, setViewMonth] = useState(parsedInitial.month);

  // Month navigation
  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const jumpToToday = () => {
    setViewYear(today.year);
    setViewMonth(today.month);
    if (onSelect) {
      onSelect(today.iso);
    }
  };

  // Generate calendar days grid (6 weeks = 42 cells)
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sunday
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const days: Array<{
      day: number;
      month: number;
      year: number;
      iso: string;
      isCurrentMonth: boolean;
      isSelected: boolean;
      isToday: boolean;
      isDisabled: boolean;
    }> = [];

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const m = viewMonth === 0 ? 11 : viewMonth - 1;
      const y = viewMonth === 0 ? viewYear - 1 : viewYear;
      const iso = toIsoString(y, m, day);
      days.push({
        day,
        month: m,
        year: y,
        iso,
        isCurrentMonth: false,
        isSelected: selected === iso,
        isToday: today.iso === iso,
        isDisabled: (minDate ? iso < minDate : false) || (maxDate ? iso > maxDate : false),
      });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = toIsoString(viewYear, viewMonth, day);
      days.push({
        day,
        month: viewMonth,
        year: viewYear,
        iso,
        isCurrentMonth: true,
        isSelected: selected === iso,
        isToday: today.iso === iso,
        isDisabled: (minDate ? iso < minDate : false) || (maxDate ? iso > maxDate : false),
      });
    }

    // Next month padding to fill up to 35 or 42 cells
    const remaining = 42 - days.length;
    for (let day = 1; day <= remaining; day++) {
      const m = viewMonth === 11 ? 0 : viewMonth + 1;
      const y = viewMonth === 11 ? viewYear + 1 : viewYear;
      const iso = toIsoString(y, m, day);
      days.push({
        day,
        month: m,
        year: y,
        iso,
        isCurrentMonth: false,
        isSelected: selected === iso,
        isToday: today.iso === iso,
        isDisabled: (minDate ? iso < minDate : false) || (maxDate ? iso > maxDate : false),
      });
    }

    return days;
  }, [viewYear, viewMonth, selected, today.iso, minDate, maxDate]);

  return (
    <View style={[styles.container, style]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.monthTitle}>
          {MONTH_NAMES[viewMonth]} <Text style={styles.yearText}>{viewYear}</Text>
        </Text>
        <View style={styles.navControls}>
          <Pressable
            style={({ pressed }) => [styles.navButton, pressed && styles.navButtonPressed]}
            onPress={prevMonth}
            accessibilityLabel="Previous month">
            <ChevronLeftIcon size={16} color={Colors.text} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.navButton, pressed && styles.navButtonPressed]}
            onPress={nextMonth}
            accessibilityLabel="Next month">
            <ChevronRightIcon size={16} color={Colors.text} />
          </Pressable>
        </View>
      </View>

      {/* Weekday Row */}
      <View style={styles.weekdaysRow}>
        {WEEKDAYS.map((wd, i) => (
          <View key={i} style={styles.weekdayCell}>
            <Text style={styles.weekdayText}>{wd}</Text>
          </View>
        ))}
      </View>

      {/* Days Grid */}
      <View style={styles.daysGrid}>
        {calendarDays.map((cell, index) => {
          return (
            <Pressable
              key={index}
              disabled={cell.isDisabled}
              onPress={() => onSelect?.(cell.iso)}
              style={({ pressed }) => [
                styles.dayCell,
                cell.isSelected && styles.dayCellSelected,
                cell.isToday && !cell.isSelected && styles.dayCellToday,
                cell.isDisabled && styles.dayCellDisabled,
                pressed && !cell.isDisabled && !cell.isSelected && styles.dayCellPressed,
              ]}>
              <Text
                style={[
                  styles.dayText,
                  !cell.isCurrentMonth && styles.dayTextOutside,
                  cell.isSelected && styles.dayTextSelected,
                  cell.isToday && !cell.isSelected && styles.dayTextToday,
                  cell.isDisabled && styles.dayTextDisabled,
                ]}>
                {cell.day}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable style={styles.footerBtn} onPress={jumpToToday}>
          <Text style={styles.footerBtnText}>Today</Text>
        </Pressable>
        {onClear && selected && (
          <Pressable style={styles.footerBtn} onPress={onClear}>
            <Text style={[styles.footerBtnText, { color: Colors.below }]}>Clear</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    width: 280,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04)',
      },
      default: {
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  monthTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  yearText: {
    fontWeight: '400',
    color: Colors.textSecondary,
  },
  navControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  navButtonPressed: {
    backgroundColor: Colors.background,
    borderColor: Colors.primary,
  },
  weekdaysRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  weekdayText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginVertical: 1,
  },
  dayCellPressed: {
    backgroundColor: Colors.primaryLight,
  },
  dayCellSelected: {
    backgroundColor: Colors.primary,
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  dayCellDisabled: {
    opacity: 0.25,
  },
  dayText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text,
  },
  dayTextOutside: {
    color: Colors.textSecondary,
    opacity: 0.4,
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dayTextToday: {
    color: Colors.primary,
    fontWeight: '700',
  },
  dayTextDisabled: {
    color: Colors.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  footerBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  footerBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
});
