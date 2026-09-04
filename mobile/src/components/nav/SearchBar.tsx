import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOW } from '../../constants/theme';
import { formatDistance } from '../../services/navigation';
import type { DistanceUnits, Place } from '../../types';

interface SearchBarProps {
  onSearch: (query: string) => Promise<Place[]>;
  onSelect: (place: Place) => void;
  onOpenPrefs: () => void;
  units: DistanceUnits;
}

export function SearchBar({ onSearch, onSelect, onOpenPrefs, units }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(
    (text: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (text.trim().length < 2) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      debounceRef.current = setTimeout(async () => {
        const places = await onSearch(text);
        setResults(places);
        setLoading(false);
      }, 350);
    },
    [onSearch]
  );

  const handleChange = (text: string) => {
    setQuery(text);
    runSearch(text);
  };

  const handleSelect = (place: Place) => {
    setQuery(place.name);
    setResults([]);
    setFocused(false);
    onSelect(place);
  };

  const clear = () => {
    setQuery('');
    setResults([]);
  };

  const showResults = focused && (loading || results.length > 0);

  return (
    <View style={styles.wrapper}>
      <View style={styles.barRow}>
        <View style={styles.bar}>
          <Ionicons name="search" size={18} color={COLORS.textSecondary} />
          <TextInput
            value={query}
            onChangeText={handleChange}
            onFocus={() => setFocused(true)}
            placeholder="Where to?"
            placeholderTextColor={COLORS.textMuted}
            style={styles.input}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length > 0 ? (
            <TouchableOpacity onPress={clear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity style={styles.prefsButton} onPress={onOpenPrefs} accessibilityLabel="Map settings">
          <Ionicons name="options-outline" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {showResults ? (
        <View style={styles.results}>
          {loading && results.length === 0 ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.loadingText}>Searching…</Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.resultRow} onPress={() => handleSelect(item)}>
                  <View style={styles.resultIcon}>
                    <Ionicons name="location" size={16} color={COLORS.primary} />
                  </View>
                  <View style={styles.resultText}>
                    <Text style={styles.resultName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.resultAddress} numberOfLines={1}>
                      {item.address}
                    </Text>
                  </View>
                  {item.distanceMeters != null ? (
                    <Text style={styles.resultDistance}>
                      {formatDistance(item.distanceMeters, units)}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  bar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    height: 48,
    gap: SPACING.sm,
    ...SHADOW.md,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.medium,
    padding: 0,
  },
  prefsButton: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.md,
  },
  results: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    maxHeight: 280,
    ...SHADOW.lg,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
  },
  loadingText: { color: COLORS.textSecondary, fontSize: FONTS.size.sm },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  resultIcon: {
    width: 32,
    height: 32,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultText: { flex: 1 },
  resultName: {
    color: COLORS.text,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.semibold,
  },
  resultAddress: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.xs,
    marginTop: 1,
  },
  resultDistance: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.semibold,
    fontFamily: FONTS.family.mono,
  },
});
