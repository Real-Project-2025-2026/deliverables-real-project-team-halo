import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ListRenderItem,
  ViewStyle,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SuggestionItem, SuggestionItemSkeleton } from './suggestion-item';
import { spacing, colors, typography, radii } from '@/constants/design-tokens';
import type { GeocodedAddress } from '@/services/geocoding-service';

type SuggestionListState = 'idle' | 'loading' | 'results' | 'empty' | 'error';

interface SuggestionListProps {
  /** Array der Suchergebnisse */
  suggestions: GeocodedAddress[];
  /** Aktueller State */
  state: SuggestionListState;
  /** Callback beim Auswählen einer Suggestion */
  onSelectSuggestion: (suggestion: GeocodedAddress) => void;
  /** Suchbegriff für Empty-State-Message */
  searchQuery?: string;
  /** Container-Style Override */
  style?: ViewStyle;
  /** Anzahl der Skeleton-Items während Loading */
  skeletonCount?: number;
}

/**
 * SuggestionList
 * 
 * Container-Komponente für Adress-Vorschläge.
 * Zeigt verschiedene States: loading (skeleton), results, empty, error.
 */
export function SuggestionList({
  suggestions,
  state,
  onSelectSuggestion,
  searchQuery = '',
  style,
  skeletonCount = 4,
}: SuggestionListProps) {
  
  // Render einzelner Suggestion Item
  const renderItem: ListRenderItem<GeocodedAddress> = ({ item, index }) => (
    <SuggestionItem
      title={item.name || item.formattedAddress.split(',')[0]}
      subtitle={item.formattedAddress}
      onPress={() => onSelectSuggestion(item)}
      index={index}
    />
  );

  // Keyboard extractor
  const keyExtractor = (item: GeocodedAddress, index: number) => 
    `${item.latitude}-${item.longitude}-${index}`;

  // Render Loading State (Skeletons)
  if (state === 'loading') {
    return (
      <Animated.View 
        entering={FadeIn.duration(150)} 
        style={[styles.container, style]}
      >
        <View style={styles.skeletonList}>
          {Array.from({ length: skeletonCount }).map((_, index) => (
            <SuggestionItemSkeleton key={index} index={index} />
          ))}
        </View>
      </Animated.View>
    );
  }

  // Render Empty State
  if (state === 'empty') {
    return (
      <Animated.View 
        entering={FadeIn.duration(200)} 
        exiting={FadeOut.duration(150)}
        style={[styles.container, styles.emptyContainer, style]}
      >
        <View style={styles.emptyIconContainer}>
          <IconSymbol name="magnifyingglass" size={28} color={colors.neutral[300]} />
        </View>
        <Text style={styles.emptyTitle}>Keine Ergebnisse</Text>
        <Text style={styles.emptySubtitle}>
          {searchQuery.length > 0 
            ? `Keine Adressen gefunden für "${searchQuery}"`
            : 'Gib einen Suchbegriff ein, um Adressen zu finden'}
        </Text>
      </Animated.View>
    );
  }

  // Render Error State
  if (state === 'error') {
    return (
      <Animated.View 
        entering={FadeIn.duration(200)} 
        style={[styles.container, styles.errorContainer, style]}
      >
        <View style={styles.errorIconContainer}>
          <IconSymbol name="exclamationmark.triangle.fill" size={28} color={colors.error.main} />
        </View>
        <Text style={styles.errorTitle}>Fehler bei der Suche</Text>
        <Text style={styles.errorSubtitle}>
          Bitte überprüfe deine Internetverbindung und versuche es erneut.
        </Text>
      </Animated.View>
    );
  }

  // Render Idle State (vor der Suche)
  if (state === 'idle') {
    return (
      <Animated.View 
        entering={FadeIn.duration(200)} 
        style={[styles.container, styles.idleContainer, style]}
      >
        <View style={styles.idleIconContainer}>
          <IconSymbol name="location.magnifyingglass" size={32} color={colors.neutral[300]} />
        </View>
        <Text style={styles.idleTitle}>Wohin möchtest du?</Text>
        <Text style={styles.idleSubtitle}>
          Gib eine Adresse, einen Ort oder eine Sehenswürdigkeit ein.
        </Text>
      </Animated.View>
    );
  }

  // Render Results
  return (
    <Animated.View 
      entering={FadeIn.duration(200)} 
      style={[styles.container, style]}
    >
      {/* Ergebnis-Header */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsTitle}>Suchergebnisse</Text>
        <Text style={styles.resultsCount}>{suggestions.length} gefunden</Text>
      </View>
      
      {/* Ergebnis-Liste */}
      <FlatList
        data={suggestions}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  // Loading Skeleton Styles
  skeletonList: {
    paddingTop: spacing.sm,
  },
  
  // Results Styles
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  
  resultsTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.text.tertiary,
    letterSpacing: typography.letterSpacing.wide,
    textTransform: 'uppercase',
  },
  
  resultsCount: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.text.disabled,
  },
  
  listContent: {
    paddingBottom: spacing['3xl'],
  },
  
  separator: {
    height: spacing.xs,
  },
  
  // Empty State Styles
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing['5xl'],
  },
  
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: radii.xl,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  
  emptyTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  
  emptySubtitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.regular,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: typography.size.base * typography.lineHeight.relaxed,
  },
  
  // Error State Styles
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing['5xl'],
  },
  
  errorIconContainer: {
    width: 64,
    height: 64,
    borderRadius: radii.xl,
    backgroundColor: colors.error.light,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  
  errorTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  
  errorSubtitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.regular,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: typography.size.base * typography.lineHeight.relaxed,
  },
  
  // Idle State Styles
  idleContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing['5xl'],
  },
  
  idleIconContainer: {
    width: 72,
    height: 72,
    borderRadius: radii['2xl'],
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  
  idleTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
    letterSpacing: typography.letterSpacing.tight,
  },
  
  idleSubtitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.regular,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: typography.size.base * typography.lineHeight.relaxed,
  },
});

export default SuggestionList;

