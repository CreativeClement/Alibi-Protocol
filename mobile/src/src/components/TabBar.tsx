import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';

interface Tab {
  id: string;
  label: string;
  icon: string;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export const TabBar = React.memo(function TabBar({ tabs, activeTab, onTabChange }: TabBarProps) {
  return (
    <View style={styles.container}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.id}
          style={[
            styles.tab,
            activeTab === tab.id && styles.activeTab,
          ]}
          onPress={() => onTabChange(tab.id)}
          activeOpacity={0.7}
          testID={`tab-${tab.id.toLowerCase()}`}
        >
          <Text style={styles.icon}>{tab.icon}</Text>
          <Text
            style={[
              styles.label,
              activeTab === tab.id && styles.activeLabel,
            ]}
          >
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingBottom: SPACING.md,
    paddingTop: SPACING.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  icon: {
    fontSize: 24,
    marginBottom: SPACING.xs,
  },
  label: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weight.medium,
  },
  activeLabel: {
    color: COLORS.primary,
  },
});
