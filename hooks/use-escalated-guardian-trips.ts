import { useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import type { TripGuardianWithDetails, TripGuardianServiceError } from '@/services/trip-guardian-service';
import { getEscalatedGuardianTrips } from '@/services/trip-guardian-service';

export function useEscalatedGuardianTrips() {
  const [escalatedTrips, setEscalatedTrips] = useState<TripGuardianWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<TripGuardianServiceError | null>(null);

  const fetchEscalatedTrips = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const { data, error: fetchError } = await getEscalatedGuardianTrips();

    if (fetchError) {
      setError(fetchError);
      setEscalatedTrips([]);
    } else {
      setEscalatedTrips(data || []);
    }

    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchEscalatedTrips();
    }, [fetchEscalatedTrips])
  );

  return {
    escalatedTrips,
    isLoading,
    error,
    refresh: fetchEscalatedTrips,
  };
}

