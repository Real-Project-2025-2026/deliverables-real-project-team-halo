import { GuardianRequestCard } from '@/components/guardian-request-card';
import { MapViewWrapper } from '@/components/map-view-wrapper';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useLocation } from '@/hooks/use-location';
import { useTrip } from '@/hooks/use-trip';
import { useGuardian } from '@/hooks/use-guardian';
import { useAuth } from '@/providers/auth-provider';
import { DUMMY_GUARDIAN_REQUESTS, type GuardianRequest } from '@/types/guardian-request';
import type { GuardianLocation } from '@/services/guardian-service';
import { getGuardiansWithLocations } from '@/services/guardian-service';
import { searchAddresses, reverseGeocode, type GeocodedAddress } from '@/services/geocoding-service';
import { getDirections, formatDistance, formatDuration, type RouteCoordinate } from '@/services/directions-service';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  View, 
  Keyboard, 
  ActivityIndicator, 
  Modal, 
  TextInput,
  FlatList,
  Animated,
  Dimensions,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { BlurView } from 'expo-blur';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function HomeScreen() {
  // Get params from destination-search navigation
  const params = useLocalSearchParams<{
    openTripOverlay?: string;
    originName?: string;
    originAddress?: string;
    originLat?: string;
    originLng?: string;
    destinationName?: string;
    destinationAddress?: string;
    destinationLat?: string;
    destinationLng?: string;
  }>();
  
  const { user, profile } = useAuth();
  const { activeTrip, refreshActiveTrip, startTrip } = useTrip();
  const { guardians } = useGuardian();
  const { location, getCurrentLocation, requestPermission, startWatchingLocation, stopWatchingLocation } = useLocation();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [guardianLocations, setGuardianLocations] = useState<GuardianLocation[]>([]);
  
  // Guardian Requests State (for when someone wants you as their guardian)
  const [guardianRequests, setGuardianRequests] = useState<GuardianRequest[]>(DUMMY_GUARDIAN_REQUESTS);
  
  // Bottom Sheet Tab State
  const [activeTab, setActiveTab] = useState<0 | 1 | 2>(0);
  
  // Trip Planning Overlay State
  const [showTripOverlay, setShowTripOverlay] = useState(false);
  const [activeField, setActiveField] = useState<'origin' | 'destination' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodedAddress[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const bottomSheetPositionAnim = useRef(new Animated.Value(-250)).current;
  
  // Trip Data
  const [origin, setOrigin] = useState<GeocodedAddress | null>(null);
  const [destination, setDestination] = useState<GeocodedAddress | null>(null);
  const [checkinInterval, setCheckinInterval] = useState<number | 'custom'>(5);
  const [customIntervalValue, setCustomIntervalValue] = useState<number>(15);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [selectedGuardians, setSelectedGuardians] = useState<string[]>([]);
  const [isStartingTrip, setIsStartingTrip] = useState(false);
  
  // Route data
  const [routeCoordinates, setRouteCoordinates] = useState<RouteCoordinate[]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  
  // Keyboard state
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Bottom sheet snap points
  const snapPoints = useMemo(() => ['25%', '50%', '85%'], []);
  const intervals: (number | 'custom')[] = [3, 5, 10, 'custom'];

  // Open Trip Overlay when navigated from destination-search with params
  useEffect(() => {
    if (params.openTripOverlay === 'true' && params.destinationLat && params.destinationLng) {
      // Set origin from params
      if (params.originLat && params.originLng) {
        setOrigin({
          name: params.originName || params.originAddress || '',
          address: params.originAddress || '',
          formattedAddress: params.originAddress || '',
          latitude: parseFloat(params.originLat),
          longitude: parseFloat(params.originLng),
        });
      }
      
      // Set destination from params
      setDestination({
        name: params.destinationName || params.destinationAddress || '',
        address: params.destinationAddress || '',
        formattedAddress: params.destinationAddress || '',
        latitude: parseFloat(params.destinationLat),
        longitude: parseFloat(params.destinationLng),
      });
      
      // Open overlay immediately
      overlayAnim.setValue(1);
      bottomSheetPositionAnim.setValue(0); // Show bottom sheet in position for route display
      setShowTripOverlay(true);
      setActiveField(null); // No field active, show settings
      
      // Clear params to prevent re-opening on re-render
      router.setParams({
        openTripOverlay: undefined,
        originName: undefined,
        originAddress: undefined,
        originLat: undefined,
        originLng: undefined,
        destinationName: undefined,
        destinationAddress: undefined,
        destinationLat: undefined,
        destinationLng: undefined,
      });
    }
  }, [params, overlayAnim, bottomSheetPositionAnim]);

  // Refresh active trip when screen comes into focus
  // This ensures we show the correct state if user navigated back from active trip screen
  useFocusEffect(
    useCallback(() => {
      refreshActiveTrip().catch((error) => {
        console.error('[Home Screen] Error refreshing active trip on focus:', error);
      });
    }, [refreshActiveTrip])
  );

  // Auto-switch to relevant tab
  useEffect(() => {
    if (guardianRequests.length > 0 && activeTab === 0) {
      setActiveTab(2); // Switch to Guardian Requests tab if there are requests
    } else if (activeTrip && activeTab === 0 && guardianRequests.length === 0) {
      setActiveTab(1); // Switch to Trips tab if user has an active trip
    }
  }, [guardianRequests.length, activeTrip, activeTab]);

  // Request location on mount and start watching
  useEffect(() => {
    const initLocation = async () => {
      const hasPermission = await requestPermission();
      if (hasPermission) {
        // Get initial location
        await getCurrentLocation();
        
        // Start watching location for continuous updates
        startWatchingLocation((newLocation) => {
          // Location will be updated automatically via useLocation hook
          console.log('Location updated:', newLocation.coords);
        });
      }
    };
    initLocation();
    
    // Cleanup on unmount
    return () => {
      stopWatchingLocation();
    };
  }, []);

  // Load Guardian locations
  useEffect(() => {
    const loadGuardianLocations = async () => {
      const { data, error } = await getGuardiansWithLocations();
      if (error) {
        console.error('Error loading Guardian locations:', error);
        return;
      }
      if (data) {
        setGuardianLocations(data);
      }
    };

    loadGuardianLocations();

    // Refresh Guardian locations every 30 seconds
    const interval = setInterval(loadGuardianLocations, 30000);

    return () => clearInterval(interval);
  }, []);

  // Debounced address search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length >= 2) {
      setIsSearching(true);
      searchTimeoutRef.current = setTimeout(async () => {
        const { data, error } = await searchAddresses(searchQuery);
        if (error) {
          setSearchResults([]);
        } else {
          setSearchResults(data || []);
        }
        setIsSearching(false);
      }, 300);
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Load route when origin and destination are set
  useEffect(() => {
    const loadRoute = async () => {
      if (!origin || !destination) {
        setRouteCoordinates([]);
        setRouteInfo(null);
        // Animate bottom sheet up when addresses are cleared
        Animated.timing(bottomSheetPositionAnim, {
          toValue: -250,
          duration: 300,
          useNativeDriver: true,
        }).start();
        return;
      }

      // Animate bottom sheet down when both addresses are set
      Animated.timing(bottomSheetPositionAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();

      setIsLoadingRoute(true);
      const { data, error } = await getDirections(
        { latitude: origin.latitude, longitude: origin.longitude },
        { latitude: destination.latitude, longitude: destination.longitude },
        'driving'
      );

      if (data) {
        setRouteCoordinates(data.coordinates);
        setRouteInfo({
          distance: formatDistance(data.distance),
          duration: formatDuration(data.duration),
        });
      }
      setIsLoadingRoute(false);
    };

    loadRoute();
  }, [origin, destination, bottomSheetPositionAnim]);

  // Track keyboard visibility (no animation - bottom sheet stays in place)
  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardVisible(true);
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  function handleStartTrip() {
    if (activeTrip) {
      router.push('/trip/active');
    }
  }

  // Open Trip Planning Overlay
  const openTripOverlay = useCallback(() => {
    // Set animation value directly to 1 (no animation)
    overlayAnim.setValue(1);
    
    // Set bottom sheet to initial position (high up for typing)
    bottomSheetPositionAnim.setValue(-250);
    
    // Show overlay
    setShowTripOverlay(true);
    setActiveField('destination');
    setSearchQuery('');
    setSearchResults([]);
    
    // Load current location in background AFTER overlay is visible
    setTimeout(async () => {
      try {
        const hasPermission = await requestPermission();
        if (hasPermission) {
          const currentLocation = await getCurrentLocation();
          if (currentLocation?.coords) {
            const { data } = await reverseGeocode(
              currentLocation.coords.latitude,
              currentLocation.coords.longitude
            );
            if (data) {
              setOrigin(data);
            }
          }
        }
      } catch (error) {
        console.log('Error loading location:', error);
      }
    }, 300);
  }, [overlayAnim, bottomSheetPositionAnim, requestPermission, getCurrentLocation]);

  const closeTripOverlay = useCallback(() => {
    Keyboard.dismiss();
    Animated.timing(overlayAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowTripOverlay(false);
      setActiveField(null);
      setSearchQuery('');
      setSearchResults([]);
    });
  }, [overlayAnim]);

  const handleSelectAddress = useCallback((address: GeocodedAddress) => {
    if (activeField === 'origin') {
      setOrigin(address);
    } else {
      setDestination(address);
    }
    setActiveField(null);
    setSearchQuery('');
    setSearchResults([]);
    Keyboard.dismiss();
  }, [activeField]);

  const handleUseCurrentLocation = useCallback(async () => {
    const hasPermission = await requestPermission();
    if (hasPermission) {
      const currentLocation = await getCurrentLocation();
      if (currentLocation?.coords) {
        const { data } = await reverseGeocode(
          currentLocation.coords.latitude,
          currentLocation.coords.longitude
        );
        if (data) {
          setOrigin(data);
          setActiveField(null);
          setSearchQuery('');
          Keyboard.dismiss();
        }
      }
    }
  }, [requestPermission, getCurrentLocation]);

  const handleStartTripAction = useCallback(async () => {
    if (!origin || !destination) {
      Alert.alert('Missing Information', 'Please select both start and destination.');
      return;
    }

    setIsStartingTrip(true);

    const actualInterval = checkinInterval === 'custom' ? customIntervalValue : checkinInterval;

    try {
      const { error } = await startTrip({
        mode: 'interval',
        checkinIntervalMinutes: actualInterval,
        safetogetherEnabled: false,
        originLatitude: origin.latitude,
        originLongitude: origin.longitude,
        originAddress: origin.formattedAddress,
        destinationLatitude: destination.latitude,
        destinationLongitude: destination.longitude,
        destinationAddress: destination.formattedAddress,
        guardianIds: selectedGuardians.length > 0 ? selectedGuardians : undefined,
      });

      if (error) {
        Alert.alert('Error', 'Could not start trip. Please try again.');
        setIsStartingTrip(false);
        return;
      }

      closeTripOverlay();
      router.replace('/trip/active');
    } catch (error) {
      Alert.alert('Error', 'Something went wrong.');
      setIsStartingTrip(false);
    }
  }, [origin, destination, checkinInterval, customIntervalValue, selectedGuardians, startTrip, closeTripOverlay]);

  const toggleGuardian = useCallback((guardianId: string) => {
    setSelectedGuardians((prev) =>
      prev.includes(guardianId) ? prev.filter((id) => id !== guardianId) : [...prev, guardianId]
    );
  }, []);

  const getOtherUser = useCallback(
    (guardian: any) => {
      if (guardian.requester_id === user?.id) {
        return guardian.recipient_profile;
      }
      return guardian.requester_profile;
    },
    [user]
  );

  const handleSheetChanges = useCallback((index: number) => {
    // Sheet position changed
  }, []);

  // Guardian Request Handlers
  const handleAcceptGuardianRequest = useCallback(async (requestId: string) => {
    // TODO: Implement actual API call
    console.log('[Home] Accepting guardian request:', requestId);
    
    // Update local state to remove the request
    setGuardianRequests(prev => prev.filter(r => r.id !== requestId));
    
    // Show success message
    Alert.alert(
      'Guardian-Anfrage angenommen',
      'Du wirst benachrichtigt, wenn der Trip startet.',
      [{ text: 'OK' }]
    );
  }, []);

  const handleDeclineGuardianRequest = useCallback(async (requestId: string) => {
    // TODO: Implement actual API call
    console.log('[Home] Declining guardian request:', requestId);
    
    // Update local state to remove the request
    setGuardianRequests(prev => prev.filter(r => r.id !== requestId));
  }, []);

  const handleLocationButtonPress = useCallback(async () => {
    console.log('Location button pressed, requesting location...');
    const hasPermission = await requestPermission();
    console.log('Permission granted:', hasPermission);
    
    if (hasPermission) {
      // Get fresh location with high accuracy
      const currentLocation = await getCurrentLocation();
      if (currentLocation && currentLocation.coords) {
        const { latitude, longitude, accuracy } = currentLocation.coords;
        console.log('Location updated via button:', {
          latitude,
          longitude,
          accuracy,
        });
        
        // Validate coordinates
        if (latitude && longitude && 
            !isNaN(latitude) && !isNaN(longitude) &&
            latitude !== 0 && longitude !== 0 &&
            latitude >= -90 && latitude <= 90 &&
            longitude >= -180 && longitude <= 180) {
          console.log('Valid location received, map should update');
        } else {
          console.error('Invalid location coordinates:', { latitude, longitude });
        }
      } else {
        console.warn('Failed to get current location or location is null');
      }
    } else {
      console.warn('Location permission denied');
    }
  }, [requestPermission, getCurrentLocation]);

  // Render avatar
  const renderAvatar = () => {
    const firstLetter = (profile?.username || profile?.full_name || user?.email || '?')[0].toUpperCase();
    const avatarUrl = profile?.avatar_url;

    if (avatarUrl) {
      return (
        <Image
          source={{ uri: avatarUrl }}
          style={styles.userAvatarImage}
          contentFit="cover"
          transition={200}
        />
      );
    }

    return (
      <View style={[styles.userAvatarContainer, styles.userAvatarPlaceholder]}>
        <Text style={styles.userAvatarText}>{firstLetter}</Text>
      </View>
    );
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Map Background */}
      <MapViewWrapper
        userLocation={
          location && location.coords
            ? {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              }
            : undefined
        }
        userAvatar={profile?.avatar_url || null}
        userName={profile?.full_name || profile?.username || null}
        guardians={guardianLocations.map((g) => ({
          id: g.id,
          latitude: g.latitude,
          longitude: g.longitude,
          avatarUrl: g.avatarUrl,
          username: g.username,
          fullName: g.fullName,
        }))}
      />

      {/* Search Bar - Floating on Map */}
      <View style={styles.searchBar}>
        <TouchableOpacity 
          style={styles.searchTouchable}
          onPress={() => router.push('/trip/destination-search')}
          activeOpacity={0.9}>
          <View style={styles.searchIconContainer}>
            <IconSymbol name="magnifyingglass" size={18} color="#fff" />
          </View>
          <Text style={styles.searchPlaceholder}>Where to?</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.avatarButton}
          onPress={() => router.push('/(tabs)/profile')}
          activeOpacity={0.7}>
          {renderAvatar()}
        </TouchableOpacity>
      </View>

      {/* Quick Trip Chips */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.quickTripsContainer}
        contentContainerStyle={styles.quickTripsContent}>
        <TouchableOpacity style={styles.quickTripChip} activeOpacity={0.8}>
          <Text style={styles.quickTripIcon}>🏠</Text>
          <Text style={styles.quickTripLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickTripChip} activeOpacity={0.8}>
          <Text style={styles.quickTripIcon}>💼</Text>
          <Text style={styles.quickTripLabel}>Work</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickTripChip} activeOpacity={0.8}>
          <Text style={styles.quickTripIcon}>🏋️</Text>
          <Text style={styles.quickTripLabel}>Gym</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickTripChip} activeOpacity={0.8}>
          <Text style={styles.quickTripIcon}>🎓</Text>
          <Text style={styles.quickTripLabel}>School</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickTripChip} activeOpacity={0.8}>
          <Text style={styles.quickTripIcon}>🧘</Text>
          <Text style={styles.quickTripLabel}>Yoga</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Trip Planning Overlay (Airbnb Style) */}
      <Modal
        visible={showTripOverlay}
        transparent
        animationType="none"
        statusBarTranslucent>
        <Animated.View 
          style={[
            styles.overlayContainer,
            {
              opacity: overlayAnim,
            },
          ]}>
          <View style={styles.overlaySafeArea}>
            {/* Map Section (Top 40% of viewport) */}
            <View style={styles.mapSection}>
              {origin && destination ? (
                <>
                  {isLoadingRoute ? (
                    <View style={styles.mapLoadingContainer}>
                      <ActivityIndicator size="large" color="#5170FF" />
                    </View>
                  ) : (
                    <MapViewWrapper
                      userLocation={location?.coords ? {
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                      } : origin ? {
                        latitude: origin.latitude,
                        longitude: origin.longitude,
                      } : undefined}
                      userAvatar={profile?.avatar_url || null}
                      userName={profile?.full_name || profile?.username || null}
                      origin={{
                        latitude: origin.latitude,
                        longitude: origin.longitude,
                      }}
                      destination={{
                        latitude: destination.latitude,
                        longitude: destination.longitude,
                      }}
                      routePoints={routeCoordinates}
                    />
                  )}
                  {routeInfo && (
                    <View style={styles.mapRouteBadge}>
                      <Text style={styles.mapRouteBadgeText}>
                        {routeInfo.distance} • {routeInfo.duration}
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <MapViewWrapper
                  userLocation={location?.coords ? {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                  } : undefined}
                  userAvatar={profile?.avatar_url || null}
                  userName={profile?.full_name || profile?.username || null}
                />
              )}
            </View>

            {/* Bottom Sheet (Modern Airbnb Style) */}
            <Animated.View 
              style={[
                styles.overlayBottomSheet,
                {
                  height: origin && destination ? SCREEN_HEIGHT * 0.48 : SCREEN_HEIGHT * 0.7,
                  transform: [{ translateY: bottomSheetPositionAnim }],
                },
              ]}>
              {/* Handle Indicator */}
              <View style={styles.overlayHandleContainer}>
                <View style={styles.overlayHandle} />
              </View>
              
              <SafeAreaView style={styles.overlaySheetSafeArea} edges={['bottom']}>
                <ScrollView 
                  style={styles.overlaySheetScrollView}
                  contentContainerStyle={styles.overlaySheetScrollContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled">
                  
                  {/* Header */}
                  <View style={styles.overlayHeader}>
                    <TouchableOpacity 
                      style={styles.overlayCloseBtn} 
                      onPress={closeTripOverlay}
                      activeOpacity={0.7}>
                      <IconSymbol name="xmark" size={16} color="#171717" />
                    </TouchableOpacity>
                    <Text style={styles.overlayTitle}>Plan your trip</Text>
                    <View style={styles.overlayHeaderSpacer} />
                  </View>
                  
                  {/* Route Card - Modern Design */}
                  <View style={styles.overlayRouteCard}>
                    {/* Origin Field */}
                    <TouchableOpacity 
                      style={styles.overlayRouteField}
                      onPress={() => {
                        setActiveField('origin');
                        setSearchQuery(origin?.formattedAddress || '');
                        setSearchResults([]);
                      }}
                      activeOpacity={0.7}>
                      <View style={styles.overlayRouteDotContainer}>
                        <View style={styles.overlayRouteDotOrigin}>
                          <View style={styles.overlayRouteDotOriginInner} />
                        </View>
                      </View>
                      <View style={styles.overlayRouteFieldContent}>
                        <Text style={styles.overlayRouteFieldLabel}>Start</Text>
                        {activeField === 'origin' ? (
                          <View style={styles.overlaySearchInputRow}>
                            <TextInput
                              style={styles.overlaySearchInput}
                              placeholder="Standort eingeben"
                              placeholderTextColor="#A3A3A3"
                              value={searchQuery}
                              onChangeText={setSearchQuery}
                              autoFocus
                              autoCorrect={false}
                              spellCheck={false}
                              returnKeyType="search"
                            />
                            {searchQuery.length > 0 && (
                              <TouchableOpacity 
                                onPress={() => setSearchQuery('')}
                                style={styles.overlayClearBtn}>
                                <IconSymbol name="xmark.circle.fill" size={18} color="#A3A3A3" />
                              </TouchableOpacity>
                            )}
                          </View>
                        ) : (
                          <Text style={styles.overlayRouteFieldValue} numberOfLines={1}>
                            {origin ? (origin.name || origin.formattedAddress) : 'Dein Standort'}
                          </Text>
                        )}
                      </View>
                      {!activeField && (
                        <TouchableOpacity style={styles.overlayTargetBtn} onPress={handleUseCurrentLocation}>
                          <IconSymbol name="location.fill" size={16} color="#5170FF" />
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>

                    {/* Route Line Connector */}
                    <View style={styles.overlayRouteLineContainer}>
                      <View style={styles.overlayRouteLine} />
                    </View>

                    {/* Destination Field */}
                    <TouchableOpacity 
                      style={styles.overlayRouteField}
                      onPress={() => {
                        setActiveField('destination');
                        setSearchQuery(destination?.formattedAddress || '');
                        setSearchResults([]);
                      }}
                      activeOpacity={0.7}>
                      <View style={styles.overlayRouteDotContainer}>
                        <View style={styles.overlayRouteDotDestination} />
                      </View>
                      <View style={styles.overlayRouteFieldContent}>
                        <Text style={styles.overlayRouteFieldLabel}>Ziel</Text>
                        {activeField === 'destination' ? (
                          <View style={styles.overlaySearchInputRow}>
                            <TextInput
                              style={styles.overlaySearchInput}
                              placeholder="Wohin?"
                              placeholderTextColor="#A3A3A3"
                              value={searchQuery}
                              onChangeText={setSearchQuery}
                              autoFocus
                              autoCorrect={false}
                              spellCheck={false}
                              returnKeyType="search"
                            />
                            {searchQuery.length > 0 && (
                              <TouchableOpacity 
                                onPress={() => setSearchQuery('')}
                                style={styles.overlayClearBtn}>
                                <IconSymbol name="xmark.circle.fill" size={18} color="#A3A3A3" />
                              </TouchableOpacity>
                            )}
                          </View>
                        ) : (
                          <Text style={styles.overlayRouteFieldValue} numberOfLines={1}>
                            {destination ? (destination.name || destination.formattedAddress) : 'Ziel wählen'}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>

                    {/* Search Results */}
                    {activeField && (isSearching || searchResults.length > 0) && (
                      <View style={styles.overlaySearchResults}>
                        {isSearching ? (
                          <View style={styles.overlaySearchLoading}>
                            <ActivityIndicator size="small" color="#5170FF" />
                          </View>
                        ) : (
                          searchResults.slice(0, 4).map((item, index) => (
                            <TouchableOpacity
                              key={`${item.latitude}-${index}`}
                              style={styles.overlaySearchResultItem}
                              onPress={() => handleSelectAddress(item)}
                              activeOpacity={0.7}>
                              <View style={styles.overlaySearchResultIcon}>
                                <IconSymbol name="mappin" size={14} color="#5170FF" />
                              </View>
                              <View style={styles.overlaySearchResultContent}>
                                <Text style={styles.overlaySearchResultName} numberOfLines={1}>{item.name}</Text>
                                <Text style={styles.overlaySearchResultAddress} numberOfLines={1}>{item.formattedAddress}</Text>
                              </View>
                            </TouchableOpacity>
                          ))
                        )}
                      </View>
                    )}
                  </View>

                  {/* Settings Section */}
                  {!activeField && (
                    <View style={styles.overlaySettingsSection}>
                      {/* Check-in Interval */}
                      <View style={styles.overlaySettingBlock}>
                        <Text style={styles.overlaySettingLabel}>Check-in Intervall</Text>
                        <View style={styles.overlayIntervalRow}>
                          {intervals.map((interval) => (
                            <TouchableOpacity
                              key={interval}
                              style={[
                                styles.overlayIntervalPill,
                                checkinInterval === interval && styles.overlayIntervalPillActive,
                              ]}
                              onPress={() => {
                                if (interval === 'custom') {
                                  setShowCustomPicker(true);
                                } else {
                                  setCheckinInterval(interval);
                                }
                              }}
                              activeOpacity={0.7}>
                              {interval === 'custom' ? (
                                checkinInterval === 'custom' ? (
                                  <Text style={[styles.overlayIntervalText, styles.overlayIntervalTextActive]}>
                                    {customIntervalValue}m
                                  </Text>
                                ) : (
                                  <IconSymbol name="slider.horizontal.3" size={16} color="#737373" />
                                )
                              ) : (
                                <Text style={[
                                  styles.overlayIntervalText,
                                  checkinInterval === interval && styles.overlayIntervalTextActive,
                                ]}>
                                  {interval}m
                                </Text>
                              )}
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>

                      {/* Guardians */}
                      <View style={styles.overlaySettingBlock}>
                        <Text style={styles.overlaySettingLabel}>Benachrichtigen</Text>
                        <View style={styles.overlayGuardiansRow}>
                          {guardians.length === 0 ? (
                            <Text style={styles.overlayNoGuardians}>Keine Guardians hinzugefügt</Text>
                          ) : (
                            guardians.slice(0, 5).map((guardian) => {
                              const otherUser = getOtherUser(guardian);
                              const isSelected = selectedGuardians.includes(otherUser.id);
                              return (
                                <TouchableOpacity
                                  key={guardian.id}
                                  style={styles.overlayGuardianItem}
                                  onPress={() => toggleGuardian(otherUser.id)}
                                  activeOpacity={0.7}>
                                  <View style={[
                                    styles.overlayGuardianAvatarContainer,
                                    isSelected && styles.overlayGuardianAvatarSelected
                                  ]}>
                                    {otherUser.avatar_url ? (
                                      <Image 
                                        source={{ uri: otherUser.avatar_url }} 
                                        style={styles.overlayGuardianAvatar} 
                                      />
                                    ) : (
                                      <View style={styles.overlayGuardianAvatarPlaceholder}>
                                        <Text style={styles.overlayGuardianAvatarText}>
                                          {(otherUser.full_name || otherUser.username || '?')[0].toUpperCase()}
                                        </Text>
                                      </View>
                                    )}
                                    {isSelected && (
                                      <View style={styles.overlayGuardianCheck}>
                                        <IconSymbol name="checkmark" size={10} color="#fff" />
                                      </View>
                                    )}
                                  </View>
                                </TouchableOpacity>
                              );
                            })
                          )}
                        </View>
                      </View>

                      {/* Start Trip Button */}
                      <TouchableOpacity
                        style={[
                          styles.overlayStartBtn,
                          (!origin || !destination) && styles.overlayStartBtnDisabled,
                        ]}
                        onPress={handleStartTripAction}
                        disabled={!origin || !destination || isStartingTrip}
                        activeOpacity={0.85}>
                        {isStartingTrip ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Text style={styles.overlayStartBtnText}>Trip starten</Text>
                            <IconSymbol name="arrow.right" size={18} color="#fff" />
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </ScrollView>
              </SafeAreaView>
            </Animated.View>
          </View>
        </Animated.View>
      </Modal>

      {/* Custom Interval Picker Modal */}
      <Modal
        visible={showCustomPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCustomPicker(false)}>
        <TouchableOpacity
          style={styles.pickerModalOverlay}
          activeOpacity={1}
          onPress={() => {
            setCheckinInterval('custom');
            setShowCustomPicker(false);
          }}>
          <View style={styles.pickerModalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.pickerModalHandle} />
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Check-in Interval</Text>
              <TouchableOpacity
                onPress={() => {
                  setCheckinInterval('custom');
                  setShowCustomPicker(false);
                }}
                style={styles.pickerModalDoneButton}>
                <Text style={styles.pickerModalDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.pickerModalPickerWrapper}>
              <Picker
                selectedValue={customIntervalValue}
                onValueChange={(itemValue) => setCustomIntervalValue(itemValue)}
                style={styles.pickerModalPicker}
                itemStyle={Platform.OS === 'ios' ? styles.pickerModalItemIOS : undefined}>
                {Array.from({ length: 60 }, (_, i) => i + 1).map((value) => (
                  <Picker.Item
                    key={value}
                    label={`${value} minutes`}
                    value={value}
                  />
                ))}
              </Picker>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Location Button - Fixed below Quick Trips */}
      <TouchableOpacity 
        style={styles.locationButton}
        onPress={handleLocationButtonPress}
        activeOpacity={0.9}>
        <IconSymbol name="location.fill" size={18} color="#fff" />
      </TouchableOpacity>

      {/* Bottom Sheet */}
      <BottomSheet
        ref={bottomSheetRef}
        index={1}
        snapPoints={snapPoints}
        onChange={handleSheetChanges}
        enablePanDownToClose={false}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.handleIndicator}>
        <View style={styles.bottomSheetContent}>
          {/* Tab Buttons */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 0 && styles.tabButtonActive]}
              onPress={() => setActiveTab(0)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabButtonText, activeTab === 0 && styles.tabButtonTextActive]}>
                Menü
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 1 && styles.tabButtonActive]}
              onPress={() => setActiveTab(1)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabButtonText, activeTab === 1 && styles.tabButtonTextActive]}>
                Trips
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 2 && styles.tabButtonActive]}
              onPress={() => setActiveTab(2)}
              activeOpacity={0.7}
            >
              {guardianRequests.length > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{guardianRequests.length}</Text>
                </View>
              )}
              <Text style={[styles.tabButtonText, activeTab === 2 && styles.tabButtonTextActive]}>
                Anfragen
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab Content */}
          <BottomSheetScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}>
            
            {/* Tab 0: Menü (Placeholder) */}
            {activeTab === 0 && (
              <View style={styles.tabContent}>
                <Text style={styles.comingSoonText}>Menü-Inhalt kommt später</Text>
              </View>
            )}

            {/* Tab 1: Trips (Active Trip + Guardian Trips + Quick Actions) */}
            {activeTab === 1 && (
              <View style={styles.tabContent}>
                {/* Active Trip Card - Only shown when trip is active */}
                {activeTrip && (
                  <TouchableOpacity style={styles.activeTripCard} onPress={handleStartTrip}>
                    <View style={styles.activeTripBadge}>
                      <View style={styles.pulseDot} />
                      <Text style={styles.activeTripBadgeText}>ACTIVE</Text>
                    </View>
                    <Text style={styles.activeTripTitle}>Your trip is in progress</Text>
                    <View style={styles.activeTripRoute}>
                      <View style={styles.routePoint}>
                        <View style={styles.routeDotGreen} />
                        <Text style={styles.routeText} numberOfLines={1}>
                          {activeTrip.origin_address || 'Starting location'}
                        </Text>
                      </View>
                      <View style={styles.routeLine} />
                      <View style={styles.routePoint}>
                        <View style={styles.routeDotBlue} />
                        <Text style={styles.routeText} numberOfLines={1}>
                          {activeTrip.destination_address || 'Destination'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.activeTripFooter}>
                      <Text style={styles.activeTripTime}>Tap to view details</Text>
                      <IconSymbol name="chevron.right" size={20} color="#5170FF" />
                    </View>
                  </TouchableOpacity>
                )}

                {/* Active Guardian Trips Section */}
                {guardianLocations.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Active Trips</Text>
                    {guardianLocations.slice(0, 3).map((guardian) => (
                      <TouchableOpacity 
                        key={guardian.id}
                        style={styles.guardianCard}
                        onPress={() => router.push(`/guardian-trip/${guardian.id}`)}>
                        <View style={styles.guardianAvatarContainer}>
                          {guardian.avatarUrl ? (
                            <Image 
                              source={{ uri: guardian.avatarUrl }} 
                              style={styles.guardianAvatar}
                              contentFit="cover"
                            />
                          ) : (
                            <View style={styles.guardianAvatarPlaceholder}>
                              <Text style={styles.guardianAvatarText}>
                                {(guardian.fullName || guardian.username || '?')[0].toUpperCase()}
                              </Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.guardianInfo}>
                          <Text style={styles.guardianName}>
                            {guardian.fullName || guardian.username || 'Guardian'}
                          </Text>
                          <View style={styles.guardianStatusRow}>
                            <IconSymbol name="location.fill" size={12} color="#5170FF" />
                            <Text style={styles.guardianStatus}>Currently traveling</Text>
                          </View>
                          <View style={styles.guardianStatusRow}>
                            <IconSymbol name="checkmark.circle.fill" size={12} color="#34C759" />
                            <Text style={styles.guardianTime}>Last check-in: Just now</Text>
                          </View>
                        </View>
                        <IconSymbol name="chevron.right" size={20} color="#999" />
                      </TouchableOpacity>
                    ))}
                    
                    {guardianLocations.length > 3 && (
                      <TouchableOpacity 
                        style={styles.seeAllButton}
                        onPress={() => router.push('/(tabs)/guardian-trips')}>
                        <Text style={styles.seeAllText}>
                          See all {guardianLocations.length} trips
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Quick Actions */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Quick Actions</Text>
                  <View style={styles.quickActionsGrid}>
                    <TouchableOpacity 
                      style={styles.quickActionCard}
                      onPress={() => router.push('/emergency-contacts')}>
                      <View style={[styles.quickActionIcon, { backgroundColor: '#FF3B30' }]}>
                        <IconSymbol name="phone.fill" size={20} color="#fff" />
                      </View>
                      <Text style={styles.quickActionTitle}>Emergency</Text>
                      <Text style={styles.quickActionValue}>Quick access</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.quickActionCard}
                      onPress={() => router.push('/(tabs)/explore')}>
                      <View style={[styles.quickActionIcon, { backgroundColor: '#34C759' }]}>
                        <IconSymbol name="person.2.fill" size={20} color="#fff" />
                      </View>
                      <Text style={styles.quickActionTitle}>Together</Text>
                      <Text style={styles.quickActionValue}>SafeTogether</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* Tab 2: Guardian Requests */}
            {activeTab === 2 && (
              <View style={styles.tabContent}>
                {guardianRequests.length > 0 ? (
                  <View style={styles.guardianRequestsSection}>
                    {guardianRequests.map(request => (
                      <GuardianRequestCard
                        key={request.id}
                        request={request}
                        onAccept={handleAcceptGuardianRequest}
                        onDecline={handleDeclineGuardianRequest}
                      />
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyState}>
                    <IconSymbol name="shield" size={48} color="#999" />
                    <Text style={styles.emptyStateText}>Keine Anfragen</Text>
                    <Text style={styles.emptyStateSubtext}>
                      Du hast aktuell keine Guardian-Anfragen
                    </Text>
                  </View>
                )}
              </View>
            )}
          </BottomSheetScrollView>
        </View>
      </BottomSheet>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Search Bar
  searchBar: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    height: 56,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
    paddingRight: 8,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  searchTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#5170FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  searchPlaceholder: {
    fontSize: 17,
    color: '#999',
    fontWeight: '400',
  },
  // Quick Trip Chips
  quickTripsContainer: {
    position: 'absolute',
    top: 132,
    left: 0,
    right: 0,
    zIndex: 9,
  },
  quickTripsContent: {
    paddingHorizontal: 16,
    gap: 6,
  },
  quickTripChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  quickTripIcon: {
    fontSize: 11,
  },
  quickTripLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#000',
    letterSpacing: -0.2,
  },
  // Location Button
  locationButton: {
    position: 'absolute',
    top: 172,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#5170FF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#5170FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#5170FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  userAvatarPlaceholder: {
    backgroundColor: '#5170FF',
  },
  userAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  bottomSheetBackground: {
    backgroundColor: '#f9f9f9',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handleIndicator: {
    backgroundColor: '#ccc',
    width: 40,
  },
  bottomSheetContent: {
    flex: 1,
  },
  // Tab Styles
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    position: 'relative',
    backgroundColor: 'rgba(81, 112, 255, 0.15)',
  },
  tabButtonActive: {
    backgroundColor: '#5170FF',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5170FF',
  },
  tabButtonTextActive: {
    color: '#fff',
  },
  tabBadge: {
    position: 'absolute',
    top: 6,
    right: 8,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    zIndex: 10,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  tabContent: {
    flex: 1,
  },
  comingSoonText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 40,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
  },
  // Active Trip Card
  activeTripCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: '#5170FF',
    shadowColor: '#5170FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  activeTripBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#5170FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    marginBottom: 14,
    gap: 6,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#B4FF39',
  },
  activeTripBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  activeTripTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  activeTripRoute: {
    marginBottom: 16,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  routeDotGreen: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#34C759',
  },
  routeDotBlue: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#5170FF',
  },
  routeLine: {
    width: 1,
    height: 16,
    backgroundColor: '#E0E0E0',
    marginLeft: 4.5,
    marginVertical: 4,
  },
  routeText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  activeTripFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  activeTripTime: {
    fontSize: 13,
    color: '#5170FF',
    fontWeight: '500',
  },
  // Guardian Requests Section
  guardianRequestsSection: {
    marginBottom: 16,
    marginHorizontal: -20, // Offset the padding from BottomSheetScrollView
  },
  // Section
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  // Guardian Cards (Life360 Style)
  guardianCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  guardianAvatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    overflow: 'hidden',
  },
  guardianAvatar: {
    width: 50,
    height: 50,
  },
  guardianAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#5170FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guardianAvatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  guardianInfo: {
    flex: 1,
  },
  guardianName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 6,
  },
  guardianStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  guardianStatus: {
    fontSize: 13,
    color: '#666',
  },
  guardianTime: {
    fontSize: 12,
    color: '#999',
  },
  seeAllButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5170FF',
  },
  // Quick Actions
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  quickActionValue: {
    fontSize: 12,
    color: '#666',
  },
  // Trip Planning Overlay (Airbnb Style)
  overlayContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  overlaySafeArea: {
    flex: 1,
    paddingTop: 0, // Map goes to top
  },
  // Map Section (Top 55% - floats under bottom sheet)
  mapSection: {
    height: SCREEN_HEIGHT * 0.55,
    position: 'relative',
    zIndex: 1,
  },
  mapLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  mapPlaceholderText: {
    fontSize: 16,
    color: 'rgba(0,0,0,0.4)',
  },
  mapRouteBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    zIndex: 10,
  },
  mapRouteBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  // ============================================================================
  // MODERN OVERLAY BOTTOM SHEET STYLES (Airbnb-inspired)
  // ============================================================================
  overlayBottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FAFAFA',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 16,
    zIndex: 2,
  },
  overlayHandleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  overlayHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#D4D4D4',
    borderRadius: 2,
  },
  overlaySheetSafeArea: {
    flex: 1,
  },
  overlaySheetScrollView: {
    flex: 1,
  },
  overlaySheetScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  overlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 20,
  },
  overlayCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#171717',
    letterSpacing: -0.3,
  },
  overlayHeaderSpacer: {
    width: 44,
  },
  // Route Card
  overlayRouteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  overlayRouteField: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  overlayRouteDotContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  overlayRouteDotOrigin: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayRouteDotOriginInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  overlayRouteDotDestination: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#5170FF',
  },
  overlayRouteFieldContent: {
    flex: 1,
  },
  overlayRouteFieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#737373',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  overlayRouteFieldValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#171717',
    letterSpacing: -0.2,
  },
  overlaySearchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overlaySearchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#171717',
    padding: 0,
    letterSpacing: -0.2,
  },
  overlayClearBtn: {
    padding: 4,
  },
  overlayTargetBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(81, 112, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayRouteLineContainer: {
    paddingLeft: 27,
    marginVertical: -4,
  },
  overlayRouteLine: {
    width: 2,
    height: 20,
    backgroundColor: 'rgba(81, 112, 255, 0.15)',
    borderRadius: 1,
  },
  // Search Results
  overlaySearchResults: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
    paddingTop: 12,
  },
  overlaySearchLoading: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  overlaySearchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  overlaySearchResultIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(81, 112, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  overlaySearchResultContent: {
    flex: 1,
  },
  overlaySearchResultName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#171717',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  overlaySearchResultAddress: {
    fontSize: 13,
    color: '#737373',
    letterSpacing: -0.1,
  },
  // Settings Section
  overlaySettingsSection: {
    gap: 24,
  },
  overlaySettingBlock: {
    gap: 12,
  },
  overlaySettingLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#737373',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  overlayIntervalRow: {
    flexDirection: 'row',
    gap: 10,
  },
  overlayIntervalPill: {
    flex: 1,
    height: 52,
    backgroundColor: '#FFFFFF',
    borderRadius: 26, // Pill shape (height / 2)
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  overlayIntervalPillActive: {
    backgroundColor: '#5170FF',
    shadowColor: '#5170FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  overlayIntervalText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#525252',
  },
  overlayIntervalTextActive: {
    color: '#FFFFFF',
  },
  overlayGuardiansRow: {
    flexDirection: 'row',
    gap: 12,
  },
  overlayNoGuardians: {
    fontSize: 14,
    color: '#A3A3A3',
    fontStyle: 'italic',
  },
  overlayGuardianItem: {
    position: 'relative',
  },
  overlayGuardianAvatarContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  overlayGuardianAvatarSelected: {
    borderColor: '#5170FF',
  },
  overlayGuardianAvatar: {
    width: '100%',
    height: '100%',
  },
  overlayGuardianAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#5170FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayGuardianAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  overlayGuardianCheck: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#5170FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FAFAFA',
  },
  // Start Button
  overlayStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5170FF',
    height: 56,
    borderRadius: 28, // Pill shape (height / 2)
    gap: 8,
    marginTop: 8,
    shadowColor: '#5170FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  overlayStartBtnDisabled: {
    opacity: 0.4,
    shadowOpacity: 0,
  },
  overlayStartBtnText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  // ============================================================================
  // OLD STYLES (keeping for backwards compatibility)
  // ============================================================================
  bottomSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    paddingHorizontal: 4,
  },
  bottomSheetCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(81, 112, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    letterSpacing: -0.3,
  },
  bottomSheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 10,
    height: SCREEN_HEIGHT * 0.5,
    zIndex: 2,
  },
  bottomSheetSafeArea: {
    flex: 1,
  },
  bottomSheetScrollView: {
    flex: 1,
  },
  bottomSheetScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  routeCardBottomSheet: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#5170FF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  // Route Card
  routeCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
  },
  routeField: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  routeFieldActive: {
    backgroundColor: 'rgba(81, 112, 255, 0.04)',
  },
  routeDotOrigin: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#B4FF39',
    marginRight: 16,
  },
  routeDotDestination: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#5170FF',
    marginRight: 16,
  },
  routeFieldContent: {
    flex: 1,
  },
  routeFieldLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(0,0,0,0.4)',
    marginBottom: 2,
  },
  routeFieldValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    letterSpacing: -0.2,
  },
  routeFieldPlaceholder: {
    fontSize: 16,
    color: 'rgba(0,0,0,0.3)',
    letterSpacing: -0.2,
  },
  routeDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginLeft: 46,
  },
  // Inline Search
  inlineSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inlineSearchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    letterSpacing: -0.2,
    paddingVertical: 0,
    marginRight: 8,
  },
  // Current Location in Card
  currentLocationInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  currentLocationDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(81, 112, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  currentLocationTextInCard: {
    fontSize: 15,
    fontWeight: '500',
    color: '#5170FF',
    letterSpacing: -0.2,
  },
  // Results in Card
  resultsDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  loadingInCard: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  resultItemInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  resultItemInCardLast: {
    borderBottomWidth: 0,
  },
  resultIconInCard: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(81, 112, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  resultContentInCard: {
    flex: 1,
  },
  resultNameInCard: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  resultAddressInCard: {
    fontSize: 13,
    color: 'rgba(0,0,0,0.45)',
    letterSpacing: -0.1,
  },
  // Route Preview Card
  // Map Card (Top)
  routePreviewCardTop: {
    marginTop: 12,
    marginBottom: 12,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
    height: 280,
    position: 'relative',
  },
  routePreviewMapTop: {
    flex: 1,
  },
  routeLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  routeInfoBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  routeInfoBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  // Route Card (Below Map)
  routeFieldBelowMap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  routeFieldContentActive: {
    backgroundColor: 'rgba(81, 112, 255, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginLeft: -4,
  },
  routeDotOriginBelowMap: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#000',
    marginRight: 12,
  },
  routeDotDestinationBelowMap: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#34C759',
    marginRight: 12,
  },
  routeFieldContentBelowMap: {
    flex: 1,
  },
  inlineSearchRowBelowMap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineSearchInputBelowMap: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    color: '#000',
    paddingVertical: 0,
  },
  routeFieldValueBelowMap: {
    fontSize: 16,
    fontWeight: '400',
    color: '#000',
  },
  targetButton: {
    padding: 4,
  },
  // Horizontal divider between fields
  routeDividerHorizontal: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginVertical: 8,
    marginLeft: 34, // Start after dot + margin
  },
  currentLocationBelowMap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  currentLocationDotBelowMap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(81, 112, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  currentLocationTextBelowMap: {
    fontSize: 15,
    fontWeight: '400',
    color: '#5170FF',
  },
  // Inline search results (inside route card)
  resultsDividerInline: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginVertical: 8,
    marginHorizontal: -4,
  },
  loadingInline: {
    padding: 12,
    alignItems: 'center',
  },
  resultItemInline: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  resultItemInlineLast: {
    borderBottomWidth: 0,
  },
  resultIconInline: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(81, 112, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  resultContentInline: {
    flex: 1,
  },
  resultNameInline: {
    fontSize: 15,
    fontWeight: '500',
    color: '#000',
    marginBottom: 2,
  },
  resultAddressInline: {
    fontSize: 13,
    color: 'rgba(0,0,0,0.5)',
  },
  routePreviewInfo: {
    gap: 8,
  },
  routePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routePreviewDotGreen: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#34C759',
    marginRight: 10,
  },
  routePreviewDotBlue: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#5170FF',
    marginRight: 10,
  },
  routePreviewStats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    gap: 6,
  },
  routePreviewStatText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5170FF',
  },
  routePreviewStatDivider: {
    fontSize: 12,
    color: 'rgba(0,0,0,0.2)',
  },
  routePreviewText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
    flex: 1,
    letterSpacing: -0.2,
  },
  // Settings Section
  settingsSection: {
    flex: 1,
    marginTop: 24,
    justifyContent: 'flex-end',
    paddingBottom: 20,
  },
  settingRow: {
    marginBottom: 24,
  },
  settingLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(0,0,0,0.4)',
    marginBottom: 12,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  intervalRow: {
    flexDirection: 'row',
    gap: 10,
  },
  intervalChip: {
    flex: 1,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 24, // Pill shape (height/2)
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  intervalChipActive: {
    backgroundColor: '#5170FF',
  },
  intervalChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(0,0,0,0.6)',
  },
  intervalChipTextActive: {
    color: '#fff',
  },
  guardiansRow: {
    flexDirection: 'row',
    gap: 12,
  },
  noGuardiansText: {
    fontSize: 14,
    color: 'rgba(0,0,0,0.35)',
  },
  guardianChip: {
    position: 'relative',
  },
  guardianChipActive: {},
  guardianChipAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  guardianChipAvatarPlaceholder: {
    backgroundColor: '#5170FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guardianChipAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  guardianCheckmark: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#5170FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  startTripButton: {
    backgroundColor: '#5170FF',
    height: 56,
    borderRadius: 28, // Pill shape (height/2)
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  startTripButtonDisabled: {
    opacity: 0.4,
  },
  startTripButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.3,
  },
  // Custom Picker Modal
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  pickerModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  pickerModalHandle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  pickerModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  pickerModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    letterSpacing: -0.3,
  },
  pickerModalDoneButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  pickerModalDoneText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#5170FF',
  },
  pickerModalPickerWrapper: {
    height: 216,
    overflow: 'hidden',
  },
  pickerModalPicker: {
    height: 216,
    width: '100%',
  },
  pickerModalItemIOS: {
    color: '#000',
  },
});
