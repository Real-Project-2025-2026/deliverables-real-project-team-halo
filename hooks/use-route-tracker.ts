import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as routeService from '@/services/route-service';
import type { RoutePoint } from '@/services/route-service';
import {
  shouldRecordRoutePoint,
  deduplicateRoutePoints,
  getLastRoutePoint,
  type RoutePointCandidate,
  type ShouldRecordRoutePointOptions,
} from '@/utils/route-helpers';

// NetInfo for network status detection (optional - gracefully handles if native module not available)
let NetInfo: any = null;
try {
  // @ts-ignore - NetInfo may not be available if native module not linked
  NetInfo = require('@react-native-community/netinfo');
} catch (e) {
  // NetInfo not available - will use fallback detection via Supabase connection status
  console.log('[Route Tracker] NetInfo not available, using connection-based offline detection');
}

const OFFLINE_QUEUE_KEY = (tripId: number) => `route_points_offline_queue_${tripId}`;
const LAST_SYNC_KEY = (tripId: number) => `route_points_last_sync_${tripId}`;

interface OfflineRoutePoint {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
  recorded_at: string;
}

interface UseRouteTrackerOptions {
  tripId: number | null;
  enabled: boolean;
  shouldRecordOptions?: ShouldRecordRoutePointOptions;
  refreshInterval?: number; // milliseconds - Default: 5000 (5 seconds)
  autoSync?: boolean; // Auto-sync offline queue when online - Default: true
}

interface UseRouteTrackerReturn {
  routePoints: RoutePoint[];
  isLoading: boolean;
  error: string | null;
  isOffline: boolean;
  pendingSyncCount: number;
  addRoutePoint: (candidate: RoutePointCandidate) => Promise<void>;
  refreshRoutePoints: () => Promise<void>;
  syncOfflineQueue: () => Promise<void>;
  clearRoutePoints: () => void;
}

/**
 * Hook for tracking route points with optimistic updates and offline queue
 * 
 * Features:
 * - Optimistic updates (route visible immediately)
 * - Offline queue (points saved locally when offline)
 * - Incremental loading (only new points loaded)
 * - Auto-sync when back online
 * - Smart recording (distance/time based filtering)
 */
export function useRouteTracker(
  options: UseRouteTrackerOptions
): UseRouteTrackerReturn {
  const {
    tripId,
    enabled,
    shouldRecordOptions,
    refreshInterval = 5000,
    autoSync = true,
  } = options;

  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  const lastSyncTimestampRef = useRef<string | null>(null);
  const optimisticPointsRef = useRef<Map<string, RoutePoint>>(new Map()); // temp_id -> RoutePoint
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoadRef = useRef(true);

  // Check network status
  useEffect(() => {
    if (!NetInfo) {
      // NetInfo not available - use connection-based detection
      // Assume online initially, will detect offline via Supabase errors
      setIsOffline(false);
      return;
    }

    let unsubscribe: (() => void) | null = null;
    
    try {
      unsubscribe = NetInfo.addEventListener((state: any) => {
        const wasOffline = isOffline;
        const nowOffline = !state.isConnected;

        setIsOffline(nowOffline);

        // Auto-sync when coming back online
        if (wasOffline && !nowOffline && autoSync && tripId) {
          syncOfflineQueue().catch((err) => {
            console.error('[Route Tracker] Error syncing offline queue:', err);
          });
        }
      });
    } catch (err) {
      console.warn('[Route Tracker] Error setting up NetInfo listener:', err);
      setIsOffline(false);
    }

    return () => {
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch (err) {
          // Ignore cleanup errors
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOffline, autoSync, tripId]);

  // Load initial route points
  useEffect(() => {
    if (!enabled || !tripId || !isInitialLoadRef.current) {
      return;
    }

    isInitialLoadRef.current = false;
    loadInitialRoutePoints();

    // Load offline queue count
    loadOfflineQueueCount();
  }, [enabled, tripId]);

  // Setup incremental refresh interval
  useEffect(() => {
    if (!enabled || !tripId || isLoading) {
      return;
    }

    refreshIntervalRef.current = setInterval(() => {
      refreshRoutePoints().catch((err) => {
        console.error('[Route Tracker] Error refreshing route points:', err);
      });
    }, refreshInterval);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [enabled, tripId, isLoading, refreshInterval]);

  const loadInitialRoutePoints = useCallback(async () => {
    if (!tripId) return;

    try {
      setIsLoading(true);
      setError(null);

      // Load from database
      const { data, error: loadError } = await routeService.getRoutePoints(tripId);

      if (loadError) {
        setError(loadError.error);
        return;
      }

      if (data && data.length > 0) {
        const deduplicated = deduplicateRoutePoints(data);
        setRoutePoints(deduplicated);

        // Set last sync timestamp to the last point's timestamp
        const lastPoint = getLastRoutePoint(deduplicated);
        if (lastPoint) {
          lastSyncTimestampRef.current = lastPoint.recorded_at;
          
          // Save to AsyncStorage
          try {
            await AsyncStorage.setItem(LAST_SYNC_KEY(tripId), lastPoint.recorded_at);
          } catch (err) {
            console.warn('[Route Tracker] Error saving last sync timestamp:', err);
          }
        }
      }

      // Load offline queue count
      await loadOfflineQueueCount();
    } catch (err) {
      setError('Failed to load route points');
      console.error('[Route Tracker] Error loading initial route points:', err);
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  const refreshRoutePoints = useCallback(async () => {
    if (!tripId || isLoading || isInitialLoadRef.current) {
      return;
    }

    try {
      // Load from AsyncStorage first
      const storedTimestamp = await AsyncStorage.getItem(LAST_SYNC_KEY(tripId));
      const sinceTimestamp = storedTimestamp || lastSyncTimestampRef.current;

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
        console.error('[Route Tracker] Error loading new route points:', loadError);
        return;
      }

      if (newPoints && newPoints.length > 0) {
        // Merge with existing points and deduplicate
        const merged = [...routePoints, ...newPoints];
        const deduplicated = deduplicateRoutePoints(merged);
        
        setRoutePoints(deduplicated);

        // Update last sync timestamp
        const lastPoint = getLastRoutePoint(newPoints);
        if (lastPoint) {
          lastSyncTimestampRef.current = lastPoint.recorded_at;
          
          try {
            await AsyncStorage.setItem(LAST_SYNC_KEY(tripId), lastPoint.recorded_at);
          } catch (err) {
            console.warn('[Route Tracker] Error saving last sync timestamp:', err);
          }
        }
      }
    } catch (err) {
      console.error('[Route Tracker] Error refreshing route points:', err);
    }
  }, [tripId, routePoints, isLoading, loadInitialRoutePoints]);

  const addRoutePoint = useCallback(
    async (candidate: RoutePointCandidate) => {
      if (!tripId) {
        console.warn('[Route Tracker] Cannot add route point: no trip ID');
        return;
      }

      // Get last route point (from confirmed or optimistic)
      const lastConfirmedPoint = getLastRoutePoint(routePoints);
      const allOptimisticPoints = Array.from(optimisticPointsRef.current.values());
      const lastOptimisticPoint = getLastRoutePoint(allOptimisticPoints);
      const lastPoint = lastOptimisticPoint || lastConfirmedPoint;

      // Check if we should record this point
      const { shouldRecord, reason } = shouldRecordRoutePoint(
        candidate,
        lastPoint,
        shouldRecordOptions
      );

      if (!shouldRecord) {
        console.log('[Route Tracker] Skipping route point:', reason);
        return;
      }

      // Create optimistic route point
      const tempId = `temp_${Date.now()}_${Math.random()}`;
      const optimisticPoint: RoutePoint = {
        id: tempId as any, // Temporary ID
        trip_id: tripId,
        user_id: '' as any, // Will be set by server
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        accuracy: candidate.accuracy ?? null,
        altitude: candidate.altitude ?? null,
        heading: candidate.heading ?? null,
        speed: candidate.speed ?? null,
        recorded_at: new Date(candidate.timestamp).toISOString(),
        created_at: new Date().toISOString(),
      };

      // Add to optimistic map
      optimisticPointsRef.current.set(tempId, optimisticPoint);

      // Immediately show in UI (optimistic update)
      setRoutePoints((prev) => {
        const merged = [...prev, optimisticPoint];
        return deduplicateRoutePoints(merged);
      });

      // Try to save to database (async, non-blocking)
      const routePointData: OfflineRoutePoint = {
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        accuracy: candidate.accuracy ?? null,
        altitude: candidate.altitude ?? null,
        heading: candidate.heading ?? null,
        speed: candidate.speed ?? null,
        recorded_at: optimisticPoint.recorded_at,
      };

      // Try to save directly (will fallback to offline queue on error)
      saveRoutePointAsync(tripId, routePointData, tempId).catch((err) => {
        console.warn('[Route Tracker] Error saving route point, adding to offline queue:', err);
        // On error, add to offline queue
        addToOfflineQueue(tripId, routePointData).catch((queueErr) => {
          console.error('[Route Tracker] Error adding to offline queue:', queueErr);
        });
        // Mark as offline if it's a network error
        if (err?.message?.includes('network') || err?.message?.includes('fetch')) {
          setIsOffline(true);
        }
      });
    },
    [tripId, routePoints, shouldRecordOptions, isOffline]
  );

  const saveRoutePointAsync = async (
    tripId: number,
    routePointData: OfflineRoutePoint,
    tempId: string
  ) => {
    const { data: savedPoint, error: saveError } = await routeService.recordRoutePoint(
      tripId,
      routePointData.latitude,
      routePointData.longitude,
      {
        accuracy: routePointData.accuracy ?? undefined,
        altitude: routePointData.altitude ?? undefined,
        heading: routePointData.heading ?? undefined,
        speed: routePointData.speed ?? undefined,
      }
    );

    if (saveError || !savedPoint) {
      throw new Error(saveError?.error || 'Failed to save route point');
    }

    // Remove from optimistic map
    optimisticPointsRef.current.delete(tempId);

    // Replace optimistic point with confirmed point
    setRoutePoints((prev) => {
      const withoutOptimistic = prev.filter((p) => p.id !== tempId);
      const merged = [...withoutOptimistic, savedPoint];
      return deduplicateRoutePoints(merged);
    });

    // Update last sync timestamp
    lastSyncTimestampRef.current = savedPoint.recorded_at;
    try {
      await AsyncStorage.setItem(LAST_SYNC_KEY(tripId), savedPoint.recorded_at);
    } catch (err) {
      console.warn('[Route Tracker] Error saving last sync timestamp:', err);
    }
  };

  const addToOfflineQueue = async (tripId: number, routePoint: OfflineRoutePoint) => {
    try {
      const queueKey = OFFLINE_QUEUE_KEY(tripId);
      const existingQueueJson = await AsyncStorage.getItem(queueKey);
      const existingQueue: OfflineRoutePoint[] = existingQueueJson
        ? JSON.parse(existingQueueJson)
        : [];

      // Add new point
      existingQueue.push(routePoint);

      // Limit queue size (max 1000 points)
      const maxQueueSize = 1000;
      if (existingQueue.length > maxQueueSize) {
        // Keep the most recent points
        existingQueue.splice(0, existingQueue.length - maxQueueSize);
      }

      await AsyncStorage.setItem(queueKey, JSON.stringify(existingQueue));
      await loadOfflineQueueCount();
    } catch (err) {
      console.error('[Route Tracker] Error adding to offline queue:', err);
      throw err;
    }
  };

  const syncOfflineQueue = useCallback(async () => {
    if (!tripId) {
      return;
    }

    // If NetInfo says we're offline, skip sync
    if (isOffline && NetInfo) {
      return;
    }

    try {
      const queueKey = OFFLINE_QUEUE_KEY(tripId);
      const queueJson = await AsyncStorage.getItem(queueKey);

      if (!queueJson) {
        setPendingSyncCount(0);
        return;
      }

      const queue: OfflineRoutePoint[] = JSON.parse(queueJson);

      if (queue.length === 0) {
        setPendingSyncCount(0);
        return;
      }

      // Batch insert all queued points
      const { data: savedPoints, error: syncError } = await routeService.batchInsertRoutePoints(
        tripId,
        queue
      );

      if (syncError) {
        throw new Error(syncError.error);
      }

      // Clear queue
      await AsyncStorage.removeItem(queueKey);
      setPendingSyncCount(0);

      // Reload route points to include synced points
      if (savedPoints && savedPoints.length > 0) {
        await refreshRoutePoints();
      }
    } catch (err) {
      console.error('[Route Tracker] Error syncing offline queue:', err);
      throw err;
    }
  }, [tripId, isOffline, refreshRoutePoints]);

  const loadOfflineQueueCount = useCallback(async () => {
    if (!tripId) return;

    try {
      const queueKey = OFFLINE_QUEUE_KEY(tripId);
      const queueJson = await AsyncStorage.getItem(queueKey);
      const queue: OfflineRoutePoint[] = queueJson ? JSON.parse(queueJson) : [];
      setPendingSyncCount(queue.length);
    } catch (err) {
      console.error('[Route Tracker] Error loading offline queue count:', err);
    }
  }, [tripId]);

  const clearRoutePoints = useCallback(() => {
    setRoutePoints([]);
    optimisticPointsRef.current.clear();
    lastSyncTimestampRef.current = null;
    isInitialLoadRef.current = true;
  }, []);

  return {
    routePoints,
    isLoading,
    error,
    isOffline,
    pendingSyncCount,
    addRoutePoint,
    refreshRoutePoints,
    syncOfflineQueue,
    clearRoutePoints,
  };
}

