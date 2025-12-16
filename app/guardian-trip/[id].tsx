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
} from 'react-native';
import { GestureHandlerRootView, PanGestureHandler, State } from 'react-native-gesture-handler';

// Dummy Data for Trip Detail
const DUMMY_TRIP = {
  id: 1,
  tripId: 'TRP-29698-98971',
  user: {
    name: 'Harris Whitaker',
    username: 'harris_w',
    avatar: 'https://i.pravatar.cc/150?img=12',
  },
  status: 'in_transit',
  origin: {
    address: 'Norra Nynäshamn',
    lat: 58.895488,
    lng: 17.948856,
  },
  destination: {
    address: 'Stockholm Central Station',
    lat: 59.330162,
    lng: 18.058319,
  },
  currentLocation: {
    address: 'Farsta, Stockholm',
    lat: 59.243214,
    lng: 18.090774,
  },
  startedAt: '2024-12-15T15:27:00',
  distance: 52.6,
  checkinInterval: 5,
  nextCheckinMinutes: 2,
  hasPhotosEnabled: true,
  timeline: [
    {
      id: 1,
      type: 'start',
      title: 'Trip Started',
      location: 'Norra Nynäshamn',
      timestamp: '2024-12-15T15:27:00',
      status: 'completed',
    },
    {
      id: 2,
      type: 'checkin',
      title: 'Check-in completed',
      location: 'Västerhaninge, Stockholm',
      timestamp: '2024-12-15T15:32:00',
      status: 'completed',
      hasPhoto: true,
      photoUrl: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400',
    },
    {
      id: 3,
      type: 'checkin',
      title: 'Check-in completed',
      location: 'Skogås, Stockholm',
      timestamp: '2024-12-15T15:37:00',
      status: 'completed',
      hasPhoto: true,
      photoUrl: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=400',
    },
    {
      id: 4,
      type: 'checkin',
      title: 'Check-in completed',
      location: 'Farsta, Stockholm',
      timestamp: '2024-12-15T15:42:00',
      status: 'completed',
      hasPhoto: false,
    },
    {
      id: 5,
      type: 'checkin_pending',
      title: 'Next check-in in 2 minutes',
      location: 'En route to Stockholm',
      timestamp: '2024-12-15T15:47:00',
      status: 'pending',
    },
    {
      id: 6,
      type: 'arrival',
      title: 'Expected arrival',
      location: 'Stockholm Central Station',
      timestamp: '2024-12-15T16:15:00',
      status: 'pending',
    },
  ],
};

type TabType = 'overview' | 'activity';

export default function GuardianTripDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showEarlyEvents, setShowEarlyEvents] = useState(false);
  const bottomSheetRef = useRef<BottomSheet>(null);

  const snapPoints = useMemo(() => ['40%', '75%'], []);

  // Use dummy data
  const trip = DUMMY_TRIP;

  // Update elapsed time
  useEffect(() => {
    const startTime = new Date(trip.startedAt).getTime();
    
    const updateElapsed = () => {
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000);
      setElapsedSeconds(elapsed);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [trip.startedAt]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const timeString = date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
    const dateString = date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
    return `${timeString}, ${dateString}`;
  };

  const handleSwipe = (event: any) => {
    const { translationX, state } = event.nativeEvent;
    
    if (state === State.END) {
      // Swipe right (translationX > 0) -> go to Overview
      // Swipe left (translationX < 0) -> go to Activity
      if (translationX > 50 && activeTab === 'activity') {
        setActiveTab('overview');
      } else if (translationX < -50 && activeTab === 'overview') {
        setActiveTab('activity');
      }
    }
  };

  const renderOverviewTab = () => (
    <BottomSheetScrollView 
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 40 }}>
      {/* User Info */}
      <View style={styles.userCard}>
        <Image
          source={{ uri: trip.user.avatar }}
          style={styles.userAvatar}
          contentFit="cover"
        />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{trip.user.name}</Text>
          <Text style={styles.userUsername}>@{trip.user.username}</Text>
        </View>
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton}>
            <IconSymbol name="message.fill" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <IconSymbol name="phone.fill" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Trip Info */}
      <View style={styles.section}>
        <View style={styles.infoRow}>
          <IconSymbol name="clock.fill" size={18} color="rgba(255, 255, 255, 0.8)" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Duration</Text>
            <Text style={styles.infoValue}>{formatDuration(elapsedSeconds)}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <IconSymbol name="figure.walk" size={18} color="rgba(255, 255, 255, 0.8)" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Distance</Text>
            <Text style={styles.infoValue}>{trip.distance} km</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <IconSymbol name="bell.fill" size={18} color="rgba(255, 255, 255, 0.8)" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Check-in interval</Text>
            <Text style={styles.infoValue}>Every {trip.checkinInterval} minutes</Text>
          </View>
        </View>
      </View>

      {/* Locations */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Route</Text>
        <View style={styles.routeCard}>
          <View style={styles.routeRow}>
            <View style={styles.routeIconContainer}>
              <View style={styles.originDot} />
            </View>
            <View style={styles.routeDetails}>
              <Text style={styles.routeLabel}>From</Text>
              <Text style={styles.routeAddress}>{trip.origin.address}</Text>
            </View>
          </View>

          <View style={styles.routeLine} />

          <View style={styles.routeRow}>
            <View style={styles.routeIconContainer}>
              <IconSymbol name="mappin.circle.fill" size={20} color="#5170FF" />
            </View>
            <View style={styles.routeDetails}>
              <Text style={styles.routeLabel}>Current location</Text>
              <Text style={styles.routeAddress}>{trip.currentLocation.address}</Text>
              <Text style={styles.routeTime}>Last updated {formatTime(trip.startedAt)}</Text>
            </View>
          </View>

          <View style={styles.routeLine} />

          <View style={styles.routeRow}>
            <View style={styles.routeIconContainer}>
              <IconSymbol name="flag.fill" size={20} color="#FF3B30" />
            </View>
            <View style={styles.routeDetails}>
              <Text style={styles.routeLabel}>Destination</Text>
              <Text style={styles.routeAddress}>{trip.destination.address}</Text>
            </View>
          </View>
        </View>
      </View>
    </BottomSheetScrollView>
  );

  const renderActivityTab = () => {
    const visibleTimeline = showEarlyEvents ? trip.timeline : trip.timeline.slice(0, 3);

    return (
      <BottomSheetScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity Timeline</Text>
          
          {visibleTimeline.map((event, index) => (
            <View key={event.id} style={styles.timelineItem}>
              <View style={styles.timelineLeft}>
                {event.type === 'checkin' && event.status === 'completed' ? (
                  <View style={styles.checkmarkContainer}>
                    <IconSymbol name="checkmark" size={10} color="#000" />
                  </View>
                ) : (
                  <View
                    style={[
                      styles.timelineDot,
                      event.status === 'completed' && styles.timelineDotCompleted,
                      event.status === 'pending' && styles.timelineDotPending,
                    ]}
                  />
                )}
                {index < visibleTimeline.length - 1 && (
                  <View style={styles.timelineLine} />
                )}
              </View>

              <View style={styles.timelineContent}>
                <View style={styles.timelineHeader}>
                  <Text style={styles.timelineTitle}>{event.title}</Text>
                  <Text style={styles.timelineTime}>
                    {event.status === 'completed' ? formatTime(event.timestamp) : 'Upcoming'}
                  </Text>
                </View>

                <Text style={styles.timelineLocation}>{event.location}</Text>

                {event.hasPhoto && event.photoUrl && (
                  <Image
                    source={{ uri: event.photoUrl }}
                    style={styles.timelinePhoto}
                    contentFit="cover"
                  />
                )}

                {event.type === 'checkin_pending' && (
                  <View style={styles.pendingBadge}>
                    <IconSymbol name="clock.fill" size={14} color="#FFA500" />
                    <Text style={styles.pendingText}>
                      Next check-in in {trip.nextCheckinMinutes} minutes
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ))}

          {!showEarlyEvents && trip.timeline.length > 3 && (
            <TouchableOpacity
              style={styles.showMoreButton}
              onPress={() => setShowEarlyEvents(true)}>
              <Text style={styles.showMoreText}>Show early events</Text>
              <IconSymbol name="chevron.down" size={16} color="#fff" />
            </TouchableOpacity>
          )}

          {showEarlyEvents && (
            <TouchableOpacity
              style={styles.showMoreButton}
              onPress={() => setShowEarlyEvents(false)}>
              <Text style={styles.showMoreText}>Show less</Text>
              <IconSymbol name="chevron.up" size={16} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </BottomSheetScrollView>
    );
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <MapViewWrapper
        userLocation={{
          latitude: trip.currentLocation.lat,
          longitude: trip.currentLocation.lng,
        }}
        userAvatar={trip.user.avatar}
        userName={trip.user.name}
        origin={{
          latitude: trip.origin.lat,
          longitude: trip.origin.lng,
        }}
        destination={{
          latitude: trip.destination.lat,
          longitude: trip.destination.lng,
        }}
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
            <Text style={styles.headerTitle}>Trip ID #{trip.tripId}</Text>
            <TouchableOpacity style={styles.shareButton}>
              <IconSymbol name="square.and.arrow.up" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Status Badge */}
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>IN TRANSIT</Text>
          </View>

          {/* Tab Navigation */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'overview' && styles.tabActive]}
              onPress={() => setActiveTab('overview')}>
              <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>
                Overview
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'activity' && styles.tabActive]}
              onPress={() => setActiveTab('activity')}>
              <Text style={[styles.tabText, activeTab === 'activity' && styles.tabTextActive]}>
                Activity
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab Content with Swipe Gesture */}
          <PanGestureHandler onHandlerStateChange={handleSwipe} activeOffsetX={[-10, 10]}>
            <View style={{ flex: 1 }}>
              {activeTab === 'overview' ? renderOverviewTab() : renderActivityTab()}
            </View>
          </PanGestureHandler>
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
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handleIndicator: {
    backgroundColor: '#ccc',
    width: 40,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadge: {
    backgroundColor: '#B4FF39',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 0.5,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#fff',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
  tabTextActive: {
    color: '#000',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#5170FF',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  userUsername: {
    fontSize: 14,
    color: '#666',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#5170FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  routeCard: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#B4FF39',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  routeIconContainer: {
    width: 32,
    height: 32,
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
    height: 24,
    backgroundColor: '#e0e0e0',
    marginLeft: 15,
    marginVertical: 4,
  },
  routeDetails: {
    flex: 1,
    marginLeft: 12,
  },
  routeLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  routeAddress: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  routeTime: {
    fontSize: 12,
    color: '#999',
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timelineLeft: {
    alignItems: 'center',
    marginRight: 16,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e0e0e0',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  timelineDotCompleted: {
    backgroundColor: '#34C759',
  },
  timelineDotPending: {
    backgroundColor: '#FFA500',
  },
  checkmarkContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#B4FF39',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#e0e0e0',
    marginTop: 4,
    minHeight: 40,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 8,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  timelineTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  timelineTime: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
  },
  timelineLocation: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  timelinePhoto: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginTop: 8,
    backgroundColor: '#f0f0f0',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
    gap: 6,
  },
  pendingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFA500',
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
});

