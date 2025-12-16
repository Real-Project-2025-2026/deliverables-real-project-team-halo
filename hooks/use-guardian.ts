import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/providers/auth-provider';
import * as guardianService from '@/services/guardian-service';
import type {
  GuardianWithProfile,
  PublicUserProfile,
} from '@/services/guardian-service';

interface UseGuardianReturn {
  guardians: GuardianWithProfile[];
  pendingRequests: GuardianWithProfile[];
  sentRequests: GuardianWithProfile[];
  isLoading: boolean;
  error: string | null;
  searchUsers: (query: string) => Promise<PublicUserProfile[]>;
  sendRequest: (recipientId: string) => Promise<boolean>;
  acceptRequest: (requestId: number) => Promise<boolean>;
  declineRequest: (requestId: number) => Promise<boolean>;
  removeGuardian: (guardianId: number) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useGuardian(): UseGuardianReturn {
  const { user } = useAuth();
  const [guardians, setGuardians] = useState<GuardianWithProfile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<GuardianWithProfile[]>([]);
  const [sentRequests, setSentRequests] = useState<GuardianWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      setError(null);

      const [guardiansResult, pendingResult, sentResult] = await Promise.all([
        guardianService.getMyGuardians(),
        guardianService.getPendingRequests(),
        guardianService.getSentRequests(),
      ]);

      if (guardiansResult.error) {
        setError(guardiansResult.error.error);
      } else {
        setGuardians(guardiansResult.data || []);
      }

      if (pendingResult.error) {
        setError(pendingResult.error.error);
      } else {
        setPendingRequests(pendingResult.data || []);
      }

      if (sentResult.error) {
        setError(sentResult.error.error);
      } else {
        setSentRequests(sentResult.data || []);
      }
    } catch (err) {
      setError('Failed to load Guardian data');
      console.error('Error loading Guardian data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const searchUsers = useCallback(
    async (query: string): Promise<PublicUserProfile[]> => {
      try {
        setError(null);
        const result = await guardianService.searchUsers(query);
        if (result.error) {
          setError(result.error.error);
          return [];
        }
        return result.data || [];
      } catch (err) {
        setError('Failed to search users');
        console.error('Error searching users:', err);
        return [];
      }
    },
    []
  );

  const sendRequest = useCallback(
    async (recipientId: string): Promise<boolean> => {
      try {
        setError(null);
        const result = await guardianService.sendGuardianRequest(recipientId);
        if (result.error) {
          setError(result.error.error);
          return false;
        }
        // Refresh data after sending request
        await refresh();
        return true;
      } catch (err) {
        setError('Failed to send Guardian request');
        console.error('Error sending Guardian request:', err);
        return false;
      }
    },
    [refresh]
  );

  const acceptRequest = useCallback(
    async (requestId: number): Promise<boolean> => {
      try {
        setError(null);
        const result = await guardianService.acceptGuardianRequest(requestId);
        if (result.error) {
          setError(result.error.error);
          return false;
        }
        // Refresh data after accepting request
        await refresh();
        return true;
      } catch (err) {
        setError('Failed to accept Guardian request');
        console.error('Error accepting Guardian request:', err);
        return false;
      }
    },
    [refresh]
  );

  const declineRequest = useCallback(
    async (requestId: number): Promise<boolean> => {
      try {
        setError(null);
        const result = await guardianService.declineGuardianRequest(requestId);
        if (result.error) {
          setError(result.error.error);
          return false;
        }
        // Refresh data after declining request
        await refresh();
        return true;
      } catch (err) {
        setError('Failed to decline Guardian request');
        console.error('Error declining Guardian request:', err);
        return false;
      }
    },
    [refresh]
  );

  const removeGuardian = useCallback(
    async (guardianId: number): Promise<boolean> => {
      try {
        setError(null);
        const result = await guardianService.removeGuardian(guardianId);
        if (result.error) {
          setError(result.error.error);
          return false;
        }
        // Refresh data after removing Guardian
        await refresh();
        return true;
      } catch (err) {
        setError('Failed to remove Guardian');
        console.error('Error removing Guardian:', err);
        return false;
      }
    },
    [refresh]
  );

  return {
    guardians,
    pendingRequests,
    sentRequests,
    isLoading,
    error,
    searchUsers,
    sendRequest,
    acceptRequest,
    declineRequest,
    removeGuardian,
    refresh,
  };
}

