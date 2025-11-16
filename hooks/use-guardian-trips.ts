import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/providers/auth-provider';
import * as tripService from '@/services/trip-service';
import type { Trip } from '@/services/trip-service';

export interface GuardianTrip extends Trip {
  user_profile: {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface UseGuardianTripsReturn {
  guardianTrips: GuardianTrip[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getTripDetails: (tripId: number) => Promise<GuardianTrip | null>;
}

/**
 * Hook for managing Guardian trips (trips where current user is a Guardian)
 */
export function useGuardianTrips(): UseGuardianTripsReturn {
  const { user } = useAuth();
  const [guardianTrips, setGuardianTrips] = useState<GuardianTrip[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setGuardianTrips([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const { data, error: serviceError } = await tripService.getGuardianTrips();

      if (serviceError) {
        setError(serviceError.error);
        setGuardianTrips([]);
        return;
      }

      setGuardianTrips(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load guardian trips');
      setGuardianTrips([]);
      console.error('Error loading guardian trips:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
    
    // Refresh every 5 seconds to get updates
    const interval = setInterval(refresh, 5000);
    
    return () => clearInterval(interval);
  }, [user, refresh]);

  const getTripDetails = useCallback(
    async (tripId: number): Promise<GuardianTrip | null> => {
      try {
        const { data, error: serviceError } = await tripService.getGuardianTripDetails(tripId);

        if (serviceError) {
          console.error('Error getting guardian trip details:', serviceError);
          return null;
        }

        return data || null;
      } catch (err: any) {
        console.error('Error getting guardian trip details:', err);
        return null;
      }
    },
    []
  );

  return {
    guardianTrips,
    isLoading,
    error,
    refresh,
    getTripDetails,
  };
}

