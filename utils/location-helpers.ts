/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * Calculate approximate location by rounding coordinates
 * Used for privacy - shares approximate location instead of exact
 */
export function getApproximateLocation(
  latitude: number,
  longitude: number,
  precision: number = 3
): { latitude: number; longitude: number } {
  return {
    latitude: parseFloat(latitude.toFixed(precision)),
    longitude: parseFloat(longitude.toFixed(precision)),
  };
}

/**
 * Check if a location is within a certain radius of another location
 */
export function isWithinRadius(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  radiusMeters: number
): boolean {
  const distance = calculateDistance(lat1, lon1, lat2, lon2);
  return distance <= radiusMeters;
}

/**
 * Format coordinates for display
 */
export function formatCoordinates(latitude: number, longitude: number): string {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

/**
 * Get location accuracy description
 */
export function getAccuracyDescription(accuracy: number | null | undefined): string {
  if (!accuracy) return 'Unknown';
  if (accuracy < 20) return 'Excellent';
  if (accuracy < 50) return 'Good';
  if (accuracy < 100) return 'Fair';
  return 'Poor';
}

/**
 * Calculate estimated time to destination based on average walking speed
 * Returns time in minutes
 */
export function estimateWalkingTime(distanceMeters: number): number {
  const averageWalkingSpeedMps = 1.4; // meters per second (~5 km/h)
  const timeSeconds = distanceMeters / averageWalkingSpeedMps;
  return Math.ceil(timeSeconds / 60);
}

/**
 * Format time duration
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

