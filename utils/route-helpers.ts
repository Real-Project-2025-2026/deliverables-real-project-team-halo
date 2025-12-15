import type { RoutePoint } from '@/services/route-service';

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in meters
 */
export function calculateDistance(
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
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Check if a route point should be recorded based on distance and time thresholds
 * This prevents recording too many points when stationary or moving slowly
 */
export interface ShouldRecordRoutePointOptions {
  minDistanceMeters?: number; // Default: 10 meters
  minTimeSeconds?: number; // Default: 30 seconds
  maxAccuracyMeters?: number; // Default: 50 meters - don't record if accuracy is worse
}

export interface RoutePointCandidate {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  timestamp: number; // Unix timestamp in milliseconds
}

export function shouldRecordRoutePoint(
  candidate: RoutePointCandidate,
  lastRecordedPoint: RoutePoint | null,
  options: ShouldRecordRoutePointOptions = {}
): {
  shouldRecord: boolean;
  reason?: string;
} {
  const {
    minDistanceMeters = 10,
    minTimeSeconds = 30,
    maxAccuracyMeters = 50,
  } = options;

  // If this is the first point, always record it
  if (!lastRecordedPoint) {
    return { shouldRecord: true, reason: 'first_point' };
  }

  // Check accuracy - don't record if accuracy is too poor
  if (candidate.accuracy !== null && candidate.accuracy !== undefined) {
    if (candidate.accuracy > maxAccuracyMeters) {
      return {
        shouldRecord: false,
        reason: `accuracy_too_poor_${candidate.accuracy.toFixed(1)}m`,
      };
    }
  }

  // Calculate distance from last point
  const distance = calculateDistance(
    candidate.latitude,
    candidate.longitude,
    lastRecordedPoint.latitude,
    lastRecordedPoint.longitude
  );

  // Calculate time since last point
  const lastRecordedTime = new Date(lastRecordedPoint.recorded_at).getTime();
  const timeSinceLastPoint = (candidate.timestamp - lastRecordedTime) / 1000; // in seconds

  // Record if moved far enough
  if (distance >= minDistanceMeters) {
    return {
      shouldRecord: true,
      reason: `distance_${distance.toFixed(1)}m`,
    };
  }

  // Record if enough time has passed (even if stationary)
  if (timeSinceLastPoint >= minTimeSeconds) {
    return {
      shouldRecord: true,
      reason: `time_${timeSinceLastPoint.toFixed(1)}s`,
    };
  }

  // Don't record - too close and too soon
  return {
    shouldRecord: false,
    reason: `too_close_${distance.toFixed(1)}m_too_soon_${timeSinceLastPoint.toFixed(1)}s`,
  };
}

/**
 * Deduplicate route points - remove points that are too close together
 * This is useful after loading from database to clean up any duplicates
 */
export function deduplicateRoutePoints(
  routePoints: RoutePoint[],
  minDistanceMeters: number = 5
): RoutePoint[] {
  if (routePoints.length <= 1) {
    return routePoints;
  }

  const deduplicated: RoutePoint[] = [routePoints[0]]; // Always keep first point

  for (let i = 1; i < routePoints.length; i++) {
    const currentPoint = routePoints[i];
    const lastDeduplicatedPoint = deduplicated[deduplicated.length - 1];

    const distance = calculateDistance(
      currentPoint.latitude,
      currentPoint.longitude,
      lastDeduplicatedPoint.latitude,
      lastDeduplicatedPoint.longitude
    );

    // Keep point if it's far enough from the last one
    if (distance >= minDistanceMeters) {
      deduplicated.push(currentPoint);
    }
  }

  return deduplicated;
}

/**
 * Check if two route points are duplicates (very close together and similar timestamp)
 */
export function areRoutePointsDuplicates(
  point1: RoutePoint,
  point2: RoutePoint,
  maxDistanceMeters: number = 5,
  maxTimeSeconds: number = 5
): boolean {
  const distance = calculateDistance(
    point1.latitude,
    point1.longitude,
    point2.latitude,
    point2.longitude
  );

  const timeDiff =
    Math.abs(
      new Date(point1.recorded_at).getTime() -
        new Date(point2.recorded_at).getTime()
    ) / 1000;

  return distance < maxDistanceMeters && timeDiff < maxTimeSeconds;
}

/**
 * Merge two arrays of route points and deduplicate
 * Useful when merging optimistic points with confirmed points from database
 */
export function mergeRoutePoints(
  points1: RoutePoint[],
  points2: RoutePoint[],
  deduplicate: boolean = true
): RoutePoint[] {
  // Combine and sort by recorded_at
  const merged = [...points1, ...points2].sort(
    (a, b) =>
      new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  if (deduplicate) {
    return deduplicateRoutePoints(merged);
  }

  return merged;
}

/**
 * Get the last route point from an array
 */
export function getLastRoutePoint(
  routePoints: RoutePoint[]
): RoutePoint | null {
  if (routePoints.length === 0) {
    return null;
  }

  // Sort by recorded_at to ensure we get the actual last one
  const sorted = [...routePoints].sort(
    (a, b) =>
      new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
  );

  return sorted[0];
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

/**
 * Calculate total distance from route points array
 */
export function calculateTotalDistance(routePoints: RoutePoint[]): number {
  if (routePoints.length < 2) {
    return 0;
  }

  let totalDistance = 0;
  for (let i = 1; i < routePoints.length; i++) {
    const prev = routePoints[i - 1];
    const curr = routePoints[i];
    totalDistance += calculateDistance(
      prev.latitude,
      prev.longitude,
      curr.latitude,
      curr.longitude
    );
  }

  return totalDistance;
}






