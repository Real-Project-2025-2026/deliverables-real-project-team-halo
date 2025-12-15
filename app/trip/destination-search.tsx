/**
 * Destination Search Screen
 * 
 * Redesigned "Plan your trip" screen mit modernem, Airbnb-inspiriertem Design.
 * Fullscreen-Suche mit Start-Feld (read-only) und Ziel-Suchfeld.
 * 
 * UX-States:
 * - idle: Vor der Eingabe
 * - typing: Während der Eingabe
 * - loading: Während der Suche
 * - results: Ergebnisse werden angezeigt
 * - selected: Ziel wurde ausgewählt
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Keyboard,
  Platform,
  StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, SlideInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

// Services
import { searchAddresses, reverseGeocode, type GeocodedAddress } from '@/services/geocoding-service';
import { useLocation } from '@/hooks/use-location';

// Design Tokens
import { spacing, colors, radii, shadows } from '@/constants/design-tokens';

// Components
import {
  TripPlannerHeader,
  LocationField,
  DestinationSearchField,
  SuggestionList,
  PrimaryButton,
} from '@/components/trip-planner';

type SearchState = 'idle' | 'loading' | 'results' | 'empty' | 'error';

export default function DestinationSearchScreen() {
  // Location Hook
  const { getCurrentLocation, requestPermission } = useLocation();
  
  // State
  const [origin, setOrigin] = useState<GeocodedAddress | null>(null);
  const [destination, setDestination] = useState<GeocodedAddress | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodedAddress[]>([]);
  const [searchState, setSearchState] = useState<SearchState>('idle');
  const [isLoadingOrigin, setIsLoadingOrigin] = useState(true);
  const [isInputFocused, setIsInputFocused] = useState(false);
  
  // Refs
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Computed
  const hasDestination = destination !== null;
  const showCTA = hasDestination;
  
  // Initialize: Get current location as origin
  useEffect(() => {
    const initOrigin = async () => {
      setIsLoadingOrigin(true);
      
      const hasPermission = await requestPermission();
      if (!hasPermission) {
        setIsLoadingOrigin(false);
        return;
      }
      
      const location = await getCurrentLocation();
      if (location?.coords) {
        const { data } = await reverseGeocode(
          location.coords.latitude,
          location.coords.longitude
        );
        
        if (data) {
          setOrigin(data);
        }
      }
      
      setIsLoadingOrigin(false);
    };
    
    initOrigin();
  }, [getCurrentLocation, requestPermission]);
  
  // Debounced search
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Reset if query too short
    if (searchQuery.trim().length < 2) {
      if (searchQuery.length === 0) {
        setSearchState('idle');
      }
      setSearchResults([]);
      return;
    }
    
    // Start loading
    setSearchState('loading');
    
    // Debounced search
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const { data, error } = await searchAddresses(searchQuery);
        
        if (error) {
          setSearchState('error');
          setSearchResults([]);
          return;
        }
        
        if (data && data.length > 0) {
          setSearchResults(data);
          setSearchState('results');
        } else {
          setSearchResults([]);
          setSearchState('empty');
        }
      } catch {
        setSearchState('error');
        setSearchResults([]);
      }
    }, 350);
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);
  
  // Handlers
  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    router.back();
  }, []);
  
  const handleSelectSuggestion = useCallback((suggestion: GeocodedAddress) => {
    // Haptic feedback
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    setDestination(suggestion);
    setSearchQuery(suggestion.name || suggestion.formattedAddress.split(',')[0]);
    setSearchState('idle');
    setSearchResults([]);
    Keyboard.dismiss();
  }, []);
  
  const handleClearDestination = useCallback(() => {
    setDestination(null);
    setSearchQuery('');
    setSearchState('idle');
    setSearchResults([]);
  }, []);
  
  const handleContinue = useCallback(() => {
    if (!destination || !origin) return;
    
    // Haptic feedback
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    
    // Navigate back to Home and open Trip Planning Overlay with data
    router.replace({
      pathname: '/(tabs)',
      params: {
        openTripOverlay: 'true',
        // Pass destination info
        destinationName: destination.name,
        destinationAddress: destination.formattedAddress,
        destinationLat: destination.latitude.toString(),
        destinationLng: destination.longitude.toString(),
        // Pass origin info
        originName: origin.name,
        originAddress: origin.formattedAddress,
        originLat: origin.latitude.toString(),
        originLng: origin.longitude.toString(),
      },
    });
  }, [destination, origin]);
  
  const handleInputFocus = useCallback(() => {
    setIsInputFocused(true);
    // Clear destination when starting new search
    if (destination) {
      setDestination(null);
      setSearchQuery('');
      setSearchState('idle');
    }
  }, [destination]);
  
  const handleInputBlur = useCallback(() => {
    setIsInputFocused(false);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <TripPlannerHeader
        title="Plan your trip"
        subtitle="Wähle dein Ziel"
        onClose={handleClose}
      />
      
      {/* Route Card */}
      <Animated.View 
        entering={FadeIn.duration(300).delay(100)}
        style={styles.routeCard}
      >
        {/* Origin Field (Read-only) */}
        <LocationField
          variant="origin"
          label="Start"
          placeholder="Standort wird ermittelt..."
          value={origin?.formattedAddress}
          state={isLoadingOrigin ? 'loading' : origin ? 'selected' : 'idle'}
          readOnly
        />
        
        {/* Route Line Connector */}
        <View style={styles.routeLineContainer}>
          <View style={styles.routeLine} />
        </View>
        
        {/* Destination Search Field */}
        {hasDestination ? (
          <LocationField
            variant="destination"
            label="Ziel"
            placeholder="Wohin möchtest du?"
            value={destination.name || destination.formattedAddress}
            state="selected"
            onPress={handleClearDestination}
            onClear={handleClearDestination}
          />
        ) : (
          <DestinationSearchField
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Adresse, Ort oder POI"
            label="Ziel"
            autoFocus
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            onClear={handleClearDestination}
          />
        )}
      </Animated.View>
      
      {/* Suggestions List */}
      <Animated.View 
        entering={FadeIn.duration(200).delay(200)}
        style={styles.suggestionsContainer}
      >
        {!hasDestination && (
          <SuggestionList
            suggestions={searchResults}
            state={searchState}
            onSelectSuggestion={handleSelectSuggestion}
            searchQuery={searchQuery}
          />
        )}
      </Animated.View>
      
      {/* CTA Button */}
      {showCTA && (
        <Animated.View 
          entering={SlideInDown.duration(300).springify()}
          exiting={FadeOut.duration(150)}
          style={styles.ctaContainer}
        >
          <PrimaryButton
            label="Weiter"
            icon="arrow.right"
            onPress={handleContinue}
            disabled={!destination || !origin}
          />
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  
  routeCard: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    backgroundColor: colors.neutral[0],
    borderRadius: radii['2xl'],
    padding: spacing.lg,
    ...shadows.lg,
  },
  
  routeLineContainer: {
    paddingLeft: spacing['3xl'] + spacing.sm,
    marginVertical: -spacing.sm,
  },
  
  routeLine: {
    width: 2,
    height: spacing['2xl'],
    backgroundColor: colors.trip.route,
    borderRadius: radii.full,
  },
  
  suggestionsContainer: {
    flex: 1,
    marginTop: spacing.md,
  },
  
  ctaContainer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? spacing['3xl'] : spacing.xl,
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
});

