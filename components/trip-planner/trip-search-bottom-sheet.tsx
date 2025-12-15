/**
 * TripSearchBottomSheet
 * 
 * Airbnb-like Bottom Sheet für die Trip-Suche.
 * Kann auf dem Home Screen verwendet werden für schnellen Zugang.
 */

import React, { useState, useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Keyboard,
  Platform,
  TouchableOpacity,
} from 'react-native';
import BottomSheet, { 
  BottomSheetTextInput, 
  BottomSheetFlatList,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

// Services
import { searchAddresses, type GeocodedAddress } from '@/services/geocoding-service';

// Design Tokens
import { spacing, colors, typography, radii, shadows, touchTargets } from '@/constants/design-tokens';

// Components
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SuggestionItem, SuggestionItemSkeleton } from './suggestion-item';

type SearchState = 'idle' | 'loading' | 'results' | 'empty';

export interface TripSearchBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface TripSearchBottomSheetProps {
  /** Origin address (already set) */
  originAddress?: string;
  /** Callback when destination is selected */
  onSelectDestination: (destination: GeocodedAddress) => void;
  /** Callback when closed */
  onClose?: () => void;
}

/**
 * TripSearchBottomSheet
 * 
 * Bottom-Sheet-Variante des Trip Planners.
 * Öffnet sich über dem Hauptinhalt mit Backdrop.
 */
export const TripSearchBottomSheet = forwardRef<TripSearchBottomSheetRef, TripSearchBottomSheetProps>(
  ({ originAddress, onSelectDestination, onClose }, ref) => {
    const sheetRef = useRef<BottomSheet>(null);
    
    // State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<GeocodedAddress[]>([]);
    const [searchState, setSearchState] = useState<SearchState>('idle');
    
    // Refs
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    // Snap Points
    const snapPoints = ['75%', '95%'];
    
    // Imperative Handle
    useImperativeHandle(ref, () => ({
      open: () => {
        sheetRef.current?.snapToIndex(0);
      },
      close: () => {
        sheetRef.current?.close();
      },
    }));
    
    // Debounced search
    useEffect(() => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      
      if (searchQuery.trim().length < 2) {
        setSearchState('idle');
        setSearchResults([]);
        return;
      }
      
      setSearchState('loading');
      
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const { data, error } = await searchAddresses(searchQuery);
          
          if (error || !data) {
            setSearchResults([]);
            setSearchState('empty');
            return;
          }
          
          if (data.length > 0) {
            setSearchResults(data);
            setSearchState('results');
          } else {
            setSearchResults([]);
            setSearchState('empty');
          }
        } catch {
          setSearchResults([]);
          setSearchState('empty');
        }
      }, 350);
      
      return () => {
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current);
        }
      };
    }, [searchQuery]);
    
    // Handlers
    const handleSheetChange = useCallback((index: number) => {
      if (index === -1) {
        onClose?.();
        setSearchQuery('');
        setSearchResults([]);
        setSearchState('idle');
      }
    }, [onClose]);
    
    const handleSelectSuggestion = useCallback((suggestion: GeocodedAddress) => {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      
      onSelectDestination(suggestion);
      sheetRef.current?.close();
    }, [onSelectDestination]);
    
    const handleClearSearch = useCallback(() => {
      setSearchQuery('');
      setSearchResults([]);
      setSearchState('idle');
    }, []);
    
    // Render Backdrop
    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.4}
        />
      ),
      []
    );
    
    // Render Suggestion Item
    const renderItem = useCallback(
      ({ item, index }: { item: GeocodedAddress; index: number }) => (
        <SuggestionItem
          title={item.name || item.formattedAddress.split(',')[0]}
          subtitle={item.formattedAddress}
          onPress={() => handleSelectSuggestion(item)}
          index={index}
        />
      ),
      [handleSelectSuggestion]
    );
    
    // Render Loading Skeletons
    const renderLoading = () => (
      <View style={styles.skeletonContainer}>
        {Array.from({ length: 5 }).map((_, index) => (
          <SuggestionItemSkeleton key={index} index={index} />
        ))}
      </View>
    );
    
    // Render Empty State
    const renderEmpty = () => (
      <Animated.View entering={FadeIn.duration(200)} style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <IconSymbol name="magnifyingglass" size={24} color={colors.neutral[300]} />
        </View>
        <Text style={styles.emptyText}>Keine Ergebnisse gefunden</Text>
      </Animated.View>
    );
    
    // Render Idle State
    const renderIdle = () => (
      <Animated.View entering={FadeIn.duration(200)} style={styles.idleContainer}>
        <View style={styles.idleIcon}>
          <IconSymbol name="location.magnifyingglass" size={28} color={colors.neutral[300]} />
        </View>
        <Text style={styles.idleTitle}>Wohin geht's?</Text>
        <Text style={styles.idleSubtitle}>
          Gib eine Adresse oder einen Ort ein
        </Text>
      </Animated.View>
    );

    return (
      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        onChange={handleSheetChange}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.handleIndicator}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Wohin möchtest du?</Text>
          </View>
          
          {/* Origin Display */}
          {originAddress && (
            <View style={styles.originContainer}>
              <View style={styles.originDot} />
              <Text style={styles.originText} numberOfLines={1}>
                Von: {originAddress}
              </Text>
            </View>
          )}
          
          {/* Search Input */}
          <View style={styles.searchContainer}>
            <View style={styles.searchInputWrapper}>
              <View style={styles.destinationDot} />
              <BottomSheetTextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Ziel suchen..."
                placeholderTextColor={colors.text.disabled}
                autoFocus
                returnKeyType="search"
                autoCorrect={false}
                spellCheck={false}
                autoComplete="off"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity 
                  onPress={handleClearSearch}
                  style={styles.clearButton}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <IconSymbol name="xmark.circle.fill" size={20} color={colors.neutral[400]} />
                </TouchableOpacity>
              )}
            </View>
          </View>
          
          {/* Results */}
          {searchState === 'loading' && renderLoading()}
          
          {searchState === 'empty' && renderEmpty()}
          
          {searchState === 'idle' && renderIdle()}
          
          {searchState === 'results' && (
            <BottomSheetFlatList
              data={searchResults}
              renderItem={renderItem}
              keyExtractor={(item, index) => `${item.latitude}-${item.longitude}-${index}`}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.listContent}
            />
          )}
        </View>
      </BottomSheet>
    );
  }
);

TripSearchBottomSheet.displayName = 'TripSearchBottomSheet';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  sheetBackground: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: radii['3xl'],
    borderTopRightRadius: radii['3xl'],
  },
  
  handleIndicator: {
    backgroundColor: colors.neutral[300],
    width: 36,
    height: 4,
  },
  
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  
  headerTitle: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
    letterSpacing: typography.letterSpacing.tight,
  },
  
  originContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  
  originDot: {
    width: 10,
    height: 10,
    borderRadius: radii.full,
    backgroundColor: colors.trip.origin,
    marginRight: spacing.md,
  },
  
  originText: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.text.tertiary,
  },
  
  searchContainer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[100],
    borderRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    height: touchTargets.large,
    ...shadows.sm,
  },
  
  destinationDot: {
    width: 12,
    height: 12,
    borderRadius: radii.full,
    backgroundColor: colors.trip.destination,
    marginRight: spacing.md,
  },
  
  searchInput: {
    flex: 1,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    color: colors.text.primary,
    padding: 0,
  },
  
  clearButton: {
    width: touchTargets.min,
    height: touchTargets.min,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  listContent: {
    paddingBottom: spacing['4xl'],
  },
  
  skeletonContainer: {
    paddingTop: spacing.md,
  },
  
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing['5xl'],
  },
  
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radii.xl,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  
  emptyText: {
    fontSize: typography.size.base,
    color: colors.text.tertiary,
  },
  
  idleContainer: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
    paddingHorizontal: spacing['3xl'],
  },
  
  idleIcon: {
    width: 64,
    height: 64,
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
  },
  
  idleSubtitle: {
    fontSize: typography.size.base,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
});

export default TripSearchBottomSheet;

