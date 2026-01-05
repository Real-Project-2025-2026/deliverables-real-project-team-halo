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

// Track if token registration is in progress to avoid multiple simultaneous calls
let tokenRegistrationInProgress = false;
let lastRegisteredToken: string | null = null;

/**
 * Register push token with Supabase
 * Only updates if token has changed to avoid rate limiting
 */
export async function registerPushToken(): Promise<{
  token: string | null;
  error: NotificationServiceError | null;
}> {
  // Prevent multiple simultaneous registrations
  if (tokenRegistrationInProgress) {
    return { token: lastRegisteredToken, error: null };
  }

  try {
    tokenRegistrationInProgress = true;

    const { granted, error: permissionError } = await requestNotificationPermission();
    
    if (!granted || permissionError) {
      tokenRegistrationInProgress = false;
      return { token: null, error: permissionError };
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      tokenRegistrationInProgress = false;
      return { token: null, error: { error: 'Not authenticated' } };
    }

    // Check if token is already stored in profile (avoid unnecessary updates)
    const { data: profile } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('id', session.user.id)
      .single();

    // Only update if token is different or missing
    if (profile?.push_token === token) {
      lastRegisteredToken = token;
      tokenRegistrationInProgress = false;
      return { token, error: null };
    }

    // Store in profiles table first (this is what we use for queries)
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ 
        push_token: token,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.user.id);

    if (profileError) {
      console.error('Error storing push token in profile:', profileError);
      // Continue even if profile update fails
    } else {
      lastRegisteredToken = token;
    }

    // Optionally store in user metadata (but skip if we hit rate limit before)
    // Only update metadata if profile update succeeded to reduce Auth API calls
    if (!profileError) {
      try {
        await supabase.auth.updateUser({
          data: { push_token: token },
        });
      } catch (metadataError) {
        // Silently fail - profile table is the source of truth
        console.warn('Could not update push token in user metadata (may hit rate limit):', metadataError);
      }
    }

    tokenRegistrationInProgress = false;
    return { token, error: null };
  } catch (err) {
    tokenRegistrationInProgress = false;
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

/**
 * Get push token for a user (from their profile)
 */
export async function getPushTokenForUser(userId: string): Promise<string | null> {
  try {
    // Get push token from profiles table
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error getting push token from profile:', error);
      return null;
    }

    return profile?.push_token || null;
  } catch (err) {
    console.error('Error getting push token for user:', err);
    return null;
  }
}

/**
 * Send a Guardian request notification via Expo Push API
 * Note: This requires the recipient's Expo Push Token
 */
export async function sendGuardianRequestNotification(
  recipientPushToken: string,
  requesterName: string,
  requesterUsername: string
): Promise<{ error: NotificationServiceError | null }> {
  try {
    if (!recipientPushToken) {
      return { error: { error: 'No push token available for recipient' } };
    }

    // Send notification via Expo Push API
    const message = {
      to: recipientPushToken,
      sound: 'default',
      title: 'New Guardian Request',
      body: `@${requesterUsername} wants to add you as a Guardian`,
      data: {
        type: 'guardian_request',
        actionRequired: true,
      },
      priority: 'high',
      channelId: Platform.OS === 'android' ? 'checkin' : undefined,
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();

    if (result.errors && result.errors.length > 0) {
      return {
        error: {
          error: 'Failed to send Guardian request notification',
          details: result.errors,
        },
      };
    }

    return { error: null };
  } catch (err) {
    return {
      error: { error: 'Failed to send Guardian request notification', details: err },
    };
  }
}

/**
 * Send a Guardian trip started notification
 * Notifies Guardians when someone they're guarding starts a trip
 */
export async function sendGuardianTripStartNotification(
  guardianPushToken: string,
  userName: string,
  userUsername: string,
  tripId: number
): Promise<{ error: NotificationServiceError | null }> {
  try {
    if (!guardianPushToken) {
      return { error: { error: 'No push token available for Guardian' } };
    }

    const message = {
      to: guardianPushToken,
      sound: 'default',
      title: 'Guardian Trip Started',
      body: `${userName || userUsername} has started a safety trip`,
      data: {
        type: 'guardian_trip_started',
        tripId,
        actionRequired: false,
      },
      priority: 'high',
      channelId: Platform.OS === 'android' ? 'checkin' : undefined,
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();

    if (result.errors && result.errors.length > 0) {
      return {
        error: {
          error: 'Failed to send Guardian trip start notification',
          details: result.errors,
        },
      };
    }

    return { error: null };
  } catch (err) {
    return {
      error: { error: 'Failed to send Guardian trip start notification', details: err },
    };
  }
}

/**
 * Send a Guardian request accepted notification
 */
export async function sendGuardianAcceptedNotification(
  requesterPushToken: string,
  acceptorName: string,
  acceptorUsername: string
): Promise<{ error: NotificationServiceError | null }> {
  try {
    if (!requesterPushToken) {
      return { error: { error: 'No push token available for requester' } };
    }

    const message = {
      to: requesterPushToken,
      sound: 'default',
      title: 'Guardian Request Accepted',
      body: `@${acceptorUsername} accepted your Guardian request`,
      data: {
        type: 'guardian_accepted',
        actionRequired: false,
      },
      priority: 'default',
      channelId: Platform.OS === 'android' ? 'checkin' : undefined,
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();

    if (result.errors && result.errors.length > 0) {
      return {
        error: {
          error: 'Failed to send Guardian accepted notification',
          details: result.errors,
        },
      };
    }

    return { error: null };
  } catch (err) {
    return {
      error: { error: 'Failed to send Guardian accepted notification', details: err },
    };
  }
}

/**
 * Send a Guardian trip ended notification
 * Notifies Guardians when someone they're guarding completes a trip
 */
export async function sendGuardianTripEndNotification(
  guardianPushToken: string,
  userName: string,
  userUsername: string,
  tripId: number,
  destination?: string
): Promise<{ error: NotificationServiceError | null }> {
  try {
    if (!guardianPushToken) {
      return { error: { error: 'No push token available for Guardian' } };
    }

    const destinationText = destination ? ` and arrived at ${destination}` : '';
    const message = {
      to: guardianPushToken,
      sound: 'default',
      title: 'Guardian Trip Completed',
      body: `${userName || userUsername} has safely completed their trip${destinationText}`,
      data: {
        type: 'guardian_trip_ended',
        tripId,
        actionRequired: false,
      },
      priority: 'default',
      channelId: Platform.OS === 'android' ? 'checkin' : undefined,
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();

    if (result.errors && result.errors.length > 0) {
      return {
        error: {
          error: 'Failed to send Guardian trip end notification',
          details: result.errors,
        },
      };
    }

    return { error: null };
  } catch (err) {
    return {
      error: { error: 'Failed to send Guardian trip end notification', details: err },
    };
  }
}

/**
 * Send a Guardian escalation notification
 * Notifies Guardians when someone they're guarding has missed check-ins and needs help
 */
export async function sendGuardianEscalationNotification(
  guardianPushToken: string,
  userName: string,
  userUsername: string,
  tripId: number,
  location?: { latitude: number; longitude: number }
): Promise<{ error: NotificationServiceError | null }> {
  try {
    if (!guardianPushToken) {
      return { error: { error: 'No push token available for Guardian' } };
    }

    let body = `🚨 EMERGENCY: ${userName || userUsername} has missed multiple check-ins and may need help.`;
    
    if (location) {
      const locationUrl = `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
      body += ` Last known location: ${locationUrl}`;
    }

    const message = {
      to: guardianPushToken,
      sound: 'default',
      title: '🚨 Guardian Emergency Alert',
      body,
      data: {
        type: 'guardian_escalation',
        tripId,
        location,
        actionRequired: true,
      },
      priority: 'high',
      channelId: Platform.OS === 'android' ? 'emergency' : undefined,
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();

    if (result.errors && result.errors.length > 0) {
      return {
        error: {
          error: 'Failed to send Guardian escalation notification',
          details: result.errors,
        },
      };
    }

    return { error: null };
  } catch (err) {
    return {
      error: { error: 'Failed to send Guardian escalation notification', details: err },
    };
  }
}

/**
 * Get push token from recipient (from profiles table)
 */
export async function getRecipientPushToken(recipientId: string): Promise<string | null> {
  return getPushTokenForUser(recipientId);
}

/**
 * Notify emergency contacts via SMS/Email (placeholder for future integration)
 * For MVP: This logs the notification event. Later: Integrate Twilio (SMS) and SendGrid (Email)
 */
export async function notifyEmergencyContacts(params: {
  contacts: Array<{
    id: number;
    name: string;
    phone_number: string;
    email?: string | null;
  }>;
  message: string;
  type: 'trip_start' | 'trip_end' | 'escalation';
  tripId?: number;
  location?: { latitude: number; longitude: number };
}): Promise<{
  notified: number;
  errors: number;
}> {
  let notified = 0;
  let errors = 0;

  // TODO: Implement SMS/Email integration with Twilio and SendGrid
  // For now, we log the notification events
  
  for (const contact of params.contacts) {
    try {
      // Log notification event to database
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        await supabase.from('events').insert({
          user_id: session.user.id,
          trip_id: params.tripId || null,
          event_type: 'emergency_contact_notified',
          metadata: {
            contact_id: contact.id,
            contact_name: contact.name,
            contact_phone: contact.phone_number,
            contact_email: contact.email,
            notification_type: params.type,
            message: params.message,
            location: params.location,
          },
        });
      }

      // Log to console for development
      console.log(`[Emergency Contact Notification] ${params.type}`, {
        contact: contact.name,
        phone: contact.phone_number,
        email: contact.email,
        message: params.message,
      });

      // TODO: Send SMS via Twilio
      // if (contact.phone_number) {
      //   await twilioService.sendSMS({
      //     to: contact.phone_number,
      //     body: params.message,
      //   });
      // }

      // TODO: Send Email via SendGrid
      // if (contact.email) {
      //   await emailService.sendEmail({
      //     to: contact.email,
      //     subject: 'Halo Safety Alert',
      //     body: params.message,
      //   });
      // }

      notified++;
    } catch (error) {
      console.error(`Error notifying emergency contact ${contact.name}:`, error);
      errors++;
    }
  }

  return { notified, errors };
}

