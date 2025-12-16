import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from '@/lib/supabase';

const BACKGROUND_LOCATION_TASK = 'background-location-task';

export interface BackgroundLocationData {
  locations: Location.LocationObject[];
}

// Define the background task
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    // Handle different error types
    const errorCode = error?.code ?? -1;
    const errorMessage = error?.message || 'Unknown error';
    
    // kCLErrorDomain Code=0 is "Location Unknown" - often a temporary error
    // This can happen when location services are initializing or temporarily unavailable
    // We should log it but not treat it as critical - continue if we have data
    if (errorCode === 0) {
      console.warn('Background location temporarily unavailable (Code 0):', errorMessage);
      // Don't return early - try to continue with any available data
    } else if (errorCode > 0) {
      // Other errors (permission denied, etc.) are more critical
      console.error('Background location error (Code', errorCode, '):', errorMessage);
      
      // For critical errors, we should stop trying
      if (errorCode === 1) { // kCLErrorDenied
        console.error('Location permission denied - background tracking may not work');
        return;
      }
      
      // If error is critical and no data available, return early
      if (!data) {
        return;
      }
    } else {
      // Unknown error format - log and continue if data available
      console.warn('Background location error (unknown format):', error);
    }
  }

  if (data) {
    const { locations } = data as BackgroundLocationData;
    
    if (locations && locations.length > 0) {
      const location = locations[0];
      
      try {
        // Get current user's active trip
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) return;

        // Find active trip
        const { data: activeTrips } = await supabase
          .from('trips')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1);

        if (activeTrips && activeTrips.length > 0) {
          const tripId = activeTrips[0].id;

          // Update trip with last known location
          await supabase
            .from('trips')
            .update({
              last_known_latitude: location.coords.latitude,
              last_known_longitude: location.coords.longitude,
              last_location_update_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', tripId);

          // Record route point (non-blocking)
          try {
            const { recordRoutePoint } = await import('@/services/route-service');
            await recordRoutePoint(tripId, location.coords.latitude, location.coords.longitude, {
              accuracy: location.coords.accuracy ?? undefined,
              altitude: location.coords.altitude ?? undefined,
              heading: location.coords.heading !== null && location.coords.heading !== undefined 
                ? location.coords.heading 
                : undefined,
              speed: location.coords.speed !== null && location.coords.speed !== undefined
                ? location.coords.speed
                : undefined,
            }).catch((err) => {
              console.warn('Error recording route point in background (non-blocking):', err);
            });
          } catch (err) {
            console.warn('Error importing route-service (non-blocking):', err);
          }

          // Update nearby presence if SafeTogether is enabled
          const { data: trip } = await supabase
            .from('trips')
            .select('safetogether_enabled')
            .eq('id', tripId)
            .single();

          if (trip?.safetogether_enabled) {
            // Upsert nearby presence
            await supabase
              .from('nearby_presences')
              .upsert({
                user_id: session.user.id,
                trip_id: tripId,
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                location: `POINT(${location.coords.longitude} ${location.coords.latitude})`,
                last_seen_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes from now
                updated_at: new Date().toISOString(),
              });
          }

          console.log('Background location updated:', {
            lat: location.coords.latitude,
            lng: location.coords.longitude,
          });
        }
      } catch (err) {
        console.error('Error updating location in background:', err);
      }
    }
  }
});

export async function startBackgroundLocationTracking(): Promise<boolean> {
  try {
    // Check if task is already registered
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
    
    if (isRegistered) {
      console.log('Background location task already registered');
      return true;
    }

    // Request background location permission
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    
    if (foregroundStatus !== 'granted') {
      console.error('Foreground permission not granted');
      return false;
    }

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    
    if (backgroundStatus !== 'granted') {
      console.error('Background permission not granted');
      return false;
    }

    // Start location updates in background
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 30000, // Update every 30 seconds
      distanceInterval: 50, // Or every 50 meters
      foregroundService: {
        notificationTitle: 'Halo is active',
        notificationBody: 'Tracking your trip for safety',
        notificationColor: '#5170FF',
      },
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    });

    console.log('Background location tracking started');
    return true;
  } catch (error) {
    console.error('Error starting background location:', error);
    return false;
  }
}

export async function stopBackgroundLocationTracking(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
    
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      console.log('Background location tracking stopped');
    }
  } catch (error) {
    console.error('Error stopping background location:', error);
  }
}

export async function isBackgroundLocationActive(): Promise<boolean> {
  try {
    return await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
  } catch (error) {
    console.error('Error checking background location status:', error);
    return false;
  }
}

