import { supabase } from '@/lib/supabase';
import type { Tables, TablesInsert } from '@/types/supabase';

export type RoutePoint = Tables<'route_points'>;
export type RoutePointInsert = TablesInsert<'route_points'>;

export interface RouteServiceError {
  error: string;
  details?: unknown;
}

/**
 * Record a route point during a trip
 */
export async function recordRoutePoint(
  tripId: number,
  latitude: number,
  longitude: number,
  metadata?: {
    accuracy?: number;
    altitude?: number;
    heading?: number;
    speed?: number;
  }
): Promise<{ data: RoutePoint | null; error: RouteServiceError | null }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return { data: null, error: { error: 'Not authenticated' } };
    }

    const routePointData: RoutePointInsert = {
      trip_id: tripId,
      user_id: session.user.id,
      latitude,
      longitude,
      accuracy: metadata?.accuracy ?? null,
      altitude: metadata?.altitude ?? null,
      heading: metadata?.heading ?? null,
      speed: metadata?.speed ?? null,
      recorded_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('route_points')
      .insert(routePointData)
      .select()
      .single();

    if (error) {
      return { data: null, error: { error: error.message, details: error } };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: { error: 'Failed to record route point', details: err },
    };
  }
}

/**
 * Get all route points for a trip (ordered by recorded_at)
 * Works for trip owner - filters by user_id for own trips
 * Note: For Guardian access, use getRoutePointsForTrip() instead
 */
export async function getRoutePoints(
  tripId: number
): Promise<{ data: RoutePoint[] | null; error: RouteServiceError | null }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return { data: null, error: { error: 'Not authenticated' } };
    }

    // For trip owner: filter by user_id
    // RLS policies will also ensure user can only see their own route points
    const { data, error } = await supabase
      .from('route_points')
      .select('*')
      .eq('trip_id', tripId)
      .eq('user_id', session.user.id)
      .order('recorded_at', { ascending: true });

    if (error) {
      return { data: null, error: { error: error.message, details: error } };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: { error: 'Failed to get route points', details: err },
    };
  }
}

/**
 * Get route points for a trip since a specific timestamp (incremental loading)
 * Useful for loading only new route points after initial load
 * Works for both trip owners and Guardians (via RLS policies)
 */
export async function getRoutePointsSince(
  tripId: number,
  sinceTimestamp: string | Date
): Promise<{ data: RoutePoint[] | null; error: RouteServiceError | null }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return { data: null, error: { error: 'Not authenticated' } };
    }

    const since = typeof sinceTimestamp === 'string' 
      ? sinceTimestamp 
      : sinceTimestamp.toISOString();

    // RLS policies will handle authorization:
    // - Trip owner can see their own route points
    // - Guardians can see route points for trips they are monitoring
    const { data, error } = await supabase
      .from('route_points')
      .select('*')
      .eq('trip_id', tripId)
      .gt('recorded_at', since)
      .order('recorded_at', { ascending: true });

    if (error) {
      return { data: null, error: { error: error.message, details: error } };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: { error: 'Failed to get route points', details: err },
    };
  }
}

/**
 * Get route points for a trip (for Guardians or trip owner)
 * RLS policies handle authorization automatically
 */
export async function getRoutePointsForTrip(
  tripId: number
): Promise<{ data: RoutePoint[] | null; error: RouteServiceError | null }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return { data: null, error: { error: 'Not authenticated' } };
    }

    // RLS policies will handle authorization:
    // - Trip owner can see their own route points
    // - Guardians can see route points for trips they are monitoring
    const { data, error } = await supabase
      .from('route_points')
      .select('*')
      .eq('trip_id', tripId)
      .order('recorded_at', { ascending: true });

    if (error) {
      return { data: null, error: { error: error.message, details: error } };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: { error: 'Failed to get route points', details: err },
    };
  }
}

/**
 * Batch insert route points (for offline queue sync)
 * More efficient than inserting one by one
 */
export async function batchInsertRoutePoints(
  tripId: number,
  routePoints: Array<{
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    altitude?: number | null;
    heading?: number | null;
    speed?: number | null;
    recorded_at: string;
  }>
): Promise<{ data: RoutePoint[] | null; error: RouteServiceError | null }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return { data: null, error: { error: 'Not authenticated' } };
    }

    if (routePoints.length === 0) {
      return { data: [], error: null };
    }

    // Prepare route point data
    const routePointsData: RoutePointInsert[] = routePoints.map((point) => ({
      trip_id: tripId,
      user_id: session.user.id,
      latitude: point.latitude,
      longitude: point.longitude,
      accuracy: point.accuracy ?? null,
      altitude: point.altitude ?? null,
      heading: point.heading ?? null,
      speed: point.speed ?? null,
      recorded_at: point.recorded_at,
    }));

    // Insert in batches of 100 to avoid payload size issues
    const batchSize = 100;
    const allInserted: RoutePoint[] = [];

    for (let i = 0; i < routePointsData.length; i += batchSize) {
      const batch = routePointsData.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('route_points')
        .insert(batch)
        .select();

      if (error) {
        return { 
          data: null, 
          error: { 
            error: `Failed to insert batch at index ${i}: ${error.message}`, 
            details: error 
          } 
        };
      }

      if (data) {
        allInserted.push(...data);
      }
    }

    return { data: allInserted, error: null };
  } catch (err) {
    return {
      data: null,
      error: { error: 'Failed to batch insert route points', details: err },
    };
  }
}

/**
 * Delete all route points for a trip (cleanup)
 */
export async function deleteRoutePoints(
  tripId: number
): Promise<{ error: RouteServiceError | null }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return { error: { error: 'Not authenticated' } };
    }

    const { error } = await supabase
      .from('route_points')
      .delete()
      .eq('trip_id', tripId)
      .eq('user_id', session.user.id);

    if (error) {
      return { error: { error: error.message, details: error } };
    }

    return { error: null };
  } catch (err) {
    return {
      error: { error: 'Failed to delete route points', details: err },
    };
  }
}

/**
 * Calculate total distance from route points (in meters)
 * Uses Haversine formula for distance calculation
 */
export function calculateRouteDistance(routePoints: RoutePoint[]): number {
  if (routePoints.length < 2) {
    return 0;
  }

  let totalDistance = 0;

  for (let i = 1; i < routePoints.length; i++) {
    const prev = routePoints[i - 1];
    const curr = routePoints[i];

    const distance = haversineDistance(
      prev.latitude,
      prev.longitude,
      curr.latitude,
      curr.longitude
    );

    totalDistance += distance;
  }

  return totalDistance;
}

/**
 * Haversine formula for calculating distance between two points on Earth
 * Returns distance in meters
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate total duration from route points (in seconds)
 */
export function calculateRouteDuration(routePoints: RoutePoint[]): number {
  if (routePoints.length < 2) {
    return 0;
  }

  const first = routePoints[0];
  const last = routePoints[routePoints.length - 1];

  const startTime = new Date(first.recorded_at).getTime();
  const endTime = new Date(last.recorded_at).getTime();

  return Math.floor((endTime - startTime) / 1000);
}

