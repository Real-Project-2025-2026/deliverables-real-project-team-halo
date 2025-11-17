import { MapViewWrapper } from '@/components/map-view-wrapper';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useLocation } from '@/hooks/use-location';
import { useTrip } from '@/hooks/use-trip';
import { useAuth } from '@/providers/auth-provider';
import type { GuardianLocation } from '@/services/guardian-service';
import { getGuardiansWithLocations } from '@/services/guardian-service';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function HomeScreen() {
  const { user, profile } = useAuth();
  const { activeTrip } = useTrip();
  const { location, getCurrentLocation, requestPermission, startWatchingLocation, stopWatchingLocation } = useLocation();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [guardianLocations, setGuardianLocations] = useState<GuardianLocation[]>([]);

  // Bottom sheet snap points
  const snapPoints = useMemo(() => ['25%', '50%', '85%'], []);

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

  function handleStartTrip() {
    if (activeTrip) {
      // Navigate to active trip screen
      router.push('/trip/active');
    } else {
      // Navigate to start trip screen
      router.push('/trip/start');
    }
  }

  const handleSheetChanges = useCallback((index: number) => {
    console.log('handleSheetChanges', index);
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
        guardians={guardianLocations.map((g) => ({
          id: g.id,
          latitude: g.latitude,
          longitude: g.longitude,
          avatarUrl: g.avatarUrl,
          username: g.username,
          fullName: g.fullName,
        }))}
        onLocationButtonPress={handleLocationButtonPress}
      />

      {/* Bottom Sheet */}
      <BottomSheet
        ref={bottomSheetRef}
        index={1}
        snapPoints={snapPoints}
        onChange={handleSheetChanges}
        enablePanDownToClose={false}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.handleIndicator}>
        <BottomSheetView style={styles.contentContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>
                Hi, {profile?.full_name || user?.email?.split('@')[0] || 'there'}
              </Text>
              <Text style={styles.subtitle}>Stay safe on your journey</Text>
            </View>
          </View>

          {/* Main Action Card */}
          {activeTrip ? (
            <TouchableOpacity style={styles.activeTripCard} onPress={handleStartTrip}>
              <View style={styles.activeTripHeader}>
                <View style={styles.statusBadge}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>Trip Active</Text>
                </View>
                <IconSymbol name="chevron.right" size={20} color="#fff" />
              </View>
              <Text style={styles.activeTripTitle}>Your trip is in progress</Text>
              <Text style={styles.activeTripSubtitle}>Tap to view details</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.startCard} onPress={handleStartTrip}>
              <View style={styles.startIconContainer}>
                <IconSymbol name="shield.fill" size={40} color="#5170FF" />
              </View>
              <View style={styles.startContent}>
                <Text style={styles.startTitle}>Start a Trip</Text>
                <Text style={styles.startSubtitle}>
                  Activate safety monitoring
                </Text>
              </View>
              <IconSymbol name="chevron.right" size={24} color="#fff" />
            </TouchableOpacity>
          )}

          {/* Features Grid */}
          <View style={styles.featuresGrid}>
            <View style={styles.featureCard}>
              <View style={styles.featureIcon}>
                <IconSymbol name="bell.fill" size={20} color="#fff" />
              </View>
              <Text style={styles.featureTitle}>Check-ins</Text>
            </View>

            <View style={styles.featureCard}>
              <View style={styles.featureIcon}>
                <IconSymbol name="location.fill" size={20} color="#fff" />
              </View>
              <Text style={styles.featureTitle}>Tracking</Text>
            </View>

            <View style={styles.featureCard}>
              <View style={styles.featureIcon}>
                <IconSymbol name="person.2.fill" size={20} color="#fff" />
              </View>
              <Text style={styles.featureTitle}>Together</Text>
            </View>

            <View style={styles.featureCard}>
              <View style={styles.featureIcon}>
                <IconSymbol name="phone.fill" size={20} color="#fff" />
              </View>
              <Text style={styles.featureTitle}>Emergency</Text>
            </View>
          </View>

          {/* Info Card */}
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>🛡️ How Halo Works</Text>
            <Text style={styles.infoText}>
              Start a trip → Choose safety mode → Receive check-ins → Arrive safely
            </Text>
          </View>
        </BottomSheetView>
      </BottomSheet>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bottomSheetBackground: {
    backgroundColor: '#5170FF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  handleIndicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    width: 40,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  header: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  startCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#fff',
  },
  startIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  startContent: {
    flex: 1,
  },
  startTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  startSubtitle: {
    fontSize: 13,
    color: '#fff',
    opacity: 0.9,
  },
  activeTripCard: {
    backgroundColor: '#5170FF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
  },
  activeTripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF50',
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  activeTripTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  activeTripSubtitle: {
    fontSize: 13,
    color: '#fff',
    opacity: 0.8,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  featureCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#fff',
    opacity: 0.9,
    lineHeight: 20,
  },
});
