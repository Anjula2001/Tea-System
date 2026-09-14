import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { Colors } from '@/constants/colors';
import { CalendarIcon, XIcon } from '@/components/ui-icons';
import { Calendar } from './calendar';
import { formatAuctionDate } from '@/domain/averaging';

export interface DatePickerProps {
  /** ISO Date string (YYYY-MM-DD) */
  value?: string;
  /** Callback when date is selected */
  onChange: (dateIso: string) => void;
  /** Placeholder text when no date selected */
  placeholder?: string;
  /** Label displayed above or inside picker */
  label?: string;
  /** Minimum selectable date */
  minDate?: string;
  /** Maximum selectable date */
  maxDate?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Format function for displaying date text */
  formatDisplayDate?: (dateIso: string) => string;
  /** Custom trigger button style */
  style?: object;
  /** Allow clearing date */
  allowClear?: boolean;
}

/**
 * Shadcn-styled DatePicker component for React Native & Web.
 * Combines an outline trigger button with Calendar icon and a popover Calendar modal.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  label,
  minDate,
  maxDate,
  disabled = false,
  formatDisplayDate = formatAuctionDate,
  style,
  allowClear = false,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const displayText = value ? formatDisplayDate(value) : placeholder;
  const hasValue = Boolean(value);

  const handleSelect = (dateIso: string) => {
    onChange(dateIso);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setIsOpen(false);
  };

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}

      {/* Trigger Button */}
      <Pressable
        disabled={disabled}
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          hasValue && styles.triggerWithValue,
          isOpen && styles.triggerOpen,
          disabled && styles.triggerDisabled,
          pressed && !disabled && styles.triggerPressed,
          style,
        ]}>
        <View style={styles.iconContainer}>
          <CalendarIcon size={16} color={hasValue ? Colors.primary : Colors.textSecondary} />
        </View>
        <Text
          style={[
            styles.triggerText,
            !hasValue && styles.triggerPlaceholder,
            hasValue && styles.triggerValueText,
          ]}
          numberOfLines={1}>
          {displayText}
        </Text>
        {allowClear && hasValue && (
          <Pressable
            hitSlop={8}
            onPress={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            style={styles.clearBtn}>
            <XIcon size={14} color={Colors.textSecondary} />
          </Pressable>
        )}
      </Pressable>

      {/* Calendar Modal / Popover */}
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setIsOpen(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.popoverContainer}>
                <View style={styles.popoverHeader}>
                  <Text style={styles.popoverTitle}>
                    {label ? `Select ${label}` : 'Select Date'}
                  </Text>
                  <Pressable
                    hitSlop={10}
                    onPress={() => setIsOpen(false)}
                    style={styles.closeBtn}>
                    <XIcon size={16} color={Colors.textSecondary} />
                  </Pressable>
                </View>
                <Calendar
                  selected={value}
                  onSelect={handleSelect}
                  minDate={minDate}
                  maxDate={maxDate}
                  onClear={allowClear ? handleClear : undefined}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 42,
    gap: 8,
  },
  triggerWithValue: {
    backgroundColor: '#FFFFFF',
    borderColor: Colors.border,
  },
  triggerOpen: {
    borderColor: Colors.primary,
    ...Platform.select({
      web: {
        outlineStyle: 'solid',
        outlineColor: Colors.primaryLight,
        outlineWidth: 2,
      },
    }),
  },
  triggerDisabled: {
    opacity: 0.5,
    backgroundColor: Colors.background,
  },
  triggerPressed: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  triggerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text,
  },
  triggerValueText: {
    fontWeight: '600',
    color: Colors.text,
  },
  triggerPlaceholder: {
    color: Colors.textSecondary,
    fontWeight: '400',
  },
  clearBtn: {
    padding: 2,
    borderRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(2px)',
      },
    }),
  },
  popoverContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Platform.select({
      web: {
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
      },
      default: {
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
    }),
  },
  popoverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 4,
  },
  popoverTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  closeBtn: {
    padding: 4,
    borderRadius: 6,
  },
});
