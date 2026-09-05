import { Tabs } from 'expo-router';
import React from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions, Platform } from 'react-native';
import { Colors } from '@/constants/colors';
import { HomeIcon, MoneyIcon, PlusIcon, ChartIcon, LeafIcon } from '@/components/ui-icons';

interface CustomTabBarProps {
  state: {
    index: number;
    routes: Array<{ key: string; name: string }>;
  };
  navigation: {
    emit: (event: { type: string; target: string; canPreventDefault: boolean }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
}

function CustomTabBar({ state, navigation }: CustomTabBarProps) {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  const tabRoutes = [
    { name: 'index', label: 'Dashboard', icon: HomeIcon },
    { name: 'price-input', label: 'Weekly Price Input', icon: MoneyIcon },
    { name: 'bulk-creation', label: 'Bulk Creation', icon: PlusIcon },
    { name: 'reports', label: 'Reports', icon: ChartIcon },
  ];

  return (
    <View style={[styles.tabBarContainer, isDesktop ? styles.sidebarContainer : styles.bottomBarContainer]}>
      {/* Brand Header for Desktop Sidebar */}
      {isDesktop && (
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <LeafIcon color="#FFFFFF" size={20} />
          </View>
          <View>
            <Text style={styles.brandTitle}>Green Valley</Text>
            <Text style={styles.brandSubtitle}>Tea Factory ERP</Text>
          </View>
        </View>
      )}

      {isDesktop && <Text style={styles.sectionLabel}>MAIN MENU</Text>}

      <View style={[styles.navItemsGroup, isDesktop ? styles.desktopNavGroup : styles.mobileNavGroup]}>
        {tabRoutes.map((tab) => {
          const routeObj = state.routes.find((r: { name: string }) => r.name === tab.name);
          const routeIndex = state.routes.findIndex((r: { name: string }) => r.name === tab.name);
          const isFocused = state.index === routeIndex;
          const IconComponent = tab.icon;
          const iconColor = isFocused ? Colors.primary : Colors.textSecondary;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: routeObj?.key || tab.name,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(tab.name);
            }
          };

          return (
            <Pressable
              key={tab.name}
              onPress={onPress}
              style={({ pressed }) => [
                styles.navItem,
                isDesktop ? styles.desktopNavItem : styles.mobileNavItem,
                isFocused && styles.navItemActive,
                pressed && { opacity: 0.8 },
              ]}>
              <IconComponent color={iconColor} size={isDesktop ? 18 : 20} />
              <Text style={[styles.navItemText, isFocused && styles.navItemTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Factory Footer Card on Desktop Sidebar */}
      {isDesktop && (
        <View style={styles.sidebarFooter}>
          <View style={styles.factoryCard}>
            <View style={styles.statusDot} />
            <View>
              <Text style={styles.factoryName}>Plantation No. 4</Text>
              <Text style={styles.factoryMeta}>Week 29 Active</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

export default function DashboardLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  return (
    <Tabs
      tabBar={(props: any) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // The navigator lays the bar and the screens out along one axis:
        // 'bottom' gives a column (bar under the content), 'left' gives a row
        // (bar beside it). A sidebar needs the row, otherwise the bar and the
        // screen area compete for the same vertical space.
        tabBarPosition: isDesktop ? 'left' : 'bottom',
      }}>
      <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="price-input" options={{ title: 'Weekly Price Input' }} />
      <Tabs.Screen name="bulk-creation" options={{ title: 'Bulk Creation' }} />
      <Tabs.Screen name="reports" options={{ title: 'Reports' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    backgroundColor: '#FFFFFF',
    borderColor: Colors.border,
    zIndex: 50,
  },
  sidebarContainer: {
    width: 250,
    // No explicit height: as a row-flex child the sidebar already stretches to
    // full height. Setting height:'100%' made it claim the whole column and
    // collapsed the screen area to zero.
    borderRightWidth: 1,
    paddingVertical: 24,
    paddingHorizontal: 16,
    justifyContent: 'flex-start',
  },
  bottomBarContainer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    justifyContent: 'space-around',
    alignItems: 'center',
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
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  brandSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  navItemsGroup: {},
  desktopNavGroup: {
    flexDirection: 'column',
    gap: 6,
  },
  mobileNavGroup: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flex: 1,
  },
  navItem: {
    alignItems: 'center',
    borderRadius: 10,
  },
  desktopNavItem: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 12,
  },
  mobileNavItem: {
    flexDirection: 'column',
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 4,
  },
  navItemActive: {
    backgroundColor: Colors.primaryLight,
  },
  navItemText: {
    fontSize: 13,
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
});
