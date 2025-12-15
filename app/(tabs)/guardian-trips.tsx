import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/providers/auth-provider';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Image } from 'expo-image';
import { useCallback } from 'react';

// Dummy data for testing UI/UX
const DUMMY_GUARDIAN_TRIPS = [
  {
    id: 1,
    user: {
      id: 'user-1',
      username: 'harris_whitaker',
      full_name: 'Harris Whitaker',
      avatar_url: 'https://i.pravatar.cc/150?img=12',
    },
    origin_address: 'Norra Nynäshamn, Stockholms län',
    destination_address: 'Stockholm Central Station',
    status: 'active',
    started_at: '2024-12-15T15:27:00Z',
    last_checkin_at: '2024-12-15T15:45:00Z',
    distance_km: 52.6,
    checkin_interval_minutes: 5,
    next_checkin_in_minutes: 2,
  },
  {
    id: 2,
    user: {
      id: 'user-2',
      username: 'emma_wilson',
      full_name: 'Emma Wilson',
      avatar_url: 'https://i.pravatar.cc/150?img=45',
    },
    origin_address: 'Florence, Tuscany, Italy',
    destination_address: 'Stockholm Arlanda Airport',
    status: 'active',
    started_at: '2024-12-15T14:00:00Z',
    last_checkin_at: '2024-12-15T15:30:00Z',
    distance_km: 2340,
    checkin_interval_minutes: 10,
    next_checkin_in_minutes: 7,
  },
  {
    id: 3,
    user: {
      id: 'user-3',
      username: 'josh_wiggins',
      full_name: 'Josh Wiggins',
      avatar_url: 'https://i.pravatar.cc/150?img=33',
    },
    origin_address: 'Dresden, Saxony, Germany',
    destination_address: 'Stockholm, Sweden',
    status: 'escalated',
    started_at: '2024-12-15T13:00:00Z',
    last_checkin_at: '2024-12-15T14:15:00Z',
    distance_km: 890,
    checkin_interval_minutes: 5,
    missed_checkins: 3,
  },
];

export default function GuardianTripsScreen() {
  const { user, profile } = useAuth();

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

  // TODO: Replace with real data loading
  const isLoading = false;
  const guardianTrips = DUMMY_GUARDIAN_TRIPS;

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusBadge = (trip: typeof DUMMY_GUARDIAN_TRIPS[0]) => {
    if (trip.status === 'escalated') {
      return { label: '🚨 EMERGENCY', color: '#FF3B30', textColor: '#fff' };
    }
    return { label: 'IN TRANSIT', color: '#B4FF39', textColor: '#000' };
  };

  const renderTripCard = useCallback(({ item }: { item: typeof DUMMY_GUARDIAN_TRIPS[0] }) => {
    const statusBadge = getStatusBadge(item);
    
    return (
      <TouchableOpacity
        style={[
          styles.tripCard,
          item.status === 'escalated' && styles.tripCardEscalated,
        ]}
        onPress={() => router.push(`/guardian-trip/${item.id}`)}
        activeOpacity={0.7}>
        {/* Header with Status Badge */}
        <View style={styles.tripCardHeader}>
          <View style={[styles.statusBadge, { backgroundColor: statusBadge.color }]}>
            <Text style={[styles.statusBadgeText, { color: statusBadge.textColor }]}>
              {statusBadge.label}
            </Text>
          </View>
          <IconSymbol name="chevron.right" size={20} color="#999" />
        </View>

        {/* Route Info */}
        <View style={styles.routeInfo}>
          <View style={styles.routeRow}>
            <View style={styles.routeIconContainer}>
              <View style={styles.originDot} />
            </View>
            <Text style={styles.routeText} numberOfLines={1}>
              {item.origin_address}
            </Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <View style={styles.routeIconContainer}>
              <IconSymbol name="flag.fill" size={16} color="#FF3B30" />
            </View>
            <Text style={styles.routeText} numberOfLines={1}>
              {item.destination_address}
            </Text>
          </View>
        </View>

        {/* User Info & Details */}
        <View style={styles.tripCardFooter}>
          <View style={styles.userInfo}>
            <Image
              source={{ uri: item.user.avatar_url }}
              style={styles.tripUserAvatar}
              contentFit="cover"
            />
            <View style={styles.userDetails}>
              <Text style={styles.userName}>{item.user.full_name}</Text>
              <Text style={styles.tripMeta}>
                Started {formatTime(item.started_at)} · {item.distance_km} km
              </Text>
            </View>
          </View>
          
          {item.status !== 'escalated' && item.next_checkin_in_minutes !== undefined && (
            <View style={styles.checkinTimer}>
              <IconSymbol name="clock.fill" size={14} color="#5170FF" />
              <Text style={styles.checkinTimerText}>
                {item.next_checkin_in_minutes}m
              </Text>
            </View>
          )}
          
          {item.status === 'escalated' && (
            <View style={styles.emergencyBadge}>
              <IconSymbol name="exclamationmark.triangle.fill" size={14} color="#fff" />
              <Text style={styles.emergencyBadgeText}>
                {item.missed_checkins} missed
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }, []);

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
          <ActivityIndicator size="large" color="#666" />
        </View>
      ) : guardianTrips.length === 0 ? (
        <View style={styles.centerContent}>
          <IconSymbol name="shield.fill" size={64} color="#ccc" />
          <Text style={styles.centerTitle}>No Active Trips</Text>
          <Text style={styles.centerSubtitle}>
            When someone adds you as a Guardian and starts a trip, you'll see it here
          </Text>
        </View>
      ) : (
        <FlatList
          data={guardianTrips}
          renderItem={renderTripCard}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
    paddingTop: 16,
    paddingBottom: 24,
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
  checkinTimer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F4FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  checkinTimerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5170FF',
  },
  emergencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF3B30',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  emergencyBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
});
