import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Colors } from '@/constants/colors';
import { BellIcon } from '@/components/ui-icons';

interface HeaderProps {
  greeting?: string;
  subTitle?: string;
  notificationCount?: number;
  onNotificationPress?: () => void;
  onProfilePress?: () => void;
}

export default function Header({
  greeting = 'Good Morning, Manager',
  subTitle = 'Green Valley Tea Factory',
  notificationCount = 3,
  onNotificationPress,
  onProfilePress,
}: HeaderProps) {
  return (
    <View style={styles.headerContainer}>
      <View style={styles.leftContent}>
        <Text style={styles.greetingText}>{greeting}</Text>
        <Text style={styles.subTitleText}>{subTitle}</Text>
      </View>
      
      <View style={styles.rightContent}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onNotificationPress}
          activeOpacity={0.7}
        >
          <BellIcon color={Colors.text} size={22} />
          {notificationCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{notificationCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.avatarButton}
          onPress={onProfilePress}
          activeOpacity={0.7}
        >
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80' }}
            style={styles.avatar}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    backgroundColor: Colors.background,
  },
  leftContent: {
    flex: 1,
    marginRight: 12,
  },
  greetingText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
  },
  subTitleText: {
    fontSize: 20,
    color: Colors.text,
    fontWeight: 'bold',
  },
  rightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444', // Red-500
    borderRadius: 9,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.card,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  avatarButton: {
    borderRadius: 22,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
});
