import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface NotificationServiceError {
  error: string;
  details?: unknown;
}

/**
 * Request notification permissions
 */
export async function requestNotificationPermission(): Promise<{
  granted: boolean;
  error: NotificationServiceError | null;
}> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return {
        granted: false,
        error: { error: 'Notification permission denied' },
      };
    }

    // Configure notification channel for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('checkin', {
        name: 'Check-in Notifications',
        description: 'Notifications for safety check-ins',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#5170FF',
      });

      await Notifications.setNotificationChannelAsync('emergency', {
        name: 'Emergency Notifications',
        description: 'Notifications for emergency alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 500, 500],
        lightColor: '#FF3B30',
      });
    }

    return { granted: true, error: null };
  } catch (err) {
    return {
      granted: false,
      error: { error: 'Failed to request notification permission', details: err },
    };
  }
}

/**
 * Register push token with Supabase
 */
export async function registerPushToken(): Promise<{
  token: string | null;
  error: NotificationServiceError | null;
}> {
  try {
    const { granted, error: permissionError } = await requestNotificationPermission();
    
    if (!granted || permissionError) {
      return { token: null, error: permissionError };
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();

    const token = tokenData.data;

    // Store token in Supabase user metadata
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      // Store token in user metadata
      const { error } = await supabase.auth.updateUser({
        data: { push_token: token },
      });

      if (error) {
        console.error('Error storing push token:', error);
      }
    }

    return { token, error: null };
  } catch (err) {
    return {
      token: null,
      error: { error: 'Failed to register push token', details: err },
    };
  }
}

/**
 * Send a check-in notification
 */
export async function sendCheckinNotification(checkinId: number): Promise<{
  error: NotificationServiceError | null;
}> {
  try {
    const { granted, error: permissionError } = await requestNotificationPermission();
    
    if (!granted || permissionError) {
      return { error: permissionError };
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Are you okay?",
        body: "Please confirm you're safe",
        data: {
          type: 'checkin',
          checkinId,
          actionRequired: true,
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // Send immediately
    });

    return { error: null };
  } catch (err) {
    return {
      error: { error: 'Failed to send check-in notification', details: err },
    };
  }
}

/**
 * Send an escalation notification
 */
export async function sendEscalationNotification(): Promise<{
  error: NotificationServiceError | null;
}> {
  try {
    const { granted, error: permissionError } = await requestNotificationPermission();
    
    if (!granted || permissionError) {
      return { error: permissionError };
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Emergency Alert",
        body: "Your emergency contacts have been notified",
        data: {
          type: 'escalation',
          actionRequired: false,
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: null, // Send immediately
    });

    return { error: null };
  } catch (err) {
    return {
      error: { error: 'Failed to send escalation notification', details: err },
    };
  }
}

/**
 * Cancel a specific notification
 */
export async function cancelNotification(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.error('Error canceling notification:', error);
  }
}

/**
 * Cancel all notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Error canceling all notifications:', error);
  }
}

/**
 * Get notification listener for handling taps
 */
export function addNotificationReceivedListener(
  listener: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(listener);
}

/**
 * Get notification response listener (when user taps notification)
 */
export function addNotificationResponseReceivedListener(
  listener: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(listener);
}

