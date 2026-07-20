import React from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import { Colors } from '@/constants/colors';

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  themeColor: string; // Hex color for the theme accent
  backgroundColor?: string; // Optional full background color
}

const { width } = Dimensions.get('window');
const cardWidth = (width - 56) / 2; // Split layout width with padding/gaps

export default function StatCard({
  title,
  value,
  icon,
  themeColor,
  backgroundColor = Colors.card,
}: StatCardProps) {
  const isDarkBg = backgroundColor !== Colors.card && backgroundColor !== '#FFFFFF';

  return (
    <View style={[styles.card, { backgroundColor }]}>
      {/* Accent Top/Left border */}
      <View style={[styles.accentLine, { backgroundColor: themeColor }]} />
      
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: isDarkBg ? 'rgba(255,255,255,0.8)' : Colors.textSecondary }]}>
            {title}
          </Text>
          <View style={[styles.iconContainer, { backgroundColor: isDarkBg ? 'rgba(255,255,255,0.2)' : themeColor + '15' }]}>
            {icon}
          </View>
        </View>
        
        <Text style={[styles.value, { color: isDarkBg ? '#FFFFFF' : Colors.text }]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: Platform.OS === 'web' ? '23%' : cardWidth,
    minWidth: 150,
    height: 120,
    borderRadius: 16,
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
      },
    }),
  },
  accentLine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
    marginRight: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  value: {
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: -0.5,
  },
});
