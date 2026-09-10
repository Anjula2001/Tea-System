import { useRouter } from 'expo-router';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '@/constants/colors';
import { BellIcon } from '@/components/ui-icons';
import { useTeaStore } from '@/store/tea-store';

/**
 * Every screen's top bar.
 *
 * `greeting` and `subTitle` are required rather than defaulted: the defaults
 * used to be one factory's name, which meant a screen that forgot to pass them
 * silently claimed to belong to somebody else. The same went for
 * `notificationCount`, which defaulted to 3 and showed a red badge for alerts
 * that did not exist.
 *
 * The avatar is initials drawn from the factory's own name in the database. It
 * was a photograph of a stranger, loaded from a stock-photo URL on every
 * render — wrong about who the user is, and broken without a network. Tapping
 * it opens our factory's record, which is where that name is set.
 */
interface HeaderProps {
  greeting: string;
  subTitle: string;
  notificationCount: number;
  onNotificationPress?: () => void;
  onProfilePress?: () => void;
}

export default function Header({
  greeting,
  subTitle,
  notificationCount,
  onNotificationPress,
  onProfilePress,
}: HeaderProps) {
  const profile = useTeaStore((s) => s.factoryProfile);
  const router = useRouter();
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
          onPress={onProfilePress ?? (() => router.push('/profile'))}
          activeOpacity={0.7}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(profile?.shortName)}</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/** "Green Valley" → "GV"; one word gives one letter; nothing gives a dash. */
function initials(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '—';
  return words
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('');
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
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
});
