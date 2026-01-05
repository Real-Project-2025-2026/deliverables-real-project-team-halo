import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/providers/auth-provider';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import * as Haptics from 'expo-haptics';
import {
  getTripsAsGuardian,
  acceptTripGuardianRequest,
  declineTripGuardianRequest,
  type TripGuardianWithDetails,
} from '@/services/trip-guardian-service';

export default function GuardianTripsScreen() {
  const { user, profile } = useAuth();
  const [trips, setTrips] = useState<TripGuardianWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch trips where user is a guardian
  const fetchTrips = useCallback(async () => {
    try {
      const { data, error } = await getTripsAsGuardian();
      if (error) {
        console.error('[GuardianTrips] Error fetching trips:', error);
        return;
      }
      setTrips(data || []);
    } catch (err) {
      console.error('[GuardianTrips] Error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      fetchTrips();
    }, [fetchTrips])
  );

  // Pull to refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchTrips();
  }, [fetchTrips]);

  // Accept trip guardian request
  const handleAccept = useCallback(async (tripGuardianId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const { error } = await acceptTripGuardianRequest(tripGuardianId);
    
    if (error) {
      Alert.alert('Fehler', error.error);
      return;
    }
    
    // Update local state
    setTrips(prev => prev.map(t => 
      t.id === tripGuardianId 
        ? { ...t, status: 'accepted' as const, responded_at: new Date().toISOString() }
        : t
    ));
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  // Decline trip guardian request
  const handleDecline = useCallback(async (tripGuardianId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    Alert.alert(
      'Anfrage ablehnen?',
      'Du wirst diesen Trip nicht mehr sehen.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Ablehnen',
          style: 'destructive',
          onPress: async () => {
            const { error } = await declineTripGuardianRequest(tripGuardianId);
            
            if (error) {
              Alert.alert('Fehler', error.error);
              return;
            }
            
            // Remove from local state
            setTrips(prev => prev.filter(t => t.id !== tripGuardianId));
          },
        },
      ]
    );
  }, []);

  // Render user avatar (for header)
  const renderUserAvatar = useCallback(() => {
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
  }, [profile, user]);

  const formatTime = (isoString: string | null) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusBadge = (item: TripGuardianWithDetails) => {
    if (item.trip?.status === 'escalated') {
      return { label: '🚨 NOTFALL', color: '#FF3B30', textColor: '#fff' };
    }
    if (item.status === 'requested') {
      return { label: 'ANFRAGE', color: '#FF9500', textColor: '#fff' };
    }
    return { label: 'UNTERWEGS', color: '#B4FF39', textColor: '#000' };
  };

  const renderTripCard = useCallback(({ item }: { item: TripGuardianWithDetails }) => {
    const statusBadge = getStatusBadge(item);
    const tripOwner = item.trip_owner;
    const trip = item.trip;
    const isRequest = item.status === 'requested';
    
    return (
      <TouchableOpacity
        style={[
          styles.tripCard,
          trip?.status === 'escalated' && styles.tripCardEscalated,
          isRequest && styles.tripCardRequest,
        ]}
        onPress={() => {
          if (!isRequest) {
            router.push(`/guardian-trip/${trip?.id}`);
          }
        }}
        activeOpacity={isRequest ? 1 : 0.7}>
        {/* Header with Status Badge */}
        <View style={styles.tripCardHeader}>
          <View style={[styles.statusBadge, { backgroundColor: statusBadge.color }]}>
            <Text style={[styles.statusBadgeText, { color: statusBadge.textColor }]}>
              {statusBadge.label}
            </Text>
          </View>
          {!isRequest && (
            <IconSymbol name="chevron.right" size={20} color="#999" />
          )}
        </View>

        {/* Route Info */}
        <View style={styles.routeInfo}>
          <View style={styles.routeRow}>
            <View style={styles.routeIconContainer}>
              <View style={styles.originDot} />
            </View>
            <Text style={styles.routeText} numberOfLines={1}>
              {trip?.origin_address || 'Unbekannter Start'}
            </Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <View style={styles.routeIconContainer}>
              <IconSymbol name="flag.fill" size={16} color="#FF3B30" />
            </View>
            <Text style={styles.routeText} numberOfLines={1}>
              {trip?.destination_address || 'Unbekanntes Ziel'}
            </Text>
          </View>
        </View>

        {/* User Info & Details */}
        <View style={styles.tripCardFooter}>
          <View style={styles.userInfo}>
            {tripOwner?.avatar_url ? (
              <Image
                source={{ uri: tripOwner.avatar_url }}
                style={styles.tripUserAvatar}
                contentFit="cover"
              />
            ) : (
              <View style={styles.tripUserAvatarPlaceholder}>
                <Text style={styles.tripUserAvatarText}>
                  {(tripOwner?.full_name || tripOwner?.username || '?')[0].toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.userDetails}>
              <Text style={styles.userName}>
                {tripOwner?.full_name || tripOwner?.username || 'Unbekannt'}
              </Text>
              <Text style={styles.tripMeta}>
                {trip?.started_at ? `Gestartet ${formatTime(trip.started_at)}` : 'Trip aktiv'}
                {trip?.checkin_interval_minutes && ` · Check-in alle ${trip.checkin_interval_minutes} min`}
              </Text>
            </View>
          </View>
        </View>

        {/* Accept/Decline Buttons for Requests */}
        {isRequest && (
          <View style={styles.requestActions}>
            <TouchableOpacity
              style={styles.declineButton}
              onPress={() => handleDecline(item.id)}
              activeOpacity={0.8}>
              <Text style={styles.declineButtonText}>Ablehnen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={() => handleAccept(item.id)}
              activeOpacity={0.8}>
              <IconSymbol name="checkmark" size={18} color="#fff" />
              <Text style={styles.acceptButtonText}>Annehmen</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [handleAccept, handleDecline]);

  // Separate trips by status
  const requestedTrips = trips.filter(t => t.status === 'requested');
  const acceptedTrips = trips.filter(t => t.status === 'accepted');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Trips</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.userAvatarContainer}
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.7}>
            {renderUserAvatar()}
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#5170FF" />
        </View>
      ) : trips.length === 0 ? (
        <View style={styles.centerContent}>
          <IconSymbol name="shield.fill" size={64} color="#ccc" />
          <Text style={styles.centerTitle}>Keine aktiven Trips</Text>
          <Text style={styles.centerSubtitle}>
            Wenn jemand dich als Guardian hinzufügt und einen Trip startet, siehst du ihn hier
          </Text>
        </View>
      ) : (
        <FlatList
          data={[...requestedTrips, ...acceptedTrips]}
          renderItem={renderTripCard}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#5170FF"
            />
          }
          ListHeaderComponent={
            requestedTrips.length > 0 ? (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  Neue Anfragen ({requestedTrips.length})
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#f9f9f9',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userAvatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  userAvatarPlaceholder: {
    backgroundColor: '#5170FF',
  },
  userAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  centerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 24,
    marginBottom: 8,
    textAlign: 'center',
  },
  centerSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tripCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  tripCardEscalated: {
    borderWidth: 2,
    borderColor: '#FF3B30',
  },
  tripCardRequest: {
    borderWidth: 2,
    borderColor: '#FF9500',
  },
  tripCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  routeInfo: {
    marginBottom: 16,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  routeIconContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  originDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#34C759',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: '#e0e0e0',
    marginLeft: 11,
    marginVertical: 4,
  },
  routeText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  tripCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  tripUserAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#5170FF',
  },
  tripUserAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#5170FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tripUserAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  tripMeta: {
    fontSize: 12,
    color: '#666',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  declineButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 9999,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  acceptButton: {
    flex: 1.5,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 9999,
    backgroundColor: '#5170FF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#5170FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  acceptButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
