import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import {
  getTripGuardianRequests,
  acceptTripGuardianRequest,
  declineTripGuardianRequest,
  subscribeToTripGuardianRequests,
  unsubscribeFromChannel,
  type TripGuardianWithDetails,
} from '@/services/trip-guardian-service';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseTripGuardianRequestsReturn {
  /** Pending trip guardian requests */
  requests: TripGuardianWithDetails[];
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Accept a trip guardian request */
  acceptRequest: (requestId: number) => Promise<boolean>;
  /** Decline a trip guardian request */
  declineRequest: (requestId: number) => Promise<boolean>;
  /** Refresh the requests list */
  refresh: () => Promise<void>;
}

/**
 * Hook for managing incoming trip guardian requests
 * Used by guardians to see trips where someone wants them to watch over
 */
export function useTripGuardianRequests(): UseTripGuardianRequestsReturn {
  const { user } = useAuth();
  const [requests, setRequests] = useState<TripGuardianWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  // Fetch requests
  const fetchRequests = useCallback(async () => {
    if (!user) {
      setRequests([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const { data, error: fetchError } = await getTripGuardianRequests();

      if (fetchError) {
        setError(fetchError.error);
        setRequests([]);
      } else {
        setRequests(data || []);
      }
    } catch (err) {
      setError('Failed to fetch requests');
      setRequests([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Initial fetch
  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user) return;

    const realtimeChannel = subscribeToTripGuardianRequests(user.id, (payload) => {
      console.log('[useTripGuardianRequests] Realtime update:', payload);
      // Refresh on any change
      fetchRequests();
    });

    setChannel(realtimeChannel);

    return () => {
      if (realtimeChannel) {
        unsubscribeFromChannel(realtimeChannel);
      }
    };
  }, [user, fetchRequests]);

  // Accept request
  const acceptRequest = useCallback(async (requestId: number): Promise<boolean> => {
    const { error: acceptError } = await acceptTripGuardianRequest(requestId);

    if (acceptError) {
      setError(acceptError.error);
      return false;
    }

    // Remove from local state immediately
    setRequests((prev) => prev.filter((r) => r.id !== requestId));
    return true;
  }, []);

  // Decline request
  const declineRequest = useCallback(async (requestId: number): Promise<boolean> => {
    const { error: declineError } = await declineTripGuardianRequest(requestId);

    if (declineError) {
      setError(declineError.error);
      return false;
    }

    // Remove from local state immediately
    setRequests((prev) => prev.filter((r) => r.id !== requestId));
    return true;
  }, []);

  // Refresh
  const refresh = useCallback(async () => {
    await fetchRequests();
  }, [fetchRequests]);

  return {
    requests,
    isLoading,
    error,
    acceptRequest,
    declineRequest,
    refresh,
  };
}

