import { useCallback, useEffect, useState } from 'react';
import {
  getTripGuardians,
  subscribeToTripGuardians,
  unsubscribeFromChannel,
  type TripGuardianWithDetails,
} from '@/services/trip-guardian-service';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseTripGuardiansReturn {
  /** Guardians for this trip with their status */
  guardians: TripGuardianWithDetails[];
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Refresh the guardians list */
  refresh: () => Promise<void>;
  /** Count of accepted guardians */
  acceptedCount: number;
  /** Count of pending (requested) guardians */
  pendingCount: number;
  /** Count of declined guardians */
  declinedCount: number;
}

/**
 * Hook for trip owner to see guardian statuses
 * Used in the active trip screen to show who's watching
 */
export function useTripGuardians(tripId: number | null): UseTripGuardiansReturn {
  const [guardians, setGuardians] = useState<TripGuardianWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  // Fetch guardians
  const fetchGuardians = useCallback(async () => {
    if (!tripId) {
      setGuardians([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const { data, error: fetchError } = await getTripGuardians(tripId);

      if (fetchError) {
        setError(fetchError.error);
        setGuardians([]);
      } else {
        setGuardians(data || []);
      }
    } catch (err) {
      setError('Failed to fetch guardians');
      setGuardians([]);
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  // Initial fetch
  useEffect(() => {
    fetchGuardians();
  }, [fetchGuardians]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!tripId) return;

    const realtimeChannel = subscribeToTripGuardians(tripId, (payload) => {
      console.log('[useTripGuardians] Realtime update:', payload);
      
      // Handle update events
      if (payload.eventType === 'UPDATE' && payload.new) {
        setGuardians((prev) =>
          prev.map((g) =>
            g.id === payload.new.id
              ? { ...g, ...payload.new }
              : g
          )
        );
      } else {
        // For other events, just refresh
        fetchGuardians();
      }
    });

    setChannel(realtimeChannel);

    return () => {
      if (realtimeChannel) {
        unsubscribeFromChannel(realtimeChannel);
      }
    };
  }, [tripId, fetchGuardians]);

  // Refresh
  const refresh = useCallback(async () => {
    await fetchGuardians();
  }, [fetchGuardians]);

  // Computed counts
  const acceptedCount = guardians.filter((g) => g.status === 'accepted').length;
  const pendingCount = guardians.filter((g) => g.status === 'requested').length;
  const declinedCount = guardians.filter((g) => g.status === 'declined').length;

  return {
    guardians,
    isLoading,
    error,
    refresh,
    acceptedCount,
    pendingCount,
    declinedCount,
  };
}

