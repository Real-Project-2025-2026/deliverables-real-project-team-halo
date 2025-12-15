import { supabase } from '@/lib/supabase';
import { getActiveEmergencyContactsForEscalation } from './emergency-contact-service';
import {
  notifyEmergencyContacts,
  sendGuardianPanicNotification,
  sendEscalationNotification,
  getRecipientPushToken,
} from './notification-service';
import { getMyGuardians } from './guardian-service';

export type PanicEventType = 'activated' | 'cancelled' | 'triggered';

export interface PanicServiceError {
  error: string;
  details?: unknown;
}

/**
 * Log a panic event to the database
 */
export async function logPanicEvent(
  type: PanicEventType,
  location?: { latitude: number; longitude: number }
): Promise<{ error: PanicServiceError | null }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return { error: { error: 'Not authenticated' } };
    }

    await supabase.from('events').insert({
      user_id: session.user.id,
      event_type: `panic_${type}`,
      metadata: {
        location,
        timestamp: new Date().toISOString(),
      },
    });

    console.log(`[Panic Service] Event logged: panic_${type}`);
    return { error: null };
  } catch (err) {
    console.error('[Panic Service] Error logging panic event:', err);
    return { error: { error: 'Failed to log panic event', details: err } };
  }
}

/**
 * Trigger the panic alarm - notify all emergency contacts and guardians
 */
export async function triggerPanicAlarm(
  location?: { latitude: number; longitude: number }
): Promise<{
  notifiedContacts: number;
  notifiedGuardians: number;
  error: PanicServiceError | null;
}> {
  let notifiedContacts = 0;
  let notifiedGuardians = 0;

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return {
        notifiedContacts: 0,
        notifiedGuardians: 0,
        error: { error: 'Not authenticated' },
      };
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, full_name')
      .eq('id', session.user.id)
      .single();

    const userName = profile?.full_name || profile?.username || 'Someone';
    const userUsername = profile?.username || 'unknown';

    // Log the trigger event
    await logPanicEvent('triggered', location);

    // 1. Get and notify emergency contacts
    const { data: emergencyContacts } = await getActiveEmergencyContactsForEscalation();

    if (emergencyContacts && emergencyContacts.length > 0) {
      let locationText = '';
      if (location) {
        const locationUrl = `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
        locationText = ` Letzte bekannte Position: ${locationUrl}`;
      }

      const message = `🚨 NOTFALL: ${userName} hat den Panic Button aktiviert und braucht möglicherweise Hilfe!${locationText}`;

      const result = await notifyEmergencyContacts({
        contacts: emergencyContacts.map((c) => ({
          id: c.id,
          name: c.name,
          phone_number: c.phone_number,
          email: c.email,
        })),
        message,
        type: 'escalation',
        location,
      });

      notifiedContacts = result.notified;
      console.log(`[Panic Service] Notified ${notifiedContacts} emergency contacts`);
    }

    // 2. Get and notify guardians
    const { data: guardians } = await getMyGuardians();

    if (guardians && guardians.length > 0) {
      for (const guardian of guardians) {
        // Get the other user in the relationship (the actual guardian)
        const guardianUserId =
          guardian.requester_id === session.user.id
            ? guardian.recipient_id
            : guardian.requester_id;

        if (!guardianUserId) continue;

        const pushToken = await getRecipientPushToken(guardianUserId);

        if (pushToken) {
          const result = await sendGuardianPanicNotification(
            pushToken,
            userName,
            userUsername,
            location
          );

          if (!result.error) {
            notifiedGuardians++;
          }
        }
      }
      console.log(`[Panic Service] Notified ${notifiedGuardians} guardians`);
    }

    // 3. Send local notification to user
    await sendEscalationNotification();

    // 4. Log summary event
    await supabase.from('events').insert({
      user_id: session.user.id,
      event_type: 'panic_alarm_sent',
      metadata: {
        emergency_contacts_notified: notifiedContacts,
        guardians_notified: notifiedGuardians,
        location,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      notifiedContacts,
      notifiedGuardians,
      error: null,
    };
  } catch (err) {
    console.error('[Panic Service] Error triggering panic alarm:', err);
    return {
      notifiedContacts,
      notifiedGuardians,
      error: { error: 'Failed to trigger panic alarm', details: err },
    };
  }
}

/**
 * Check if user has any emergency contacts or guardians set up
 */
export async function hasPanicContacts(): Promise<{
  hasContacts: boolean;
  emergencyContactCount: number;
  guardianCount: number;
  error: PanicServiceError | null;
}> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return {
        hasContacts: false,
        emergencyContactCount: 0,
        guardianCount: 0,
        error: { error: 'Not authenticated' },
      };
    }

    // Count emergency contacts
    const { data: emergencyContacts } = await getActiveEmergencyContactsForEscalation();
    const emergencyContactCount = emergencyContacts?.length || 0;

    // Count guardians
    const { data: guardians } = await getMyGuardians();
    const guardianCount = guardians?.length || 0;

    return {
      hasContacts: emergencyContactCount > 0 || guardianCount > 0,
      emergencyContactCount,
      guardianCount,
      error: null,
    };
  } catch (err) {
    return {
      hasContacts: false,
      emergencyContactCount: 0,
      guardianCount: 0,
      error: { error: 'Failed to check panic contacts', details: err },
    };
  }
}

