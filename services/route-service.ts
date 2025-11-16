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

