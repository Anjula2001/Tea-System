import React from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';

import { Colors } from '@/constants/colors';

/**
 * "Which one are you working on?" — the card at the top of an entry screen.
 *
 * Both entry screens used to list every choice as a row of pills. That reads
 * fine with six auctions and badly with sixty, and it pushed the actual work
 * below the fold. So the card shows the current choice and hides the rest
 * behind a search that opens on demand.
 *
 * The shell is shared; what goes in the panel is not. An auction is found by
 * date, a bulk set by name or state, and pretending those are the same filter
 * would serve neither.
 */
export function PickerCard({
  label,
  summary,
  open,
  onToggle,
  action,
  children,
}: {
  label: string;
  /** The current choice, always visible. */
  summary: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  /** The one thing you can do besides choosing — usually "add a new one". */
  action?: { label: string; onPress: () => void };
  /** The search panel, rendered only while open. */
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.actions}>
          <Pressable style={styles.linkButton} onPress={onToggle}>
            <Text style={styles.linkButtonText}>{open ? 'Done' : 'Change'}</Text>
          </Pressable>
          {action && (
            <Pressable style={styles.linkButton} onPress={action.onPress}>
              <Text style={styles.linkButtonText}>{action.label}</Text>
            </Pressable>
          )}
        </View>
      </View>

      {summary}

      {open && <View style={styles.panel}>{children}</View>}
    </View>
  );
}

/** A search box with a Clear button that appears only once there is something to clear. */
export function SearchField({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.searchField}>
      <TextInput
        style={styles.searchInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value !== '' && (
        <Pressable style={styles.clearButton} onPress={() => onChangeText('')}>
          <Text style={styles.clearButtonText}>Clear</Text>
        </Pressable>
      )}
    </View>
  );
}

/** A row of mutually exclusive filters. One is always on, so there is no "off" state. */
export function FilterPills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <View style={styles.pillRow}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={[styles.filterPill, active && styles.filterPillActive]}
            onPress={() => onChange(option.value)}>
            <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Styles the panels share. Exported because a panel's own content lives in the
 * screen that knows what it is filtering — the shell should not have to know
 * that one of them has date fields and the other has status pills.
 */
export const pickerStyles = StyleSheet.create({
  chosenTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  chosenMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  chosenRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flexOne: { flex: 1, minWidth: 0 },
  backLink: { fontSize: 12, fontWeight: '600', color: Colors.primary },

  count: { fontSize: 11, color: Colors.textSecondary, lineHeight: 16 },
  empty: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  errorText: { fontSize: 12, color: Colors.below, fontWeight: '600' },
  busy: { opacity: 0.6 },

  fieldLabel: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.8 },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  dateRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 10 },
  dateField: { flexGrow: 1, flexBasis: 150, minWidth: 130, gap: 4 },

  applyButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  applyButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  outlineButton: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.background,
  },
  outlineButtonText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },

  addForm: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 14,
  },
  addField: { flexGrow: 1, flexBasis: 150, minWidth: 140, gap: 4 },
  addFieldWide: { flexBasis: 230 },
  addNote: { flexBasis: '100%', fontSize: 11, color: Colors.textSecondary, lineHeight: 16 },
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.8 },
  actions: { flexDirection: 'row', gap: 14, marginLeft: 'auto' },
  linkButton: { paddingVertical: 2 },
  linkButtonText: { fontSize: 12, fontWeight: '700', color: Colors.primary },

  panel: { gap: 12, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 14 },

  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 10, fontSize: 14, color: Colors.text },
  clearButton: { paddingHorizontal: 6, paddingVertical: 4 },
  clearButtonText: { fontSize: 12, fontWeight: '600', color: Colors.primary },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filterPill: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: Colors.background,
  },
  filterPillActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  filterPillText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  filterPillTextActive: { color: Colors.primary },
});
