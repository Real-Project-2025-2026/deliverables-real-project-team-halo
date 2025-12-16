import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useLocation } from '@/hooks/use-location';
import { useTrip } from '@/hooks/use-trip';
import { useAuth } from '@/providers/auth-provider';
import { startBackgroundLocationTracking } from '@/services/background-location';
import { reverseGeocode, type GeocodedAddress } from '@/services/geocoding-service';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AddressSearchModal } from '@/components/address-search-modal';
import { MapViewWrapper } from '@/components/map-view-wrapper';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RouteSetupScreen() {
  const params = useLocalSearchParams<{
    mode?: string;
    checkinInterval?: string;
    customIntervalValue?: string;
    safetogetherEnabled?: string;
    guardianIds?: string;
    // New params from destination-search
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
  const { startTrip, isLoading: isStartingTrip } = useTrip();
  const { location, getCurrentLocation, requestPermission, permissionStatus } = useLocation();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [showAddressSearch, setShowAddressSearch] = useState(false);
  const [searchType, setSearchType] = useState<'origin' | 'destination' | null>(null);
  
  // Initialize from params if available
  const initialOrigin: GeocodedAddress | null = params.originLat && params.originLng ? {
    name: params.originName || params.originAddress || '',
    address: params.originAddress || '',
    formattedAddress: params.originAddress || '',
    latitude: parseFloat(params.originLat),
    longitude: parseFloat(params.originLng),
  } : null;
  
  const initialDestination: GeocodedAddress | null = params.destinationLat && params.destinationLng ? {
    name: params.destinationName || params.destinationAddress || '',
    address: params.destinationAddress || '',
    formattedAddress: params.destinationAddress || '',
    latitude: parseFloat(params.destinationLat),
    longitude: parseFloat(params.destinationLng),
  } : null;
  
  const [origin, setOrigin] = useState<GeocodedAddress | null>(initialOrigin);
  const [destination, setDestination] = useState<GeocodedAddress | null>(initialDestination);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const snapPoints = useMemo(() => ['50%', '75%'], []);

  // Initialize origin with current location only if not passed via params
  useEffect(() => {
    // Skip if we already have origin from params
    if (initialOrigin) return;
    
    const initLocation = async () => {
      const hasPermission = await requestPermission();
      if (hasPermission) {
        setIsGeocoding(true);
        const currentLocation = await getCurrentLocation();
        if (currentLocation?.coords) {
          const { data, error } = await reverseGeocode(
            currentLocation.coords.latitude,
            currentLocation.coords.longitude
          );
          if (data && !error) {
            setOrigin(data);
          } else {
            // Fallback: set coordinates even if geocoding fails
            setOrigin({
              name: 'Aktuelle Position',
              address: 'Aktuelle Position',
              latitude: currentLocation.coords.latitude,
              longitude: currentLocation.coords.longitude,
              formattedAddress: `${currentLocation.coords.latitude.toFixed(6)}, ${currentLocation.coords.longitude.toFixed(6)}`,
            });
          }
        }
        setIsGeocoding(false);
      }
    };
    initLocation();
  }, [requestPermission, getCurrentLocation, initialOrigin]);

  const handleAddressSelect = useCallback(
    async (address: GeocodedAddress) => {
      if (searchType === 'origin') {
        setOrigin(address);
      } else if (searchType === 'destination') {
        setDestination(address);
      }
      setShowAddressSearch(false);
      setSearchType(null);
    },
    [searchType]
  );

  const handleContinue = useCallback(async () => {
    if (!origin || !destination) {
      Alert.alert('Missing Information', 'Please select both start and destination addresses.');
      return;
    }

    if (permissionStatus !== 'granted') {
      Alert.alert(
        'Location Permission Required',
        'Location services must be enabled for active trip tracking.'
      );
      return;
    }

    setIsLoading(true);

    try {
      await startBackgroundLocationTracking();

      const guardianIds = params.guardianIds?.split(',').filter((id) => id.length > 0) || [];
      const checkinInterval =
        params.checkinInterval === 'custom'
          ? parseInt(params.customIntervalValue || '15', 10)
          : parseInt(params.checkinInterval || '5', 10);

      const { success, trip, error } = await startTrip({
        mode: (params.mode as any) || 'interval',
        checkinIntervalMinutes: checkinInterval,
        safetogetherEnabled: params.safetogetherEnabled === 'true',
        guardianIds,
        originLatitude: origin.latitude,
        originLongitude: origin.longitude,
        originAddress: origin.formattedAddress || origin.address,
        destinationLatitude: destination.latitude,
        destinationLongitude: destination.longitude,
        destinationAddress: destination.formattedAddress || destination.address,
      });

      if (success && trip) {
        router.replace('/trip/active');
      } else {
        Alert.alert('Error', error || 'Failed to start trip. Please try again.');
      }
    } catch (error) {
      console.error('Error starting trip:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [origin, destination, params, startTrip, permissionStatus]);

  return (
    <GestureHandlerRootView style={styles.container}>
      <MapViewWrapper
        userLocation={
          location?.coords
            ? {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              }
            : undefined
        }
        userAvatar={profile?.avatar_url || null}
        userName={profile?.full_name || profile?.username || null}
        origin={
          origin
            ? {
                latitude: origin.latitude,
                longitude: origin.longitude,
              }
            : undefined
        }
        destination={
          destination
            ? {
                latitude: destination.latitude,
                longitude: destination.longitude,
              }
            : undefined
        }
      />

      <BottomSheet
        ref={bottomSheetRef}
        index={1}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.handleIndicator}>
        <BottomSheetScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}>
          
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <IconSymbol name="chevron.left" size={22} color="#000" />
            </TouchableOpacity>
            <Text style={styles.title}>Set Route</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Origin */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>FROM</Text>
            <TouchableOpacity
              style={styles.addressCard}
              onPress={() => {
                setSearchType('origin');
                setShowAddressSearch(true);
              }}
              activeOpacity={0.7}>
              <View style={[styles.addressIcon, { backgroundColor: '#34C759' }]}>
                <IconSymbol name="location.fill" size={26} color="#fff" />
              </View>
              <View style={styles.addressContent}>
                {isGeocoding ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#5170FF" />
                    <Text style={styles.loadingText}>Getting location...</Text>
                  </View>
                ) : origin ? (
                  <Text style={styles.addressText} numberOfLines={2}>
                    {origin.formattedAddress || origin.address || 'Current Location'}
                  </Text>
                ) : (
                  <Text style={styles.addressPlaceholder}>Select start location</Text>
                )}
              </View>
              <IconSymbol name="chevron.right" size={22} color="#999" />
            </TouchableOpacity>
          </View>

          {/* Destination */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>TO</Text>
            <TouchableOpacity
              style={styles.addressCard}
              onPress={() => {
                setSearchType('destination');
                setShowAddressSearch(true);
              }}
              activeOpacity={0.7}>
              <View style={[styles.addressIcon, { backgroundColor: '#FF3B30' }]}>
                <IconSymbol name="flag.fill" size={26} color="#fff" />
              </View>
              <View style={styles.addressContent}>
                {destination ? (
                  <Text style={styles.addressText} numberOfLines={2}>
                    {destination.formattedAddress || destination.address}
                  </Text>
                ) : (
                  <Text style={styles.addressPlaceholder}>Select destination</Text>
                )}
              </View>
              <IconSymbol name="chevron.right" size={22} color="#999" />
            </TouchableOpacity>
          </View>

          {/* Start Trip Button */}
          <TouchableOpacity
            style={[
              styles.startButton,
              (!origin || !destination || isLoading) && styles.startButtonDisabled,
            ]}
            onPress={handleContinue}
            disabled={!origin || !destination || isLoading}
            activeOpacity={0.85}>
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <IconSymbol name="arrow.right.circle.fill" size={24} color="#fff" />
                <Text style={styles.startButtonText}>Start Trip</Text>
              </>
            )}
          </TouchableOpacity>
        </BottomSheetScrollView>
      </BottomSheet>

      {/* Address Search Modal */}
      <AddressSearchModal
        visible={showAddressSearch}
        onClose={() => {
          setShowAddressSearch(false);
          setSearchType(null);
        }}
        onSelectAddress={handleAddressSelect}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bottomSheetBackground: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  handleIndicator: {
    backgroundColor: '#e0e0e0',
    width: 40,
    height: 4,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingTop: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
    marginBottom: 12,
    letterSpacing: 1,
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  addressIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  addressContent: {
    flex: 1,
  },
  addressText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    lineHeight: 22,
  },
  addressPlaceholder: {
    fontSize: 16,
    color: '#999',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  startButton: {
    flexDirection: 'row',
    backgroundColor: '#5170FF',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 16,
    shadowColor: '#5170FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  startButtonDisabled: {
    opacity: 0.5,
    shadowOpacity: 0.1,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
