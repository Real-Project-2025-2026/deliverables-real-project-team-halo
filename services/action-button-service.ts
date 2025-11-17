/**
 * Action Button Service
 * Handles iOS Action Button integration for check-in confirmation
 */

import { NativeModules, Platform, NativeEventEmitter } from 'react-native';
import * as Linking from 'expo-linking';
import { getPendingCheckins } from './checkin-service';

// Try to get the native module, but handle gracefully if it doesn't exist
const CheckinIntent = NativeModules.CheckinIntent 
  ? new NativeEventEmitter(NativeModules.CheckinIntent)
  : null;

export interface ActionButtonServiceError {
  error: string;
  details?: unknown;
}

/**
 * Check if Action Button / App Intents are available
 */
export async function isActionButtonAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return false;
  }

  if (CheckinIntent) {
    try {
      return await CheckinIntent.isAvailable();
    } catch (error) {
      console.error('[Action Button] Error checking availability:', error);
      return false;
    }
  }

  return false;
}

/**
 * Setup Action Button listener
 * This listens for App Intent responses from the Action Button
 * 
 * Note: This requires the activeTrip to be passed or retrieved from storage
 */
export function setupActionButtonListener(
  onCheckinResponse: (response: 'ok' | 'help', checkinId: number) => Promise<void>,
  getActiveTrip: () => Promise<{ id: number } | null>
): () => void {
  if (Platform.OS !== 'ios' || !CheckinIntent) {
    console.log('[Action Button] App Intents not available');
    return () => {}; // No-op cleanup
  }

  const subscription = CheckinIntent.addListener('checkinResponse', async (event: {
    response: string;
    timestamp: number;
  }) => {
    try {
      const response = event.response as 'ok' | 'help';
      
      // Get the active trip
      const activeTrip = await getActiveTrip();
      
      if (!activeTrip) {
        console.warn('[Action Button] No active trip found');
        return;
      }

      const { data: pendingCheckins } = await getPendingCheckins(activeTrip.id);
      
      if (!pendingCheckins || pendingCheckins.length === 0) {
        console.warn('[Action Button] No pending check-ins found');
        return;
      }

      // Use the most recent pending check-in
      const checkinId = pendingCheckins[0].id;
      
      // Call the callback (haptic feedback is handled in the callback)
      await onCheckinResponse(response, checkinId);
    } catch (error) {
      console.error('[Action Button] Error handling check-in response:', error);
    }
  });

  return () => {
    subscription?.remove();
  };
}

/**
 * Handle deep link from Action Button
 * Format: haloapp://checkin/ok or haloapp://checkin/help
 */
export async function handleActionButtonDeepLink(url: string): Promise<{
  handled: boolean;
  error?: ActionButtonServiceError;
}> {
  try {
    const parsedUrl = Linking.parse(url);
    
    if (parsedUrl.scheme !== 'haloapp' || parsedUrl.hostname !== 'checkin') {
      return { handled: false };
    }

    const response = parsedUrl.path as 'ok' | 'help';
    
    if (response !== 'ok' && response !== 'help') {
      return {
        handled: false,
        error: { error: 'Invalid response type' },
      };
    }

    // Get active trip and pending check-in
    // Note: This requires access to the trip context
    // In a real implementation, you'd pass the checkinId or get it from storage
    
    return { handled: true };
  } catch (error) {
    return {
      handled: false,
      error: { error: 'Failed to handle deep link', details: error },
    };
  }
}

