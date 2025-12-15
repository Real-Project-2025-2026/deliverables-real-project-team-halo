import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    NativeScrollEvent,
    NativeSyntheticEvent,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CheckinModal } from '@/components/checkin-modal';
import { MapViewWrapper } from '@/components/map-view-wrapper';
import { PanicButton } from '@/components/panic-button';
import { PanicOverlay } from '@/components/panic-overlay';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { colors, radii, shadows, spacing, typography } from '@/constants/design-tokens';
import { useCheckinTimer } from '@/hooks/use-checkin-timer';
import { useLocation } from '@/hooks/use-location';
import { useRouteTracker } from '@/hooks/use-route-tracker';
import { useTrip } from '@/hooks/use-trip';
import { useAuth } from '@/providers/auth-provider';
import { startAlarm, stopAlarm } from '@/services/alarm-service';
import { stopBackgroundLocationTracking } from '@/services/background-location';
import * as checkinService from '@/services/checkin-service';
import { hapticFeedback, vibrateEmergency } from '@/services/haptic-service';
import {
    sendCheckinNotification,
    sendEscalationNotification,
} from '@/services/notification-service';
import { logPanicEvent, triggerPanicAlarm } from '@/services/panic-service';
import * as tripService from '@/services/trip-service';
import { DUMMY_TRIP_GUARDIANS, type TripGuardian } from '@/types/guardian-request';
import { calculateTotalDistance } from '@/utils/route-helpers';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const TIMER_SIZE = 160;
const PAGE_WIDTH = SCREEN_WIDTH;
const SOS_BUTTON_SIZE = 100;

/**
 * Format time as MM:SS
 */
function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format duration for elapsed time
 */
function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes} min`;
}

/**
 * Get timer state colors based on remaining time
 */
function getTimerState(secondsRemaining: number | null, intervalMinutes: number) {
  if (secondsRemaining === null) return { color: colors.primary[500], state: 'waiting' };
  
  const totalSeconds = intervalMinutes * 60;
  const percentage = secondsRemaining / totalSeconds;
  
  if (percentage > 0.5) {
    return { color: colors.success.main, state: 'safe' };
  } else if (percentage > 0.2) {
    return { color: colors.warning.main, state: 'warning' };
  } else {
    return { color: colors.error.main, state: 'urgent' };
  }
}

/**
 * Active Trip Screen - Airbnb-Inspired Redesign with Swipeable Panels
 */
export default function ActiveTripScreen() {
  const { profile } = useAuth();
  const { activeTrip, completeTrip, isLoading, updateLocation, refreshActiveTrip } = useTrip();
  const { location, startWatchingLocation, stopWatchingLocation } = useLocation();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [checkinModalVisible, setCheckinModalVisible] = useState(false);
  const [isEscalating, setIsEscalating] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const isCompletingRef = useRef(false);
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Trip Guardians (people watching over this trip)
  const [tripGuardians] = useState<TripGuardian[]>(DUMMY_TRIP_GUARDIANS);
  
  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ============= SOS/Panic Button State (same as CustomTabBar) =============
  const [panicOverlayVisible, setPanicOverlayVisible] = useState(false);
  const [isInCancelZoneState, setIsInCancelZoneState] = useState(false);
  const [isPanicTriggering, setIsPanicTriggering] = useState(false);
  const [panicTriggerComplete, setPanicTriggerComplete] = useState(false);
  
  const isInCancelZoneRef = useRef(false);
  const lastHapticDistance = useRef<number>(Infinity);
  const hapticThrottleRef = useRef<number>(0);

  // Route tracking
  const {
    routePoints,
    addRoutePoint,
    refreshRoutePoints,
  } = useRouteTracker({
    tripId: activeTrip?.id ?? null,
    enabled: !!activeTrip && (activeTrip.status === 'active' || activeTrip.status === 'escalated'),
    shouldRecordOptions: {
      minDistanceMeters: 10,
      minTimeSeconds: 30,
      maxAccuracyMeters: 50,
    },
    refreshInterval: 5000,
    autoSync: true,
  });

  const routeDistance = calculateTotalDistance(routePoints);
  const isEscalated = activeTrip?.status === 'escalated';

  // Check-in timer
  const {
    pendingCheckin,
    timeUntilNextCheckin,
    missedCheckinsCount,
    respondToCheckin,
    refreshPendingCheckin,
  } = useCheckinTimer({
    trip: activeTrip,
    isActive: !!activeTrip && activeTrip.status === 'active' && !isEscalated,
    onCheckinCreated: async (checkin) => {
      setCheckinModalVisible(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      await sendCheckinNotification(checkin.id);
    },
    onCheckinMissed: async (checkin) => {
      setCheckinModalVisible(false);
      
      const { data: updatedTrip } = await tripService.getActiveTrip();
      if (updatedTrip?.status === 'escalated') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          '🚨 Notfall-Eskalation',
          'Du hast mehrere Check-ins verpasst. Deine Notfallkontakte wurden benachrichtigt.',
          [{ text: 'OK', style: 'default' }],
          { cancelable: false }
        );
        await sendEscalationNotification();
        refreshActiveTrip();
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
          'Check-in verpasst',
          'Du hast einen Check-in verpasst. Bei einem weiteren Versäumnis werden deine Notfallkontakte benachrichtigt.'
        );
      }
    },
  });

  // Timer state
  const timerState = getTimerState(
    timeUntilNextCheckin,
    activeTrip?.checkin_interval_minutes || 5
  );

  // ============= Panic Button Handlers (same logic as CustomTabBar) =============
  const handlePanicActivate = useCallback(() => {
    setPanicOverlayVisible(true);
    setIsInCancelZoneState(false);
    isInCancelZoneRef.current = false;
    lastHapticDistance.current = Infinity;
    hapticThrottleRef.current = 0;
    setIsPanicTriggering(false);
    setPanicTriggerComplete(false);
  }, []);

  const handlePanicRelease = useCallback(async () => {
    const inCancelZone = isInCancelZoneRef.current;
    
    if (inCancelZone) {
      // Abgebrochen - in Cancel Zone losgelassen
      hapticFeedback('success');
      logPanicEvent('cancelled');
      stopAlarm();
      setPanicOverlayVisible(false);
      setIsInCancelZoneState(false);
      isInCancelZoneRef.current = false;
    } else {
      // Alarm auslösen - außerhalb Cancel Zone losgelassen
      if (isPanicTriggering) return;
      
      setIsPanicTriggering(true);
      vibrateEmergency();
      startAlarm();
      
      try {
        let panicLocation: { latitude: number; longitude: number } | undefined;
        try {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status === 'granted') {
            const currentLocation = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
            });
            panicLocation = {
              latitude: currentLocation.coords.latitude,
              longitude: currentLocation.coords.longitude,
            };
          }
        } catch (locError) {
          console.error('Error getting location for panic:', locError);
        }
        
        await triggerPanicAlarm(panicLocation);
        
        setPanicTriggerComplete(true);
        
        setTimeout(() => {
          setPanicOverlayVisible(false);
          setIsInCancelZoneState(false);
          isInCancelZoneRef.current = false;
          setIsPanicTriggering(false);
          setPanicTriggerComplete(false);
          
          setTimeout(() => {
            stopAlarm();
          }, 30000);
        }, 2500);
        
      } catch (error) {
        console.error('Error triggering panic alarm:', error);
        stopAlarm();
        setIsPanicTriggering(false);
        setPanicOverlayVisible(false);
      }
    }
  }, [isPanicTriggering]);

  const handlePanicDrag = useCallback((dx: number, dy: number) => {
    const targetY = -(SCREEN_HEIGHT / 2 - 150);
    const distanceToTarget = Math.abs(dy - targetY) + Math.abs(dx) * 0.5;
    
    const verticalThreshold = -(SCREEN_HEIGHT / 2 - 150);
    const horizontalThreshold = 100;
    const inZone = dy < verticalThreshold && Math.abs(dx) < horizontalThreshold;
    
    isInCancelZoneRef.current = inZone;
    
    const now = Date.now();
    if (now - hapticThrottleRef.current > 100) {
      const maxDistance = 400;
      const proximity = Math.max(0, 1 - distanceToTarget / maxDistance);
      
      if (proximity > 0.3) {
        if (proximity > 0.9 || inZone) {
          hapticFeedback('heavy');
          hapticThrottleRef.current = now;
        } else if (proximity > 0.7) {
          hapticFeedback('medium');
          hapticThrottleRef.current = now;
        } else if (proximity > 0.5 && distanceToTarget < lastHapticDistance.current - 30) {
          hapticFeedback('light');
          hapticThrottleRef.current = now;
          lastHapticDistance.current = distanceToTarget;
        }
      }
    }
    
    if (inZone !== isInCancelZoneState) {
      setIsInCancelZoneState(inZone);
    }
  }, [isInCancelZoneState]);

  // ============= Regular Handlers =============

  // Fade in on mount
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  // Pulse animation when urgent
  useEffect(() => {
    if (timerState.state === 'urgent') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [timerState.state]);

  // Update elapsed time
  useEffect(() => {
    if (!activeTrip) {
      setElapsedSeconds(0);
      return;
    }

    const startTime = new Date(activeTrip.started_at).getTime();
    
    const updateElapsed = () => {
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000);
      setElapsedSeconds(elapsed);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [activeTrip]);

  // Refresh route on focus
  useFocusEffect(
    useCallback(() => {
      if (activeTrip && !isEscalated) {
        refreshRoutePoints().catch(console.error);
      }
    }, [activeTrip, isEscalated, refreshRoutePoints])
  );

  // Location tracking
  useEffect(() => {
    if (!activeTrip) {
      stopWatchingLocation();
      return;
    }

    if (activeTrip.mode === 'continuous' || activeTrip.mode === 'interval') {
      startWatchingLocation((newLocation) => {
        updateLocation(
          newLocation.coords.latitude,
          newLocation.coords.longitude,
          {
            accuracy: newLocation.coords.accuracy ?? undefined,
            altitude: newLocation.coords.altitude ?? undefined,
            heading: newLocation.coords.heading ?? undefined,
            speed: newLocation.coords.speed ?? undefined,
          }
        );

        addRoutePoint({
          latitude: newLocation.coords.latitude,
          longitude: newLocation.coords.longitude,
          accuracy: newLocation.coords.accuracy ?? null,
          timestamp: newLocation.timestamp ?? Date.now(),
        }).catch(console.error);
      });
    }

    return () => stopWatchingLocation();
  }, [activeTrip]);

  // Check-in modal handling
  useEffect(() => {
    if (pendingCheckin) {
      const verifyAndShow = async () => {
        if (!activeTrip) return;
        
        try {
          const { data: pendingCheckins } = await checkinService.getPendingCheckins(activeTrip.id);
          const isStillPending = pendingCheckins?.some(c => c.id === pendingCheckin.id);
          
          if (isStillPending) {
            setCheckinModalVisible(true);
          } else {
            await refreshPendingCheckin();
            setCheckinModalVisible(false);
          }
        } catch (error) {
          setCheckinModalVisible(true);
        }
      };
      
      verifyAndShow();
    } else {
      setCheckinModalVisible(false);
    }
  }, [pendingCheckin, activeTrip, refreshPendingCheckin]);

  // Refresh check-in on focus
  useFocusEffect(
    useCallback(() => {
      if (activeTrip && !isEscalated) {
        refreshPendingCheckin().catch(console.error);
      }
    }, [activeTrip, isEscalated, refreshPendingCheckin])
  );

  async function handleRespondToCheckin(response: 'ok' | 'help') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await respondToCheckin(response);
    setCheckinModalVisible(false);
  }

  async function handleCompleteTrip() {
    if (isCompletingRef.current) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    Alert.alert(
      'Trip beenden',
      'Bist du sicher angekommen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Ja, ich bin sicher',
          style: 'default',
          onPress: async () => {
            if (isCompletingRef.current) return;

            try {
              isCompletingRef.current = true;
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              
              stopWatchingLocation();
              await stopBackgroundLocationTracking();
              
              const { success } = await completeTrip();
              
              if (success) {
                router.replace('/(tabs)');
              } else {
                isCompletingRef.current = false;
                Alert.alert('Fehler', 'Trip konnte nicht beendet werden.');
              }
            } catch (error) {
              isCompletingRef.current = false;
              Alert.alert('Fehler', 'Etwas ist schiefgelaufen.');
            }
          },
        },
      ]
    );
  }

  async function handleNeedHelp() {
    if (!activeTrip || isEscalated) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    Alert.alert(
      '🚨 Hilfe anfordern?',
      'Deine Notfallkontakte werden sofort benachrichtigt.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Ja, Alarm senden',
          style: 'destructive',
          onPress: async () => {
            setIsEscalating(true);
            try {
              const { error } = await tripService.escalateTrip(activeTrip.id);
              
              if (error) {
                Alert.alert('Fehler', 'Alarm konnte nicht gesendet werden.');
                setIsEscalating(false);
                return;
              }

              await sendEscalationNotification();
              await refreshActiveTrip();

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert(
                'Alarm gesendet',
                'Deine Notfallkontakte wurden benachrichtigt.',
                [{ text: 'OK' }]
              );
            } catch (error) {
              Alert.alert('Fehler', 'Etwas ist schiefgelaufen.');
            } finally {
              setIsEscalating(false);
            }
          },
        },
      ]
    );
  }

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / PAGE_WIDTH);
    if (page !== currentPage) {
      setCurrentPage(page);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  // Loading state
  if (!activeTrip) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text style={styles.loadingText}>Trip wird geladen...</Text>
        </View>
      </View>
    );
  }

  // Calculate progress percentage for timer ring
  const progressPercentage = timeUntilNextCheckin !== null && activeTrip
    ? 1 - (timeUntilNextCheckin / (activeTrip.checkin_interval_minutes * 60))
    : 0;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Panic Overlay - fullscreen mode for this screen */}
      <PanicOverlay
        visible={panicOverlayVisible}
        isInCancelZone={isInCancelZoneState}
        isTriggering={isPanicTriggering}
        triggerComplete={panicTriggerComplete}
        fullscreen
      />

      {/* Map Background */}
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
        userAvatar={profile?.avatar_url || null}
        userName={profile?.full_name || profile?.username || null}
        origin={
          activeTrip.origin_latitude && activeTrip.origin_longitude
            ? {
                latitude: activeTrip.origin_latitude,
                longitude: activeTrip.origin_longitude,
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
        routePoints={
          routePoints && routePoints.length > 0
            ? routePoints.map((point) => ({
                latitude: point.latitude,
                longitude: point.longitude,
              }))
            : []
        }
      />

      {/* Floating Header */}
      <SafeAreaView style={styles.headerContainer} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={styles.backButton}
            activeOpacity={0.8}
          >
            <IconSymbol name="chevron.left" size={20} color={colors.text.primary} />
          </TouchableOpacity>

          {isEscalated ? (
            <View style={[styles.statusBadge, styles.escalatedBadge]}>
              <View style={styles.statusDot} />
              <Text style={styles.statusTextEscalated}>NOTFALL</Text>
            </View>
          ) : (
            <View style={styles.statusBadge}>
              <View style={[styles.statusDot, { backgroundColor: colors.success.main }]} />
              <Text style={styles.statusText}>Unterwegs</Text>
            </View>
          )}

          <View style={styles.elapsedBadge}>
            <Text style={styles.elapsedText}>{formatDuration(elapsedSeconds)}</Text>
          </View>
        </View>
      </SafeAreaView>

      {/* Bottom Sheet with Swipeable Pages */}
      <SafeAreaView style={styles.bottomSheet} edges={['bottom']}>
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        {/* Page Indicators */}
        <View style={styles.pageIndicators}>
          <View style={[styles.pageIndicator, currentPage === 0 && styles.pageIndicatorActive]} />
          <View style={[styles.pageIndicator, currentPage === 1 && styles.pageIndicatorActive]} />
          <View style={[styles.pageIndicator, currentPage === 2 && styles.pageIndicatorActive]} />
        </View>

        {/* Swipeable Content */}
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          decelerationRate="fast"
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          scrollEnabled={!panicOverlayVisible}
        >
          {/* Page 1: Status & Quick Actions */}
          <View style={[styles.page, { width: PAGE_WIDTH }]}>
            {/* Emergency Banner */}
            {isEscalated && (
              <View style={styles.emergencyBanner}>
                <IconSymbol name="exclamationmark.triangle.fill" size={20} color="#fff" />
                <Text style={styles.emergencyText}>
                  Notfallkontakte wurden benachrichtigt
                </Text>
              </View>
            )}

            {/* Hero: Check-in Timer */}
            {!isEscalated && activeTrip.mode !== 'silent' && (
              <Animated.View style={[styles.timerContainer, { transform: [{ scale: pulseAnim }] }]}>
                <View style={[styles.timerRing, { borderColor: colors.neutral[100] }]}>
                  <View 
                    style={[
                      styles.timerRingProgress, 
                      { 
                        borderColor: timerState.color,
                        opacity: progressPercentage > 0 ? 1 : 0,
                      }
                    ]} 
                  />
                  <View style={styles.timerContent}>
                    <Text style={[styles.timerValue, { color: timerState.color }]}>
                      {timeUntilNextCheckin !== null ? formatTime(timeUntilNextCheckin) : '--:--'}
                    </Text>
                    <Text style={styles.timerLabel}>
                      {timerState.state === 'urgent' ? 'Check-in jetzt!' : 'Nächster Check-in'}
                    </Text>
                  </View>
                </View>
              </Animated.View>
            )}

            {/* Silent Mode Info */}
            {activeTrip.mode === 'silent' && !isEscalated && (
              <View style={styles.silentModeCard}>
                <View style={styles.silentModeIcon}>
                  <IconSymbol name="moon.fill" size={28} color={colors.primary[500]} />
                </View>
                <View style={styles.silentModeContent}>
                  <Text style={styles.silentModeTitle}>Stiller Modus</Text>
                  <Text style={styles.silentModeSubtitle}>Keine Check-ins erforderlich</Text>
                </View>
              </View>
            )}

            {/* Trip Stats */}
            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <IconSymbol name="figure.walk" size={20} color={colors.primary[500]} />
                <View style={styles.statContent}>
                  <Text style={styles.statValue}>
                    {routeDistance >= 1000
                      ? `${(routeDistance / 1000).toFixed(1)} km`
                      : `${Math.round(routeDistance)} m`}
                  </Text>
                  <Text style={styles.statLabel}>Distanz</Text>
                </View>
              </View>
              
              <View style={styles.statCard}>
                <IconSymbol name="shield.fill" size={20} color={colors.success.main} />
                <View style={styles.statContent}>
                  <Text style={styles.statValue}>
                    {activeTrip.mode === 'interval' ? `${activeTrip.checkin_interval_minutes}m` : 
                     activeTrip.mode === 'silent' ? 'Aus' : 'Aktiv'}
                  </Text>
                  <Text style={styles.statLabel}>Intervall</Text>
                </View>
              </View>
            </View>

            {/* Swipe Hint */}
            <View style={styles.swipeHint}>
              <IconSymbol name="chevron.right.2" size={16} color={colors.text.tertiary} />
              <Text style={styles.swipeHintText}>Wische für SOS</Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
              {!isEscalated && (
                <TouchableOpacity
                  style={styles.helpButton}
                  onPress={handleNeedHelp}
                  disabled={isLoading || isEscalating}
                  activeOpacity={0.9}
                >
                  {isEscalating ? (
                    <ActivityIndicator color={colors.error.main} />
                  ) : (
                    <>
                      <IconSymbol name="exclamationmark.triangle.fill" size={20} color={colors.error.main} />
                      <Text style={styles.helpButtonText}>Hilfe</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.endTripButton, isEscalated && styles.endTripButtonFull]}
                onPress={handleCompleteTrip}
                disabled={isLoading || isCompletingRef.current}
                activeOpacity={0.9}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <IconSymbol name="checkmark.circle.fill" size={22} color="#fff" />
                    <Text style={styles.endTripButtonText}>Sicher angekommen</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Page 2: SOS & Info */}
          <View style={[styles.page, { width: PAGE_WIDTH }]}>
            {/* Page Title */}
            <View style={styles.pageTitleContainer}>
              <Text style={styles.pageTitle}>Notfall</Text>
              <Text style={styles.pageSubtitle}>
                3 Sekunden gedrückt halten für Alarm
              </Text>
            </View>

            {/* SOS Button - same approach as in tab bar */}
            <View style={[
              styles.sosButtonContainer,
              panicOverlayVisible && styles.sosButtonContainerActive,
            ]}>
              <PanicButton
                size={SOS_BUTTON_SIZE}
                onActivate={handlePanicActivate}
                onRelease={handlePanicRelease}
                onDrag={handlePanicDrag}
                disabled={isPanicTriggering}
                isOverlayActive={panicOverlayVisible}
              />
            </View>

            {/* Trip Info Cards */}
            <View style={styles.infoCardsContainer}>
              {/* Guardian Info */}
              {activeTrip.safetogether_enabled && (
                <View style={styles.infoCard}>
                  <View style={styles.infoCardIcon}>
                    <IconSymbol name="person.2.fill" size={18} color={colors.primary[500]} />
                  </View>
                  <View style={styles.infoCardContent}>
                    <Text style={styles.infoCardTitle}>Guardian aktiv</Text>
                    <Text style={styles.infoCardSubtitle}>Begleitet deinen Trip</Text>
                  </View>
                  <View style={[styles.statusDotSmall, { backgroundColor: colors.success.main }]} />
                </View>
              )}

              {/* Missed Check-ins Warning */}
              {missedCheckinsCount > 0 && (
                <View style={[styles.infoCard, styles.infoCardWarning]}>
                  <View style={[styles.infoCardIcon, { backgroundColor: colors.error.light }]}>
                    <IconSymbol name="exclamationmark.triangle.fill" size={18} color={colors.error.main} />
                  </View>
                  <View style={styles.infoCardContent}>
                    <Text style={[styles.infoCardTitle, { color: colors.error.main }]}>
                      {missedCheckinsCount} Check-in verpasst
                    </Text>
                    <Text style={styles.infoCardSubtitle}>Bitte checke bald ein</Text>
                  </View>
                </View>
              )}

              {/* Route Info */}
              <View style={styles.infoCard}>
                <View style={styles.infoCardIcon}>
                  <IconSymbol name="location.fill" size={18} color={colors.success.main} />
                </View>
                <View style={styles.infoCardContent}>
                  <Text style={styles.infoCardTitle}>
                    {activeTrip.destination_address 
                      ? activeTrip.destination_address.split(',')[0] 
                      : 'Ziel'}
                  </Text>
                  <Text style={styles.infoCardSubtitle}>
                    {routeDistance >= 1000
                      ? `${(routeDistance / 1000).toFixed(1)} km zurückgelegt`
                      : `${Math.round(routeDistance)} m zurückgelegt`}
                  </Text>
                </View>
              </View>
            </View>

            {/* Back Hint */}
            <View style={styles.swipeHintLeft}>
              <IconSymbol name="chevron.left.2" size={16} color={colors.text.tertiary} />
              <Text style={styles.swipeHintText}>Zurück zum Status</Text>
            </View>

            {/* Forward Hint */}
            <View style={styles.swipeHint}>
              <Text style={styles.swipeHintText}>Guardians</Text>
              <IconSymbol name="chevron.right.2" size={16} color={colors.text.tertiary} />
            </View>
          </View>

          {/* Page 3: Guardians List */}
          <View style={[styles.page, { width: PAGE_WIDTH }]}>
            {/* Page Title */}
            <View style={styles.pageTitleContainer}>
              <Text style={styles.pageTitle}>Deine Guardians</Text>
              <Text style={styles.pageSubtitle}>
                {tripGuardians.filter(g => g.status !== 'declined').length} Personen begleiten dich
              </Text>
            </View>

            {/* Guardians List */}
            <View style={styles.guardiansListContainer}>
              {tripGuardians.map((guardian) => (
                <View key={guardian.id} style={styles.guardianListItem}>
                  {/* Avatar */}
                  <View style={[
                    styles.guardianAvatar,
                    guardian.status === 'declined' && styles.guardianAvatarDeclined,
                  ]}>
                    <Text style={styles.guardianAvatarText}>
                      {(guardian.guardian?.full_name || guardian.guardian?.username || '?')[0].toUpperCase()}
                    </Text>
                  </View>

                  {/* Info */}
                  <View style={styles.guardianListItemInfo}>
                    <Text style={[
                      styles.guardianListItemName,
                      guardian.status === 'declined' && styles.guardianListItemNameDeclined,
                    ]}>
                      {guardian.guardian?.full_name || guardian.guardian?.username || 'Guardian'}
                    </Text>
                    <Text style={styles.guardianListItemUsername}>
                      @{guardian.guardian?.username || 'unknown'}
                    </Text>
                  </View>

                  {/* Status Badge */}
                  <View style={[
                    styles.guardianStatusBadge,
                    guardian.status === 'accepted' && styles.guardianStatusAccepted,
                    guardian.status === 'requested' && styles.guardianStatusRequested,
                    guardian.status === 'declined' && styles.guardianStatusDeclined,
                  ]}>
                    <IconSymbol 
                      name={
                        guardian.status === 'accepted' ? 'checkmark.circle.fill' :
                        guardian.status === 'declined' ? 'xmark.circle.fill' :
                        'clock.fill'
                      } 
                      size={14} 
                      color={
                        guardian.status === 'accepted' ? colors.success.main :
                        guardian.status === 'declined' ? colors.error.main :
                        colors.warning.main
                      } 
                    />
                    <Text style={[
                      styles.guardianStatusText,
                      guardian.status === 'accepted' && styles.guardianStatusTextAccepted,
                      guardian.status === 'requested' && styles.guardianStatusTextRequested,
                      guardian.status === 'declined' && styles.guardianStatusTextDeclined,
                    ]}>
                      {guardian.status === 'accepted' ? 'Akzeptiert' :
                       guardian.status === 'declined' ? 'Abgelehnt' :
                       'Angefragt'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Info Text */}
            <View style={styles.guardianInfoBox}>
              <IconSymbol name="info.circle.fill" size={18} color={colors.primary[500]} />
              <Text style={styles.guardianInfoText}>
                Guardians die akzeptiert oder noch nicht geantwortet haben, erhalten Updates zu deinem Trip.
              </Text>
            </View>

            {/* Back Hint */}
            <View style={styles.swipeHintLeft}>
              <IconSymbol name="chevron.left.2" size={16} color={colors.text.tertiary} />
              <Text style={styles.swipeHintText}>Zurück zum SOS</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Check-in Modal */}
      <CheckinModal
        visible={checkinModalVisible}
        checkin={pendingCheckin}
        onRespond={handleRespondToCheckin}
        onClose={() => setCheckinModalVisible(false)}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[900],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
  },
  loadingText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    color: colors.text.secondary,
  },

  // Header
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.neutral[0],
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    gap: spacing.sm,
    ...shadows.md,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success.main,
  },
  statusDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
  },
  statusTextEscalated: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: '#fff',
    letterSpacing: 0.5,
  },
  escalatedBadge: {
    backgroundColor: colors.error.main,
  },
  elapsedBadge: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    ...shadows.sm,
  },
  elapsedText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.text.secondary,
  },

  // Bottom Sheet
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: radii['3xl'],
    borderTopRightRadius: radii['3xl'],
    ...shadows.xl,
    paddingBottom: spacing.lg,
    maxHeight: SCREEN_HEIGHT * 0.55,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral[200],
  },

  // Page Indicators
  pageIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  pageIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.neutral[200],
  },
  pageIndicatorActive: {
    backgroundColor: colors.primary[500],
    width: 24,
  },

  // ScrollView
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
  },

  // Page
  page: {
    paddingHorizontal: spacing.xl,
  },

  // Emergency Banner
  emergencyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error.main,
    padding: spacing.lg,
    borderRadius: radii.xl,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  emergencyText: {
    flex: 1,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: '#fff',
  },

  // Timer
  timerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  timerRing: {
    width: TIMER_SIZE,
    height: TIMER_SIZE,
    borderRadius: TIMER_SIZE / 2,
    borderWidth: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
  },
  timerRingProgress: {
    position: 'absolute',
    width: TIMER_SIZE,
    height: TIMER_SIZE,
    borderRadius: TIMER_SIZE / 2,
    borderWidth: 8,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  timerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerValue: {
    fontSize: 40,
    fontWeight: typography.weight.bold,
    letterSpacing: -1,
  },
  timerLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },

  // Silent Mode
  silentModeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[50],
    padding: spacing.lg,
    borderRadius: radii.xl,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  silentModeIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.neutral[0],
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  silentModeContent: {
    flex: 1,
  },
  silentModeTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
  },
  silentModeSubtitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.regular,
    color: colors.text.secondary,
    marginTop: 2,
  },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[50],
    padding: spacing.md,
    borderRadius: radii.xl,
    gap: spacing.sm,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Swipe Hint
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  swipeHintLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
  swipeHintText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.text.tertiary,
  },

  // Actions
  actionsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.error.light,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.full,
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: `${colors.error.main}30`,
  },
  helpButtonText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.error.main,
  },
  endTripButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success.main,
    paddingVertical: spacing.md,
    borderRadius: radii.full,
    gap: spacing.sm,
    ...shadows.md,
    shadowColor: colors.success.main,
    shadowOpacity: 0.3,
  },
  endTripButtonFull: {
    flex: 1,
  },
  endTripButtonText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: '#fff',
  },

  // Page 2: SOS
  pageTitleContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  pageTitle: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
  },
  pageSubtitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.regular,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },

  // SOS Placeholder in ScrollView - keeps layout consistent
  // SOS Button Container - same approach as tab bar
  sosButtonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    zIndex: 1,
  },
  sosButtonContainerActive: {
    zIndex: 10001,
    elevation: 10001,
  },

  // Info Cards
  infoCardsContainer: {
    gap: spacing.md,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[50],
    padding: spacing.md,
    borderRadius: radii.xl,
    gap: spacing.md,
  },
  infoCardWarning: {
    backgroundColor: colors.error.light,
    borderWidth: 1,
    borderColor: `${colors.error.main}20`,
  },
  infoCardIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoCardContent: {
    flex: 1,
  },
  infoCardTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
  },
  infoCardSubtitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.regular,
    color: colors.text.secondary,
    marginTop: 2,
  },

  // Page 3: Guardians List
  guardiansListContainer: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  guardianListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[50],
    padding: spacing.md,
    borderRadius: radii.xl,
    gap: spacing.md,
  },
  guardianAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  guardianAvatarDeclined: {
    backgroundColor: colors.neutral[200],
    opacity: 0.6,
  },
  guardianAvatarText: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.primary[600],
  },
  guardianListItemInfo: {
    flex: 1,
  },
  guardianListItemName: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
  },
  guardianListItemNameDeclined: {
    color: colors.text.tertiary,
    textDecorationLine: 'line-through',
  },
  guardianListItemUsername: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.regular,
    color: colors.text.secondary,
    marginTop: 2,
  },
  guardianStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    gap: spacing.xs,
  },
  guardianStatusAccepted: {
    backgroundColor: colors.success.light,
  },
  guardianStatusRequested: {
    backgroundColor: colors.warning.light,
  },
  guardianStatusDeclined: {
    backgroundColor: colors.error.light,
  },
  guardianStatusText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  guardianStatusTextAccepted: {
    color: colors.success.main,
  },
  guardianStatusTextRequested: {
    color: colors.warning.main,
  },
  guardianStatusTextDeclined: {
    color: colors.error.main,
  },
  guardianInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primary[50],
    padding: spacing.md,
    borderRadius: radii.lg,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  guardianInfoText: {
    flex: 1,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.regular,
    color: colors.text.secondary,
    lineHeight: 20,
  },
});
