import React from 'react';
import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
} from 'expo-router/ui';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';

import { Colors } from '@/constants/colors';
import {
  HomeIcon,
  MoneyIcon,
  PlusIcon,
  ChartIcon,
  LeafIcon,
} from '@/components/ui-icons';

export default function AppTabsWeb() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  return (
    <Tabs style={styles.tabsRoot}>
      <View style={[styles.mainLayout, !isDesktop && styles.mobileLayout]}>
        {/* Left Sidebar Navigation for Web / Desktop */}
        <View style={[styles.sidebar, !isDesktop && styles.mobileHeaderNav]}>
          {/* Logo / Brand Header */}
          <View style={styles.brandContainer}>
            <View style={styles.logoBadge}>
              <LeafIcon color="#FFFFFF" size={20} />
            </View>
            <View style={styles.brandTextContainer}>
              <Text style={styles.brandTitle}>Green Valley</Text>
              <Text style={styles.brandSubtitle}>Tea Factory ERP</Text>
            </View>
          </View>

          {/* Navigation Links List */}
          <TabList asChild style={styles.tabListContainer}>
            <View style={[styles.navigationGroup, !isDesktop && styles.mobileTabRow]}>
              <Text style={[styles.sectionLabel, !isDesktop && styles.hiddenOnMobile]}>
                MAIN MENU
              </Text>

              <TabTrigger name="index" href="/" asChild>
                <SidebarTabButton icon={<HomeIcon />}>Dashboard</SidebarTabButton>
              </TabTrigger>

              <TabTrigger name="price-input" href="/price-input" asChild>
                <SidebarTabButton icon={<MoneyIcon />}>Weekly Price Input</SidebarTabButton>
              </TabTrigger>

              <TabTrigger name="bulk-creation" href="/bulk-creation" asChild>
                <SidebarTabButton icon={<PlusIcon />}>Bulk Creation</SidebarTabButton>
              </TabTrigger>

              <TabTrigger name="reports" href="/reports" asChild>
                <SidebarTabButton icon={<ChartIcon />}>Reports</SidebarTabButton>
              </TabTrigger>
            </View>
          </TabList>

          {/* Factory Info Card in Sidebar (Desktop) */}
          {isDesktop && (
            <View style={styles.sidebarFooter}>
              <View style={styles.factoryCard}>
                <View style={styles.statusDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.factoryName}>Plantation No. 4</Text>
                  <Text style={styles.factoryMeta}>Week 29 Active</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Content Area with Header */}
        <View style={styles.contentContainer}>
          <TabSlot style={{ flex: 1 }} />
        </View>
      </View>
    </Tabs>
  );
}

interface SidebarTabButtonProps extends TabTriggerSlotProps {
  icon?: React.ReactElement<{ color?: string; size?: number }>;
}

function SidebarTabButton({ children, isFocused, icon, ...props }: SidebarTabButtonProps) {
  const iconColor = isFocused ? Colors.primary : Colors.textSecondary;
  const clonedIcon = icon ? React.cloneElement(icon, { color: iconColor, size: 18 }) : null;

  return (
    <Pressable
      {...props}
      style={({ pressed }) => [
        styles.navItem,
        isFocused && styles.navItemActive,
        pressed && styles.navItemPressed,
      ]}>
      <View style={styles.navItemIconContainer}>{clonedIcon}</View>
      <Text style={[styles.navItemText, isFocused && styles.navItemTextActive]}>
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabsRoot: {
    flex: 1,
    height: '100%',
    backgroundColor: Colors.background,
  },
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
    height: '100%',
  },
  mobileLayout: {
    flexDirection: 'column',
  },
  sidebar: {
    width: 250,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    paddingVertical: 24,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    zIndex: 20,
  },
  mobileHeaderNav: {
    width: '100%',
    borderRightWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'column',
    gap: 12,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  brandTextContainer: {
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.2,
  },
  brandSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tabListContainer: {
    flex: 1,
  },
  navigationGroup: {
    flexDirection: 'column',
    gap: 6,
  },
  mobileTabRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 4,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  hiddenOnMobile: {
    display: 'none',
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 12,
    backgroundColor: 'transparent',
  },
  navItemActive: {
    backgroundColor: Colors.primaryLight,
  },
  navItemPressed: {
    opacity: 0.8,
  },
  navItemIconContainer: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  navItemTextActive: {
    fontWeight: '600',
    color: Colors.primary,
  },
  sidebarFooter: {
    marginTop: 'auto',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  factoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: Colors.background,
    borderRadius: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.above,
  },
  factoryName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  factoryMeta: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  contentContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    height: '100%',
  },
});
