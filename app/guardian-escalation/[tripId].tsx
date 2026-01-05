import { MapViewWrapper } from '@/components/map-view-wrapper';
import { IconSymbol } from '@/components/ui/icon-symbol';
import BottomSheet, { BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Linking,
  Alert,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { getGuardianTripDetails } from '@/services/trip-service';
import { colors, spacing, typography, radii, shadows } from '@/constants/design-tokens';

export default function GuardianEscalationScreen() {
  const params = useLocalSearchParams<{ tripId: string }>();
  const tripId = parseInt(params.tripId || '0', 10);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [trip, setTrip] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const snapPoints = useMemo(() => ['50%', '85%'], []);

  useEffect(() => {
    const loadTrip = async () => {
      if (!tripId) return;

      setIsLoading(true);
      const { data, error } = await getGuardianTripDetails(tripId);

      if (error) {
        Alert.alert('Error', 'Failed to load trip details');
        router.back();
        return;
      }

      setTrip(data);
      setIsLoading(false);
    };

    loadTrip();
  }, [tripId]);

  const formatTime = (isoString: string | null | undefined) => {
    if (!isoString) return 'Unknown';
    const date = new Date(isoString);
    const timeString = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const dateString = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    return `${timeString}, ${dateString}`;
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const openMaps = () => {
    if (!trip?.last_known_latitude || !trip?.last_known_longitude) {
      Alert.alert('Error', 'Location not available');
      return;
    }

    const url = `https://maps.google.com/?q=${trip.last_known_latitude},${trip.last_known_longitude}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open maps');
    });
  };

  if (isLoading || !trip) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  const userName = trip.profiles?.full_name || trip.profiles?.username || 'Unknown User';
  const userAvatar = trip.profiles?.avatar_url;
  const lastKnownLocation =
    trip.last_known_latitude && trip.last_known_longitude
      ? {
          latitude: trip.last_known_latitude,
          longitude: trip.last_known_longitude,
        }
      : null;

  return (
    <GestureHandlerRootView style={styles.container}>
      <MapViewWrapper
        userLocation={lastKnownLocation || undefined}
        userAvatar={userAvatar}
        userName={userName}
        origin={
          trip.origin_latitude && trip.origin_longitude
            ? {
                latitude: trip.origin_latitude,
                longitude: trip.origin_longitude,
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
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>Emergency Alert</Text>
              <View style={styles.emergencyBadge}>
                <IconSymbol name="exclamationmark.triangle.fill" size={12} color="#fff" />
                <Text style={styles.emergencyBadgeText}>URGENT</Text>
              </View>
            </View>
            <View style={styles.placeholder} />
          </View>

          <BottomSheetScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}>
            {/* User Info */}
            <View style={styles.userCard}>
              {userAvatar ? (
                <Image source={{ uri: userAvatar }} style={styles.userAvatar} contentFit="cover" />
              ) : (
                <View style={[styles.userAvatar, styles.userAvatarPlaceholder]}>
                  <IconSymbol name="person.fill" size={32} color={colors.text.secondary} />
                </View>
              )}
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{userName}</Text>
                {trip.profiles?.username && (
                  <Text style={styles.userUsername}>@{trip.profiles.username}</Text>
                )}
              </View>
            </View>

            {/* Emergency Info */}
            <View style={styles.emergencyInfoCard}>
              <View style={styles.emergencyInfoRow}>
                <IconSymbol name="exclamationmark.triangle.fill" size={20} color={colors.error.main} />
                <Text style={styles.emergencyInfoTitle}>Emergency Situation</Text>
              </View>
              {trip.missed_checkins_count >= 2 ? (
                <>
                  <Text style={styles.emergencyInfoText}>
                    {trip.missed_checkins_count} missed check-in{trip.missed_checkins_count !== 1 ? 's' : ''}
                  </Text>
                  <Text style={styles.emergencyInfoSubtext}>
                    User has not responded to check-in requests and may need help.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.emergencyInfoText}>Emergency Button Pressed</Text>
                  <Text style={styles.emergencyInfoSubtext}>
                    User has pressed the emergency button and needs immediate help.
                  </Text>
                </>
              )}
            </View>

            {/* Location Info */}
            {lastKnownLocation && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Last Known Location</Text>
                <View style={styles.locationCard}>
                  <View style={styles.locationRow}>
                    <IconSymbol name="mappin.circle.fill" size={24} color={colors.primary[500]} />
                    <View style={styles.locationDetails}>
                      <Text style={styles.locationLabel}>Coordinates</Text>
                      <Text style={styles.locationValue}>
                        {lastKnownLocation.latitude.toFixed(6)}, {lastKnownLocation.longitude.toFixed(6)}
                      </Text>
                      {trip.last_known_location_at && (
                        <Text style={styles.locationTime}>
                          Updated {formatTime(trip.last_known_location_at)}
                        </Text>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity style={styles.mapsButton} onPress={openMaps}>
                    <IconSymbol name="map.fill" size={18} color="#fff" />
                    <Text style={styles.mapsButtonText}>Open in Maps</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Trip Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Trip Information</Text>
              <View style={styles.infoCard}>
                {trip.origin_address && (
                  <View style={styles.infoRow}>
                    <IconSymbol name="mappin" size={18} color={colors.text.secondary} />
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>Origin</Text>
                      <Text style={styles.infoValue}>{trip.origin_address}</Text>
                    </View>
                  </View>
                )}

                {trip.destination_address && (
                  <View style={styles.infoRow}>
                    <IconSymbol name="flag.fill" size={18} color={colors.error.main} />
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>Destination</Text>
                      <Text style={styles.infoValue}>{trip.destination_address}</Text>
                    </View>
                  </View>
                )}

                {trip.started_at && (
                  <View style={styles.infoRow}>
                    <IconSymbol name="clock.fill" size={18} color={colors.text.secondary} />
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>Started</Text>
                      <Text style={styles.infoValue}>{formatTime(trip.started_at)}</Text>
                    </View>
                  </View>
                )}

                <View style={styles.infoRow}>
                  <IconSymbol name="bell.fill" size={18} color={colors.text.secondary} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Check-in interval</Text>
                    <Text style={styles.infoValue}>
                      Every {trip.checkin_interval_minutes || 5} minutes
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </BottomSheetScrollView>
        </BottomSheetView>
      </BottomSheet>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.neutral[50],
  },
  bottomSheetBackground: {
    backgroundColor: colors.neutral[0],
  },
  handleIndicator: {
    backgroundColor: colors.neutral[300],
  },
  contentContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
  },
  emergencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error.main,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    gap: spacing.xs,
  },
  emergencyBadgeText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: '#fff',
    letterSpacing: 0.5,
  },
  placeholder: {
    width: 40,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.neutral[50],
    borderRadius: radii.xl,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  userAvatar: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
  },
  userAvatarPlaceholder: {
    backgroundColor: colors.neutral[200],
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  userName: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
  },
  userUsername: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.text.secondary,
  },
  emergencyInfoCard: {
    backgroundColor: colors.error.light,
    borderRadius: radii.xl,
    padding: spacing.lg,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.error.main,
  },
  emergencyInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  emergencyInfoTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.error.main,
  },
  emergencyInfoText: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.error.main,
    marginBottom: spacing.xs,
  },
  emergencyInfoSubtext: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.regular,
    color: colors.text.secondary,
  },
  section: {
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  locationCard: {
    backgroundColor: colors.neutral[50],
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  locationDetails: {
    flex: 1,
    gap: spacing.xs,
  },
  locationLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.text.secondary,
  },
  locationValue: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
  },
  locationTime: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.regular,
    color: colors.text.tertiary,
  },
  mapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.full,
    gap: spacing.sm,
  },
  mapsButtonText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: '#fff',
  },
  infoCard: {
    backgroundColor: colors.neutral[50],
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  infoContent: {
    flex: 1,
    gap: spacing.xs,
  },
  infoLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.text.secondary,
  },
  infoValue: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.regular,
    color: colors.text.primary,
  },
});

