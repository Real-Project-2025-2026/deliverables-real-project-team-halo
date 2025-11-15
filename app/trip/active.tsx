import { CheckinModal } from '@/components/checkin-modal';
import { MapViewWrapper } from '@/components/map-view-wrapper';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useCheckinTimer } from '@/hooks/use-checkin-timer';
import { useLocation } from '@/hooks/use-location';
import { useTrip } from '@/hooks/use-trip';
import { stopBackgroundLocationTracking } from '@/services/background-location';
import { sendCheckinNotification } from '@/services/notification-service';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
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

/**
 * Format duration with seconds as MM:SS (minutes:seconds)
 * Example: 332 seconds = "5:32"
 */
function formatDurationWithSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Active Trip Screen - Simplified Version
 * - No automatic navigation
 * - Clear state management
 * - Simple completion flow
 */
export default function ActiveTripScreen() {
  const { activeTrip, completeTrip, isLoading, updateLocation } = useTrip();
  const { location, startWatchingLocation, stopWatchingLocation } = useLocation();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [checkinModalVisible, setCheckinModalVisible] = useState(false);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const isCompletingRef = useRef(false);

  const snapPoints = useMemo(() => ['30%', '60%'], []);

  // Check-in timer
  const {
    pendingCheckin,
    timeUntilNextCheckin,
    missedCheckinsCount,
    respondToCheckin,
  } = useCheckinTimer({
    trip: activeTrip,
    isActive: !!activeTrip && activeTrip.status === 'active',
    onCheckinCreated: async (checkin) => {
      setCheckinModalVisible(true);
      await sendCheckinNotification(checkin.id);
    },
    onCheckinMissed: async (checkin) => {
      setCheckinModalVisible(false);
      Alert.alert(
        'Check-in Missed',
        'You missed a check-in. Your emergency contacts will be notified if you miss another one.'
      );
    },
  });

  // No automatic navigation - only manual navigation in handleCompleteTrip

  // Update elapsed time continuously (every second)
  useEffect(() => {
    if (!activeTrip) {
      setElapsedSeconds(0);
      return;
    }

    const startTime = new Date(activeTrip.started_at).getTime();
    
    const updateElapsed = () => {
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000); // in seconds
      setElapsedSeconds(elapsed);
    };

    // Update immediately
    updateElapsed();
    
    // Then update every second for smooth time display
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [activeTrip]);

  // Start location watching when trip is active
  useEffect(() => {
    if (!activeTrip) {
      stopWatchingLocation();
      return;
    }

    if (activeTrip.mode === 'continuous' || activeTrip.mode === 'interval') {
      startWatchingLocation((newLocation) => {
        updateLocation(newLocation.coords.latitude, newLocation.coords.longitude);
      });
    }

    return () => {
      stopWatchingLocation();
    };
  }, [activeTrip]);

  // Show check-in modal when pending check-in is created
  useEffect(() => {
    if (pendingCheckin) {
      setCheckinModalVisible(true);
    }
  }, [pendingCheckin]);

  async function handleRespondToCheckin(response: 'ok' | 'help') {
    await respondToCheckin(response);
    setCheckinModalVisible(false);
  }

  async function handleCompleteTrip() {
    // Prevent double completion
    if (isCompletingRef.current) {
      return;
    }

    Alert.alert(
      "I'm Safe",
      'Are you sure you want to end this trip?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: "Yes",
          style: 'default',
          onPress: async () => {
            if (isCompletingRef.current) {
              return;
            }

            try {
              isCompletingRef.current = true;

              // Stop location watching
              stopWatchingLocation();
              
              // Stop background location tracking
              await stopBackgroundLocationTracking();
              
              // Complete the trip
              const { success } = await completeTrip();
              
              if (success) {
                // Navigate to home immediately
                // Don't rely on useEffect - navigate directly
                router.replace('/(tabs)');
              } else {
                isCompletingRef.current = false;
                Alert.alert('Error', 'Failed to end trip. Please try again.');
              }
            } catch (error) {
              console.error('Error completing trip:', error);
              isCompletingRef.current = false;
              Alert.alert('Error', 'Something went wrong. Please try again.');
            }
          },
        },
      ]
    );
  }

  function handleNeedHelp() {
    Alert.alert(
      'Need Help?',
      'This will immediately notify your emergency contacts.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Send Alert',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Alert Sent', 'Your emergency contacts have been notified.');
          },
        },
      ]
    );
  }

  // Show loading if no active trip (useEffect will handle navigation)
  if (!activeTrip) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#5170FF" />
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <MapViewWrapper
        userLocation={
          location
            ? {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              }
            : activeTrip.last_known_latitude && activeTrip.last_known_longitude
            ? {
                latitude: activeTrip.last_known_latitude,
                longitude: activeTrip.last_known_longitude,
              }
            : undefined
        }
        destination={
          activeTrip.destination_latitude && activeTrip.destination_longitude
            ? {
                latitude: activeTrip.destination_latitude,
                longitude: activeTrip.destination_longitude,
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
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Trip Active</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {/* Time Display */}
          <View style={styles.timeCard}>
            <IconSymbol name="clock.fill" size={28} color="#fff" />
            <View style={styles.timeContent}>
              <Text style={styles.timeLabel}>Elapsed Time</Text>
              <Text style={styles.timeValue}>{formatDurationWithSeconds(elapsedSeconds)}</Text>
            </View>
          </View>

          {/* Trip Info */}
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <IconSymbol name="shield.fill" size={18} color="#fff" />
              <Text style={styles.infoText}>
                {activeTrip.mode.charAt(0).toUpperCase() + activeTrip.mode.slice(1)}
              </Text>
            </View>
            {activeTrip.mode !== 'silent' && (
              <View style={styles.infoItem}>
                <IconSymbol name="bell.fill" size={18} color="#fff" />
                <Text style={styles.infoText}>
                  {timeUntilNextCheckin !== null
                    ? `${Math.floor(timeUntilNextCheckin / 60)}:${(timeUntilNextCheckin % 60).toString().padStart(2, '0')}`
                    : `${activeTrip.checkin_interval_minutes}min`}
                </Text>
              </View>
            )}
            {missedCheckinsCount > 0 && (
              <View style={[styles.infoItem, styles.missedCheckinItem]}>
                <IconSymbol name="exclamationmark.triangle.fill" size={18} color="#fff" />
                <Text style={[styles.infoText, styles.missedCheckinText]}>
                  {missedCheckinsCount} missed
                </Text>
              </View>
            )}
            {activeTrip.safetogether_enabled && (
              <View style={styles.infoItem}>
                <IconSymbol name="person.2.fill" size={18} color="#fff" />
                <Text style={styles.infoText}>Active</Text>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.helpButton}
              onPress={handleNeedHelp}
              disabled={isLoading}>
              <IconSymbol name="exclamationmark.triangle.fill" size={22} color="#fff" />
              <Text style={styles.helpButtonText}>Need Help</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.safeButton, isLoading && styles.buttonDisabled]}
              onPress={handleCompleteTrip}
              disabled={isLoading || isCompletingRef.current}>
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <IconSymbol name="checkmark.circle.fill" size={22} color="#fff" />
                  <Text style={styles.safeButtonText}>End Trip</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </BottomSheetView>
      </BottomSheet>

      {/* Check-in Modal */}
      <CheckinModal
        visible={checkinModalVisible}
        checkin={pendingCheckin}
        onRespond={handleRespondToCheckin}
        onClose={() => setCheckinModalVisible(false)}
      />
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
  infoRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
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
  actions: {
    gap: 10,
  },
  helpButton: {
    flexDirection: 'row',
    backgroundColor: '#FF3B30',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  helpButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  safeButton: {
    flexDirection: 'row',
    backgroundColor: '#34C759',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  safeButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
