import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Colors } from '@/constants/colors';
import { LeafIcon, MoneyIcon } from '@/components/ui-icons';

export interface ActivityItem {
  id: string;
  type: 'collection' | 'payment';
  title: string;
  supplier: string;
  amount: string;
  time: string;
}

interface ActivityCardProps {
  activity: ActivityItem;
}

export default function ActivityCard({ activity }: ActivityCardProps) {
  const isCollection = activity.type === 'collection';

  return (
    <View style={styles.container}>
      <View style={styles.leftRow}>
        <View
          style={[
            styles.iconWrapper,
            { backgroundColor: isCollection ? Colors.primaryLight : Colors.accentLight },
          ]}
        >
          {isCollection ? (
            <LeafIcon color={Colors.primary} size={18} />
          ) : (
            <MoneyIcon color={Colors.accent} size={18} />
          )}
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.titleText}>{activity.title}</Text>
          <Text style={styles.supplierText}>Supplier: {activity.supplier}</Text>
          <Text style={styles.timeText}>{activity.time}</Text>
        </View>
      </View>
      <View style={styles.rightContent}>
        <Text
          style={[
            styles.amountText,
            { color: isCollection ? Colors.primary : Colors.accent },
          ]}
        >
          {isCollection ? '+' : ''}
          {activity.amount}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Colors.card,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  titleText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  supplierText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  timeText: {
    fontSize: 11,
    color: '#9CA3AF', // Gray-400
  },
  rightContent: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});
