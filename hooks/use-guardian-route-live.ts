import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { RoutePoint } from '@/services/route-service';
import { deduplicateRoutePoints, getLastRoutePoint } from '@/utils/route-helpers';
import * as routeService from '@/services/route-service';

interface UseGuardianRouteLiveOptions {
  tripId: number | null;
  enabled: boolean;
  fallbackPollingInterval?: number; // milliseconds - Default: 5000 (5 seconds)
}

interface UseGuardianRouteLiveReturn {
  routePoints: RoutePoint[];
  isLoading: boolean;
  error: string | null;
  isRealtimeConnected: boolean;
  refreshRoutePoints: () => Promise<void>;
}

/**
 * Hook for live route tracking for Guardians watching a trip
 * 
 * Features:
 * - Supabase Realtime subscription for route_points
 * - Fallback to polling if Realtime unavailable
 * - Incremental loading of new route points
 * - Automatic deduplication
 */
export function useGuardianRouteLive(
  options: UseGuardianRouteLiveOptions
): UseGuardianRouteLiveReturn {
  const { tripId, enabled, fallbackPollingInterval = 5000 } = options;

  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSyncTimestampRef = useRef<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoadRef = useRef(true);

  // Load initial route points
  const loadInitialRoutePoints = useCallback(async () => {
    if (!tripId) return;

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: loadError } = await routeService.getRoutePointsForTrip(tripId);

      if (loadError) {
        setError(loadError.error);
        setIsRealtimeConnected(false);
        return;
      }

      if (data && data.length > 0) {
        const deduplicated = deduplicateRoutePoints(data);
        setRoutePoints(deduplicated);

        // Set last sync timestamp
        const lastPoint = getLastRoutePoint(deduplicated);
        if (lastPoint) {
          lastSyncTimestampRef.current = lastPoint.recorded_at;
        }
      } else {
        setRoutePoints([]);
      }
    } catch (err) {
      setError('Failed to load route points');
      console.error('[Guardian Route Live] Error loading initial route points:', err);
    } finally {
      setIsLoading(false);
      isInitialLoadRef.current = false;
    }
  }, [tripId]);

  // Refresh route points incrementally
  const refreshRoutePoints = useCallback(async () => {
    if (!tripId || isLoading || isInitialLoadRef.current) {
      return;
    }

    try {
      const sinceTimestamp = lastSyncTimestampRef.current;

      // If no timestamp, do full load
      if (!sinceTimestamp) {
        await loadInitialRoutePoints();
        return;
      }

      // Incremental load - only new points
      const { data: newPoints, error: loadError } = await routeService.getRoutePointsSince(
        tripId,
        sinceTimestamp
      );

      if (loadError) {
        console.error('[Guardian Route Live] Error loading new route points:', loadError);
        return;
      }

      if (newPoints && newPoints.length > 0) {
        // Merge with existing points and deduplicate
        setRoutePoints((prev) => {
          const merged = [...prev, ...newPoints];
          const deduplicated = deduplicateRoutePoints(merged);

          // Update last sync timestamp
          const lastPoint = getLastRoutePoint(newPoints);
          if (lastPoint) {
            lastSyncTimestampRef.current = lastPoint.recorded_at;
          }

          return deduplicated;
        });
      }
    } catch (err) {
      console.error('[Guardian Route Live] Error refreshing route points:', err);
    }
  }, [tripId, isLoading, loadInitialRoutePoints]);

  // Setup Realtime subscription
  useEffect(() => {
    if (!enabled || !tripId) {
      // Cleanup
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsRealtimeConnected(false);
      return;
    }

    // Load initial route points first
    if (isInitialLoadRef.current) {
      loadInitialRoutePoints();
    }

    // Setup Realtime subscription for route_points
    // Channel name format: route_points:trip:{tripId} for private channel authorization
    const channelName = `route_points:trip:${tripId}`;
    const channel = supabase.channel(channelName, {
      config: {
        private: true, // Requires RLS authorization via route_points table policies
      },
    });

    channelRef.current = channel;

    // Subscribe to route_points INSERT events for this trip
    // This will receive new route points in real-time as they are added
    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'route_points',
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => {
          console.log('[Guardian Route Live] New route point received:', payload);
          
          const newPoint = payload.new as RoutePoint;
          
          // Add new point to route (optimistic update)
          setRoutePoints((prev) => {
            // Check if point already exists (deduplication)
            const exists = prev.some((p) => p.id === newPoint.id);
            if (exists) {
              return prev;
            }

            // Add new point and deduplicate
            const merged = [...prev, newPoint];
            const deduplicated = deduplicateRoutePoints(merged);
            
            // Sort by recorded_at to ensure correct order
            return deduplicated.sort(
              (a, b) =>
                new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
            );
          });

          // Update last sync timestamp
          lastSyncTimestampRef.current = newPoint.recorded_at;
        }
      )
      .subscribe((status, err) => {
        console.log('[Guardian Route Live] Channel status:', status, err);
        
        if (status === 'SUBSCRIBED') {
          setIsRealtimeConnected(true);
          
          // Stop polling if Realtime is working
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setIsRealtimeConnected(false);
          
          // Fallback to polling if Realtime fails
          if (!pollingIntervalRef.current) {
            console.log('[Guardian Route Live] Realtime unavailable, falling back to polling');
            pollingIntervalRef.current = setInterval(() => {
              refreshRoutePoints().catch((error) => {
                console.error('[Guardian Route Live] Error in polling fallback:', error);
              });
            }, fallbackPollingInterval);
          }
        } else if (status === 'CLOSED') {
          setIsRealtimeConnected(false);
          
          // Start polling when Realtime closes
          if (!pollingIntervalRef.current) {
            pollingIntervalRef.current = setInterval(() => {
              refreshRoutePoints().catch((error) => {
                console.error('[Guardian Route Live] Error in polling fallback:', error);
              });
            }, fallbackPollingInterval);
          }
        }
      });

    return () => {
      // Cleanup
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      
      setIsRealtimeConnected(false);
    };
  }, [enabled, tripId, loadInitialRoutePoints, refreshRoutePoints, fallbackPollingInterval]);

  return {
    routePoints,
    isLoading,
    error,
    isRealtimeConnected,
    refreshRoutePoints,
  };
}

