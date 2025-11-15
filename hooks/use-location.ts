import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';

export type LocationPermissionStatus = 'undetermined' | 'granted' | 'denied';

interface UseLocationReturn {
  location: Location.LocationObject | null;
  isLoading: boolean;
  error: string | null;
  permissionStatus: LocationPermissionStatus;
  requestPermission: () => Promise<boolean>;
  getCurrentLocation: () => Promise<Location.LocationObject | null>;
  startWatchingLocation: (callback: (location: Location.LocationObject) => void) => Promise<void>;
  stopWatchingLocation: () => void;
}

export function useLocation(): UseLocationReturn {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<LocationPermissionStatus>('undetermined');
  const [watchSubscription, setWatchSubscription] = useState<Location.LocationSubscription | null>(null);

  // Check permission status on mount
  useEffect(() => {
    checkPermissionStatus();
  }, []);

  async function checkPermissionStatus() {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      setPermissionStatus(status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined');
    } catch (err) {
      console.error('Error checking location permission:', err);
    }
  }

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        setPermissionStatus('denied');
        setError('Location permission denied');
        return false;
      }

      setPermissionStatus('granted');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to request permission';
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getCurrentLocation = useCallback(async (): Promise<Location.LocationObject | null> => {
    try {
      setIsLoading(true);
      setError(null);

      // Check permission first
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const granted = await requestPermission();
        if (!granted) return null;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 1,
        mayShowUserSettingsDialog: true,
      });

      setLocation(currentLocation);
      return currentLocation;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get location';
      setError(errorMessage);
      console.error('Error getting location:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [requestPermission]);

  const startWatchingLocation = useCallback(async (callback: (location: Location.LocationObject) => void) => {
    try {
      setIsLoading(true);
      setError(null);

      // Check permission
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const granted = await requestPermission();
        if (!granted) return;
      }

      // Stop existing subscription if any
      if (watchSubscription) {
        watchSubscription.remove();
      }

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10000, // Update every 10 seconds
          distanceInterval: 10, // Or every 10 meters
        },
        (newLocation) => {
          setLocation(newLocation);
          callback(newLocation);
        }
      );

      setWatchSubscription(subscription);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to watch location';
      setError(errorMessage);
      console.error('Error watching location:', err);
    } finally {
      setIsLoading(false);
    }
  }, [requestPermission, watchSubscription]);

  const stopWatchingLocation = useCallback(() => {
    if (watchSubscription) {
      watchSubscription.remove();
      setWatchSubscription(null);
    }
  }, [watchSubscription]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchSubscription) {
        watchSubscription.remove();
      }
    };
  }, [watchSubscription]);

  return {
    location,
    isLoading,
    error,
    permissionStatus,
    requestPermission,
    getCurrentLocation,
    startWatchingLocation,
    stopWatchingLocation,
  };
}

