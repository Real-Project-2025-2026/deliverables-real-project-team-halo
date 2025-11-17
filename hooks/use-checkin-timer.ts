import { useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import type { Trip } from '@/services/trip-service';
import * as checkinService from '@/services/checkin-service';
import * as tripService from '@/services/trip-service';

interface UseCheckinTimerReturn {
  pendingCheckin: checkinService.Checkin | null;
  timeUntilNextCheckin: number | null; // seconds
  missedCheckinsCount: number;
  createNextCheckin: () => Promise<void>;
  respondToCheckin: (response: 'ok' | 'help') => Promise<void>;
}

interface UseCheckinTimerParams {
  trip: Trip | null;
  isActive: boolean;
  onCheckinCreated?: (checkin: checkinService.Checkin) => void;
  onCheckinMissed?: (checkin: checkinService.Checkin) => void;
}

const CHECKIN_RESPONSE_TIMEOUT = 2 * 60 * 1000; // 2 minutes
const CHECKIN_VIBRATION_TIMEOUT = 4 * 60 * 1000; // 4 minutes total (2 min after response timeout)

export function useCheckinTimer({
  trip,
  isActive,
  onCheckinCreated,
  onCheckinMissed,
}: UseCheckinTimerParams): UseCheckinTimerReturn {
  const [pendingCheckin, setPendingCheckin] = useState<checkinService.Checkin | null>(null);
  const [timeUntilNextCheckin, setTimeUntilNextCheckin] = useState<number | null>(null);
  const [missedCheckinsCount, setMissedCheckinsCount] = useState(0);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const checkinTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const vibrationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timeUntilNextRef = useRef<NodeJS.Timeout | null>(null);
  const lastCheckinTimeRef = useRef<Date | null>(null);

  // Load pending check-ins when trip changes
  useEffect(() => {
    if (!trip || !isActive) {
      setPendingCheckin(null);
      setTimeUntilNextCheckin(null);
      return;
    }

    loadPendingCheckins();
    loadMissedCheckinsCount();
  }, [trip?.id, isActive]);

  // Start timer when trip is active
  useEffect(() => {
    if (!trip || !isActive) {
      clearTimers();
      return;
    }

    // Only start timer for interval or continuous mode
    if (trip.mode === 'silent') {
      return;
    }

    startTimer();

    return () => {
      clearTimers();
    };
  }, [trip, isActive]);

  // Update time until next check-in
  useEffect(() => {
    if (!trip || !isActive || trip.mode === 'silent') {
      setTimeUntilNextCheckin(null);
      return;
    }

    const updateTimeUntilNext = () => {
      if (!lastCheckinTimeRef.current) {
        // First check-in should happen after interval
        const intervalSeconds = trip.checkin_interval_minutes * 60;
        setTimeUntilNextCheckin(intervalSeconds);
        return;
      }

      const now = Date.now();
      const lastCheckin = lastCheckinTimeRef.current.getTime();
      const intervalMs = trip.checkin_interval_minutes * 60 * 1000;
      const nextCheckinTime = lastCheckin + intervalMs;
      const secondsUntilNext = Math.max(0, Math.floor((nextCheckinTime - now) / 1000));

      setTimeUntilNextCheckin(secondsUntilNext);
    };

    updateTimeUntilNext();
    const interval = setInterval(updateTimeUntilNext, 1000);

    return () => clearInterval(interval);
  }, [trip, isActive, pendingCheckin]);

  async function loadPendingCheckins() {
    if (!trip) return;

    try {
      const { data, error } = await checkinService.getPendingCheckins(trip.id);
      
      if (error) {
        console.error('Error loading pending check-ins:', error);
        return;
      }

      if (data && data.length > 0) {
        // Get the most recent pending check-in
        const latest = data[0];
        setPendingCheckin(latest);
        setupCheckinTimeouts(latest);
      }
    } catch (error) {
      console.error('Error loading pending check-ins:', error);
    }
  }

  async function loadMissedCheckinsCount() {
    if (!trip) return;

    try {
      setMissedCheckinsCount(trip.missed_checkins_count || 0);
    } catch (error) {
      console.error('Error loading missed check-ins count:', error);
    }
  }

  function startTimer() {
    if (!trip) return;

    // Clear existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Set initial check-in time
    if (!lastCheckinTimeRef.current) {
      lastCheckinTimeRef.current = new Date();
    }

    // Create first check-in after interval
    const intervalMs = trip.checkin_interval_minutes * 60 * 1000;
    
    timerRef.current = setTimeout(() => {
      createNextCheckin();
    }, intervalMs);
  }

  async function createNextCheckin() {
    if (!trip) return;

    try {
      // Get current location if available
      let latitude: number | undefined;
      let longitude: number | undefined;

      try {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (location) {
          latitude = location.coords.latitude;
          longitude = location.coords.longitude;
        }
      } catch (error) {
        console.warn('Could not get location for check-in:', error);
      }

      // Calculate due time (2 minutes from now)
      const dueAt = new Date(Date.now() + CHECKIN_RESPONSE_TIMEOUT);

      const { data: checkin, error } = await checkinService.createCheckin(
        trip.id,
        dueAt,
        latitude,
        longitude
      );

      if (error || !checkin) {
        console.error('Error creating check-in:', error);
        return;
      }

      setPendingCheckin(checkin);
      lastCheckinTimeRef.current = new Date();
      setTimeUntilNextCheckin(null);

      // Setup timeouts for this check-in
      setupCheckinTimeouts(checkin);

      // Send push notification for check-in
      try {
        const { sendCheckinNotification } = await import('@/services/notification-service');
        await sendCheckinNotification(checkin.id).catch((err) => {
          console.warn('Error sending check-in notification:', err);
          // Don't fail check-in creation if notification fails
        });
      } catch (err) {
        console.warn('Error importing notification service:', err);
        // Don't fail check-in creation if notification import fails
      }

      // Notify callback
      onCheckinCreated?.(checkin);

      // Schedule next check-in after response timeout
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      const intervalMs = trip.checkin_interval_minutes * 60 * 1000;
      // Wait for response timeout, then schedule next check-in
      setTimeout(() => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(() => {
          createNextCheckin();
        }, intervalMs - CHECKIN_RESPONSE_TIMEOUT);
      }, CHECKIN_RESPONSE_TIMEOUT);
    } catch (error) {
      console.error('Error creating check-in:', error);
    }
  }

  function setupCheckinTimeouts(checkin: checkinService.Checkin) {
    // Clear existing timeouts
    if (checkinTimeoutRef.current) {
      clearTimeout(checkinTimeoutRef.current);
    }
    if (vibrationTimeoutRef.current) {
      clearTimeout(vibrationTimeoutRef.current);
    }

    const now = Date.now();
    const dueTime = new Date(checkin.due_at).getTime();
    const timeUntilDue = Math.max(0, dueTime - now);

    // After response timeout, mark as missed
    checkinTimeoutRef.current = setTimeout(async () => {
      if (checkin.status === 'pending') {
        await handleCheckinMissed(checkin);
      }
    }, timeUntilDue);

    // After vibration timeout, send vibration (if not already sent)
    vibrationTimeoutRef.current = setTimeout(async () => {
      if (checkin.status === 'pending' && !checkin.vibration_sent) {
        await sendVibration(checkin);
      }
    }, CHECKIN_VIBRATION_TIMEOUT);
  }

  async function handleCheckinMissed(checkin: checkinService.Checkin) {
    try {
      const { error } = await checkinService.markCheckinMissed(checkin.id);

      if (error) {
        console.error('Error marking check-in as missed:', error);
        return;
      }

      setPendingCheckin(null);

      // Increment missed check-ins count in database
      if (trip) {
        const { missedCount, error: incrementError } = await tripService.incrementMissedCheckins(trip.id);
        
        if (incrementError) {
          console.error('Error incrementing missed check-ins:', incrementError);
        } else {
          // Update local state with new count from database
          setMissedCheckinsCount(missedCount);
          
          // Check if escalation is needed (2+ missed check-ins)
          if (missedCount >= 2) {
            console.log(`Escalating trip: ${missedCount} missed check-ins`);
            const { error: escalateError } = await tripService.escalateTrip(trip.id);
            
            if (escalateError) {
              console.error('Error escalating trip:', escalateError);
            } else {
              // Reload trip to get updated status
              const { data: updatedTrip } = await tripService.getActiveTrip();
              if (updatedTrip) {
                setMissedCheckinsCount(updatedTrip.missed_checkins_count || 0);
              }
            }
          }
        }
      }

      onCheckinMissed?.(checkin);
    } catch (error) {
      console.error('Error handling missed check-in:', error);
    }
  }

  async function sendVibration(checkin: checkinService.Checkin) {
    try {
      const { vibrateCheckin } = await import('@/services/haptic-service');
      await vibrateCheckin();
      await checkinService.markVibrationSent(checkin.id);
    } catch (error) {
      console.error('Error sending vibration:', error);
    }
  }

  async function respondToCheckin(response: 'ok' | 'help'): Promise<void> {
    if (!pendingCheckin) return;

    try {
      // Clear timeouts
      if (checkinTimeoutRef.current) {
        clearTimeout(checkinTimeoutRef.current);
      }
      if (vibrationTimeoutRef.current) {
        clearTimeout(vibrationTimeoutRef.current);
      }

      const { error } = await checkinService.respondToCheckin(pendingCheckin.id, response);

      if (error) {
        console.error('Error responding to check-in:', error);
        return;
      }

      setPendingCheckin(null);

      // If response is "help", escalate immediately
      if (response === 'help' && trip) {
        await tripService.escalateTrip(trip.id);
      }
    } catch (error) {
      console.error('Error responding to check-in:', error);
    }
  }

  function clearTimers() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (checkinTimeoutRef.current) {
      clearTimeout(checkinTimeoutRef.current);
      checkinTimeoutRef.current = null;
    }
    if (vibrationTimeoutRef.current) {
      clearTimeout(vibrationTimeoutRef.current);
      vibrationTimeoutRef.current = null;
    }
    if (timeUntilNextRef.current) {
      clearInterval(timeUntilNextRef.current);
      timeUntilNextRef.current = null;
    }
  }

  return {
    pendingCheckin,
    timeUntilNextCheckin,
    missedCheckinsCount,
    createNextCheckin,
    respondToCheckin,
  };
}

