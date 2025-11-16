import { MapViewWrapper } from '@/components/map-view-wrapper';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useGuardianTrips } from '@/hooks/use-guardian-trips';
import * as routeService from '@/services/route-service';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Format duration with seconds as MM:SS (minutes:seconds)
 */
function formatDurationWithSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Guardian Trip Detail Screen
 * Shows trip details, location, and status for a Guardian monitoring someone's trip
 */
export default function GuardianTripDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const tripId = params.id ? parseInt(params.id, 10) : null;
  const { getTripDetails } = useGuardianTrips();
  
  const [trip, setTrip] = useState<import('@/hooks/use-guardian-trips').GuardianTrip | null>(null);
  const [routePoints, setRoutePoints] = useState<routeService.RoutePoint[]>([]);
  const [routeDistance, setRouteDistance] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const bottomSheetRef = useRef<BottomSheet>(null);

  const snapPoints = useMemo(() => ['35%', '65%'], []);

  const isEscalated = trip?.status === 'escalated';

  // Load trip details
  useEffect(() => {
    if (!tripId) {
      setIsLoading(false);
      return;
    }

    const loadTrip = async () => {
      setIsLoading(true);
      try {
        const tripData = await getTripDetails(tripId);
        if (tripData) {
          setTrip(tripData);
        } else {
          Alert.alert('Error', 'Trip not found or you are not a Guardian for this trip.');
          router.back();
        }
      } catch (error) {
        console.error('Error loading trip:', error);
        Alert.alert('Error', 'Failed to load trip details.');
        router.back();
      } finally {
        setIsLoading(false);
      }
    };

    loadTrip();

    // Refresh trip every 5 seconds
    const interval = setInterval(() => {
      if (tripId) {
        getTripDetails(tripId).then((tripData) => {
          if (tripData) {
            setTrip(tripData);
          }
        });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [tripId, getTripDetails]);

  // Load route points
  useEffect(() => {
    if (!trip?.id) {
      setRoutePoints([]);
      setRouteDistance(0);
      return;
    }

    const loadRoutePoints = async () => {
      try {
        const { data, error } = await routeService.getRoutePoints(trip.id);
        
        if (error) {
          console.error('Error loading route points:', error);
          return;
        }

        if (data) {
          setRoutePoints(data);
          const distance = routeService.calculateRouteDistance(data);
          setRouteDistance(distance);
        }
      } catch (err) {
        console.error('Error loading route points:', err);
      }
    };

    loadRoutePoints();
    
    // Refresh route points every 5 seconds
    const interval = setInterval(loadRoutePoints, 5000);
    
    return () => clearInterval(interval);
  }, [trip?.id]);

  // Update elapsed time
  useEffect(() => {
    if (!trip) {
      setElapsedSeconds(0);
      return;
    }

    const startTime = new Date(trip.started_at).getTime();
    
    const updateElapsed = () => {
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000);
      setElapsedSeconds(elapsed);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [trip]);

  if (isLoading || !trip) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <SafeAreaView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
        </SafeAreaView>
      </GestureHandlerRootView>
    );
  }

  const displayName = trip.user_profile.full_name || trip.user_profile.username || 'Unknown';

  return (
    <GestureHandlerRootView style={styles.container}>
      <MapViewWrapper
        userLocation={
          trip.last_known_latitude && trip.last_known_longitude
            ? {
                latitude: trip.last_known_latitude,
                longitude: trip.last_known_longitude,
              }
            : undefined
        }
        destination={
          trip.destination_latitude && trip.destination_longitude
            ? {
                latitude: trip.destination_latitude,
                longitude: trip.destination_longitude,
              }
            : undefined
        }
        routePoints={routePoints.map((point) => ({
          latitude: point.latitude,
          longitude: point.longitude,
        }))}
      />

      <BottomSheet
        ref={bottomSheetRef}
        index={1}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.handleIndicator}>
        <BottomSheetView style={styles.contentContainer}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <IconSymbol name="chevron.left" size={24} color="#fff" />
            </TouchableOpacity>
            {isEscalated ? (
              <View style={[styles.statusBadge, styles.escalatedBadge]}>
                <IconSymbol name="exclamationmark.triangle.fill" size={16} color="#fff" />
                <Text style={styles.statusText}>Emergency Escalated</Text>
              </View>
            ) : (
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Trip Active</Text>
              </View>
            )}
            <View style={{ width: 40 }} />
          </View>

          {/* Escalation Banner */}
          {isEscalated && (
            <View style={styles.escalationBanner}>
              <IconSymbol name="exclamationmark.triangle.fill" size={20} color="#fff" />
              <Text style={styles.escalationBannerText}>
                Emergency contacts have been notified
              </Text>
            </View>
          )}

          {/* User Info */}
          <View style={styles.userCard}>
            <View style={styles.userAvatar}>
              {trip.user_profile.avatar_url ? (
                <Image
                  source={{ uri: trip.user_profile.avatar_url }}
                  style={styles.avatarImage}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>
                    {displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>
                @{trip.user_profile.username || 'unknown'}
              </Text>
              {trip.user_profile.full_name && (
                <Text style={styles.userFullName}>{displayName}</Text>
              )}
            </View>
          </View>

          {/* Time Display */}
          <View style={styles.timeCard}>
            <IconSymbol name="clock.fill" size={28} color="#fff" />
            <View style={styles.timeContent}>
              <Text style={styles.timeLabel}>Elapsed Time</Text>
              <Text style={styles.timeValue}>{formatDurationWithSeconds(elapsedSeconds)}</Text>
            </View>
          </View>

          {/* Route Stats */}
          {routePoints.length > 0 && (
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <IconSymbol name="figure.walk" size={20} color="#fff" />
                <View style={styles.statContent}>
                  <Text style={styles.statLabel}>Distance</Text>
                  <Text style={styles.statValue}>
                    {routeDistance >= 1000
                      ? `${(routeDistance / 1000).toFixed(2)} km`
                      : `${Math.round(routeDistance)} m`}
                  </Text>
                </View>
              </View>
              <View style={styles.statItem}>
                <IconSymbol name="mappin.circle.fill" size={20} color="#fff" />
                <View style={styles.statContent}>
                  <Text style={styles.statLabel}>Points</Text>
                  <Text style={styles.statValue}>{routePoints.length}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Trip Info */}
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <IconSymbol name="shield.fill" size={18} color="#fff" />
              <Text style={styles.infoText}>
                {trip.mode.charAt(0).toUpperCase() + trip.mode.slice(1)}
              </Text>
            </View>
            {trip.mode !== 'silent' && (
              <View style={styles.infoItem}>
                <IconSymbol name="bell.fill" size={18} color="#fff" />
                <Text style={styles.infoText}>{trip.checkin_interval_minutes}min</Text>
              </View>
            )}
            {trip.missed_checkins_count && trip.missed_checkins_count > 0 && (
              <View style={[styles.infoItem, styles.missedCheckinItem]}>
                <IconSymbol name="exclamationmark.triangle.fill" size={18} color="#fff" />
                <Text style={[styles.infoText, styles.missedCheckinText]}>
                  {trip.missed_checkins_count} missed
                </Text>
              </View>
            )}
          </View>

          {/* Last Location Update */}
          {trip.last_known_latitude && trip.last_known_longitude && (
            <View style={styles.locationInfo}>
              <IconSymbol name="location.fill" size={16} color="rgba(255, 255, 255, 0.7)" />
              <Text style={styles.locationText}>
                Last location: {trip.last_location_update_at
                  ? new Date(trip.last_location_update_at).toLocaleTimeString()
                  : 'Unknown'}
              </Text>
            </View>
          )}
        </BottomSheetView>
      </BottomSheet>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#5170FF',
  },
  bottomSheetBackground: {
    backgroundColor: '#5170FF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF50',
    marginRight: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  escalatedBadge: {
    backgroundColor: 'rgba(255, 59, 48, 0.3)',
    gap: 6,
  },
  escalationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.3)',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.5)',
  },
  escalationBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  userFullName: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  timeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  timeContent: {
    marginLeft: 12,
  },
  timeLabel: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.9,
    marginBottom: 2,
  },
  timeValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: 12,
    borderRadius: 10,
    gap: 10,
  },
  statContent: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    color: '#fff',
    opacity: 0.8,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  infoRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  infoText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  missedCheckinItem: {
    backgroundColor: 'rgba(255, 59, 48, 0.3)',
  },
  missedCheckinText: {
    color: '#fff',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    borderRadius: 10,
    gap: 8,
  },
  locationText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
});

