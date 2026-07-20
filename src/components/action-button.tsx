import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Platform, View } from 'react-native';
import { Colors } from '@/constants/colors';

interface ActionButtonProps {
  label: string;
  icon?: React.ReactNode;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
}

export default function ActionButton({
  label,
  icon,
  onPress,
  variant = 'primary',
}: ActionButtonProps) {
  const isOutline = variant === 'outline';
  const isSecondary = variant === 'secondary';

  const buttonStyle = [
    styles.button,
    isOutline && styles.outlineButton,
    isSecondary && styles.secondaryButton,
  ];

  const textStyle = [
    styles.text,
    isOutline && styles.outlineText,
    isSecondary && styles.secondaryText,
  ];

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.content}>
        {icon && <View style={styles.iconContainer}>{icon}</View>}
        <Text style={textStyle}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    flex: 1,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
      web: {
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(46, 125, 50, 0.15)',
        transition: 'all 0.2s ease',
      },
    }),
  },
  secondaryButton: {
    backgroundColor: Colors.primaryLight,
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: 6,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryText: {
    color: Colors.primary,
  },
  outlineText: {
    color: Colors.primary,
  },
});
