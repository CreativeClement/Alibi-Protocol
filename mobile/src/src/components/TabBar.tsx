import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';

interface Tab {
  id: string;
  label: string;
  /** Base Ionicons name; the filled variant is used when active. */
  icon: keyof typeof Ionicons.glyphMap;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export const TabBar = React.memo(function TabBar({ tabs, activeTab, onTabChange }: TabBarProps) {
  return (
    <View style={styles.container}>
      {/* Separator line */}
      <View style={styles.separator} />

      <View style={styles.inner}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          // Use filled icon for active, outline for inactive
          const iconName = (isActive
            ? tab.icon
            : (`${tab.icon}-outline` as keyof typeof Ionicons.glyphMap));

          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tab}
              onPress={() => onTabChange(tab.id)}
              activeOpacity={0.65}
              testID={`tab-${tab.id.toLowerCase()}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
            >
              {/* Icon container — pill highlight when active */}
              <View style={[styles.iconContainer, isActive && styles.iconContainerActive]}>
                <Ionicons
                  name={iconName}
                  size={20}
                  color={isActive ? COLORS.primary : COLORS.textMuted}
                />
              </View>

              {/* Label */}
              <Text
                style={[styles.label, isActive && styles.labelActive]}
                numberOfLines={1}
              >
                {tab.label.toUpperCase()}
              </Text>

              {/* Active dot indicator */}
              {isActive && <View style={styles.activeDot} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  inner: {
    flexDirection: 'row',
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    paddingHorizontal: SPACING.xs,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 2,
    gap: 3,
  },
  iconContainer: {
    width: 44,
    height: 28,
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainerActive: {
    backgroundColor: COLORS.primaryMuted,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  label: {
    fontSize: 9,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
  },
  labelActive: {
    color: COLORS.primary,
  },
  activeDot: {
    width: 3,
    height: 3,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primary,
    marginTop: 1,
  },
});
