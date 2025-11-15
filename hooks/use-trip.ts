import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/providers/auth-provider';
import * as tripService from '@/services/trip-service';
import type { Trip, StartTripParams } from '@/services/trip-service';

interface UseTripReturn {
  activeTrip: Trip | null;
  isLoading: boolean;
  error: string | null;
  startTrip: (params: StartTripParams) => Promise<{ success: boolean; trip: Trip | null }>;
  completeTrip: () => Promise<{ success: boolean }>;
  cancelTrip: () => Promise<{ success: boolean }>;
  refreshActiveTrip: () => Promise<void>;
  updateLocation: (latitude: number, longitude: number) => Promise<void>;
}

/**
 * Simplified Trip Hook - Single Source of Truth
 * - No automatic navigation
 * - Clear state management
 * - Simple error handling
 */
export function useTrip(): UseTripReturn {
  const { user } = useAuth();
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load active trip on mount and when user changes
  useEffect(() => {
    if (user) {
      refreshActiveTrip();
    } else {
      setActiveTrip(null);
    }
  }, [user]);

  const refreshActiveTrip = useCallback(async () => {
    if (!user) {
      setActiveTrip(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const { data, error: tripError } = await tripService.getActiveTrip();

      if (tripError) {
        setError(tripError.error);
        setActiveTrip(null);
        return;
      }

      setActiveTrip(data);
    } catch (err) {
      setError('Failed to load active trip');
      setActiveTrip(null);
      console.error('Error loading active trip:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const startTrip = useCallback(
    async (params: StartTripParams): Promise<{ success: boolean; trip: Trip | null }> => {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error: tripError } = await tripService.startTrip(params);

        if (tripError) {
          setError(tripError.error);
          return { success: false, trip: null };
        }

        if (data) {
          setActiveTrip(data);
          return { success: true, trip: data };
        }

        return { success: false, trip: null };
      } catch (err) {
        setError('Failed to start trip');
        console.error('Error starting trip:', err);
        return { success: false, trip: null };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const completeTrip = useCallback(async (): Promise<{ success: boolean }> => {
    if (!activeTrip) {
      console.warn('No active trip to complete');
      return { success: false };
    }

    try {
      setIsLoading(true);
      setError(null);

      const { error: tripError } = await tripService.completeTrip(activeTrip.id);

      if (tripError) {
        setError(tripError.error);
        return { success: false };
      }

      // Clear active trip state
      setActiveTrip(null);
      return { success: true };
    } catch (err) {
      setError('Failed to complete trip');
      console.error('Error completing trip:', err);
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  }, [activeTrip]);

  const cancelTrip = useCallback(async (): Promise<{ success: boolean }> => {
    if (!activeTrip) {
      return { success: false };
    }

    try {
      setIsLoading(true);
      setError(null);

      const { error: tripError } = await tripService.cancelTrip(activeTrip.id);

      if (tripError) {
        setError(tripError.error);
        return { success: false };
      }

      setActiveTrip(null);
      return { success: true };
    } catch (err) {
      setError('Failed to cancel trip');
      console.error('Error cancelling trip:', err);
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  }, [activeTrip]);

  const updateLocation = useCallback(
    async (latitude: number, longitude: number) => {
      if (!activeTrip) return;

      try {
        await tripService.updateTripLocation(activeTrip.id, latitude, longitude);
      } catch (err) {
        console.error('Error updating trip location:', err);
      }
    },
    [activeTrip]
  );

  return {
    activeTrip,
    isLoading,
    error,
    startTrip,
    completeTrip,
    cancelTrip,
    refreshActiveTrip,
    updateLocation,
  };
}
