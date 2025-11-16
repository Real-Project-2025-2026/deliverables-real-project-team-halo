import { supabase } from '@/lib/supabase';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/supabase';
import {
  getEmergencyContactsForTripStart,
  getEmergencyContactsForTripEnd,
  getActiveEmergencyContactsForEscalation,
} from '@/services/emergency-contact-service';
import { notifyEmergencyContacts } from '@/services/notification-service';

export type Trip = Tables<'trips'>;
export type TripInsert = TablesInsert<'trips'>;
export type TripUpdate = TablesUpdate<'trips'>;
export type TripMode = 'silent' | 'interval' | 'continuous';
export type TripStatus = 'active' | 'completed' | 'escalated' | 'cancelled';

export interface StartTripParams {
  mode: TripMode;
  checkinIntervalMinutes: number;
  safetogetherEnabled: boolean;
  guardianIds?: string[]; // Array of Guardian user IDs to notify
  destinationAddress?: string;
  destinationLatitude?: number;
  destinationLongitude?: number;
  originLatitude?: number;
  originLongitude?: number;
  originAddress?: string;
}

export interface TripServiceError {
  error: string;
  details?: unknown;
}

/**
 * Start a new safety trip
 */
export async function startTrip(
  params: StartTripParams
): Promise<{ data: Trip | null; error: TripServiceError | null }> {
  try {
    // Use getUser() instead of getSession() to ensure fresh session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('Authentication error:', authError);
      return { data: null, error: { error: 'Not authenticated. Please log in again.' } };
    }

    // Check if user already has an active trip
    const { data: existingTrips } = await supabase
      .from('trips')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1);

    if (existingTrips && existingTrips.length > 0) {
      return {
        data: null,
        error: { error: 'You already have an active trip. Please end it first.' },
      };
    }

    // Create new trip
    const tripData: TripInsert = {
      user_id: user.id,
      mode: params.mode,
      checkin_interval_minutes: params.checkinIntervalMinutes,
      safetogether_enabled: params.safetogetherEnabled,
      destination_address: params.destinationAddress,
      destination_latitude: params.destinationLatitude,
      destination_longitude: params.destinationLongitude,
      origin_latitude: params.originLatitude,
      origin_longitude: params.originLongitude,
      origin_address: params.originAddress,
      status: 'active',
      started_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('trips')
      .insert(tripData)
      .select()
      .single();

    if (error) {
      return { data: null, error: { error: error.message, details: error } };
    }

    // Add Guardians to trip if provided
    if (params.guardianIds && params.guardianIds.length > 0) {
      // Verify that all provided Guardian IDs are actually Guardians of the user
      // Query Guardians where user is requester and Guardian IDs are recipients
      const { data: guardiansAsRequester } = await supabase
        .from('guardians')
        .select('recipient_id')
        .eq('requester_id', user.id)
        .eq('status', 'accepted')
        .in('recipient_id', params.guardianIds);

      // Query Guardians where user is recipient and Guardian IDs are requesters
      const { data: guardiansAsRecipient } = await supabase
        .from('guardians')
        .select('requester_id')
        .eq('recipient_id', user.id)
        .eq('status', 'accepted')
        .in('requester_id', params.guardianIds);

      // Combine validated Guardian IDs
      const validatedGuardianIds = new Set<string>();
      guardiansAsRequester?.forEach((g) => validatedGuardianIds.add(g.recipient_id));
      guardiansAsRecipient?.forEach((g) => validatedGuardianIds.add(g.requester_id));

      // Create trip_guardians entries only for validated Guardians
      if (validatedGuardianIds.size > 0) {
        const tripGuardianInserts = Array.from(validatedGuardianIds).map((guardianId) => ({
          trip_id: data.id,
          guardian_id: guardianId,
        }));

        const { error: tripGuardiansError } = await supabase
          .from('trip_guardians')
          .insert(tripGuardianInserts);

        if (tripGuardiansError) {
          console.error('Error adding Guardians to trip:', tripGuardiansError);
          // Don't fail trip creation if Guardian insertion fails
        }
      }
    }

    // Get user profile for notification messages (non-blocking)
    let userName = 'A Halo user';
    let userProfile: { full_name: string | null; username: string | null } | null = null;
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, username')
        .eq('id', user.id)
        .single();
      
      if (profileData) {
        userProfile = profileData;
        userName = profileData.full_name || profileData.username || 'A Halo user';
      }
    } catch (err) {
      console.warn('Could not fetch user profile for notifications:', err);
      // Continue anyway with default name
    }

    // Log event (non-blocking)
    try {
      await supabase.from('events').insert({
        user_id: user.id,
        trip_id: data.id,
        event_type: 'trip_started',
        metadata: {
          mode: params.mode,
          safetogether: params.safetogetherEnabled,
          guardians: params.guardianIds?.length || 0,
        },
      });
    } catch (err) {
      console.error('Error logging trip_started event:', err);
      // Don't fail trip creation if event logging fails
    }

    // Notify Emergency Contacts (non-blocking - don't fail trip creation)
    try {
      const { data: emergencyContacts, error: contactsError } = await getEmergencyContactsForTripStart();
      
      if (contactsError) {
        console.warn('Error fetching emergency contacts for notification:', contactsError);
        // Continue - trip should still be created
      } else if (emergencyContacts && emergencyContacts.length > 0) {
        const message = `${userName} has started a safety trip on Halo. They're on their way and will check in periodically.`;
        await notifyEmergencyContacts({
          contacts: emergencyContacts,
          message,
          type: 'trip_start',
          tripId: data.id,
          location: params.originLatitude && params.originLongitude
            ? { latitude: params.originLatitude, longitude: params.originLongitude }
            : undefined,
        }).catch((err) => {
          console.error('Error in notifyEmergencyContacts:', err);
          // Don't fail trip creation
        });
      }
    } catch (err) {
      console.error('Error notifying emergency contacts on trip start:', err);
      // Don't fail trip creation if notification fails
    }

    // Notify selected Guardians (non-blocking - don't fail trip creation)
    if (params.guardianIds && params.guardianIds.length > 0) {
      try {
        const { getPushTokenForUser, sendGuardianTripStartNotification } = await import(
          '@/services/notification-service'
        );

        // Get user profile for notification
        const userUsername = userProfile?.username || null;

        // Notify each Guardian
        const guardianNotifications = params.guardianIds.map(async (guardianId) => {
          try {
            const pushToken = await getPushTokenForUser(guardianId);
            if (pushToken) {
              await sendGuardianTripStartNotification(
                pushToken,
                userName,
                userUsername || 'Someone',
                data.id
              ).catch((err) => {
                console.error(`Error notifying Guardian ${guardianId}:`, err);
                // Don't fail if one Guardian notification fails
              });
            }
          } catch (err) {
            console.error(`Error getting push token for Guardian ${guardianId}:`, err);
            // Don't fail if one Guardian notification fails
          }
        });

        // Wait for all notifications (but don't fail trip creation)
        await Promise.allSettled(guardianNotifications);
      } catch (err) {
        console.error('Error notifying Guardians on trip start:', err);
        // Don't fail trip creation if Guardian notifications fail
      }
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: { error: 'Failed to start trip', details: err },
    };
  }
}

/**
 * Get active trip for current user (including escalated trips)
 */
export async function getActiveTrip(): Promise<{
  data: Trip | null;
  error: TripServiceError | null;
}> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return { data: null, error: { error: 'Not authenticated' } };
    }

    // Include both 'active' and 'escalated' trips since escalated is still an active trip state
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('user_id', session.user.id)
      .in('status', ['active', 'escalated'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return { data: null, error: { error: error.message, details: error } };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: { error: 'Failed to get active trip', details: err },
    };
  }
}

/**
 * Update trip location and record route point
 */
export async function updateTripLocation(
  tripId: number,
  latitude: number,
  longitude: number,
  metadata?: {
    accuracy?: number;
    altitude?: number;
    heading?: number;
    speed?: number;
  }
): Promise<{ error: TripServiceError | null }> {
  try {
    // Update trip's last known location (non-blocking if route point fails)
    const updatePromise = supabase
      .from('trips')
      .update({
        last_known_latitude: latitude,
        last_known_longitude: longitude,
        last_location_update_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', tripId);

    // Record route point (non-blocking - don't fail if route recording fails)
    const { recordRoutePoint } = await import('@/services/route-service');
    const routePromise = recordRoutePoint(tripId, latitude, longitude, metadata).catch(
      (err) => {
        console.warn('Error recording route point (non-blocking):', err);
        // Don't fail location update if route point recording fails
      }
    );

    // Wait for both operations (but don't fail if route point fails)
    const [{ error }] = await Promise.all([updatePromise, routePromise]);

    if (error) {
      return { error: { error: error.message, details: error } };
    }

    return { error: null };
  } catch (err) {
    return { error: { error: 'Failed to update location', details: err } };
  }
}

/**
 * Complete a trip successfully
 */
export async function completeTrip(
  tripId: number
): Promise<{ error: TripServiceError | null }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return { error: { error: 'Not authenticated' } };
    }

    const { error } = await supabase
      .from('trips')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', tripId)
      .eq('user_id', session.user.id);

    if (error) {
      return { error: { error: error.message, details: error } };
    }

    // Log event (non-blocking)
    try {
      await supabase.from('events').insert({
        user_id: session.user.id,
        trip_id: tripId,
        event_type: 'trip_completed',
      });
    } catch (err) {
      console.error('Error logging trip_completed event:', err);
      // Don't fail trip completion if event logging fails
    }

    // Get trip and user profile for notification messages (non-blocking)
    let userName = 'A Halo user';
    let destination = 'their destination';
    
    try {
      const [tripResult, profileResult] = await Promise.all([
        supabase
          .from('trips')
          .select('destination_address')
          .eq('id', tripId)
          .single(),
        supabase
          .from('profiles')
          .select('full_name, username')
          .eq('id', user.id)
          .single(),
      ]);

      if (tripResult.data) {
        destination = tripResult.data.destination_address || 'their destination';
      }

      if (profileResult.data) {
        userName = profileResult.data.full_name || profileResult.data.username || 'A Halo user';
      }
    } catch (err) {
      console.warn('Could not fetch trip/profile for notifications:', err);
      // Continue anyway with default values
    }

    // Notify Emergency Contacts (non-blocking - don't fail trip completion)
    try {
      const { data: emergencyContacts, error: contactsError } = await getEmergencyContactsForTripEnd();
      
      if (contactsError) {
        console.warn('Error fetching emergency contacts for notification:', contactsError);
        // Continue - trip should still be completed
      } else if (emergencyContacts && emergencyContacts.length > 0) {
        const message = `${userName} has safely completed their trip on Halo and arrived at ${destination}.`;
        await notifyEmergencyContacts({
          contacts: emergencyContacts,
          message,
          type: 'trip_end',
          tripId,
        }).catch((err) => {
          console.error('Error in notifyEmergencyContacts:', err);
          // Don't fail trip completion
        });
      }
    } catch (err) {
      console.error('Error notifying emergency contacts on trip end:', err);
      // Don't fail trip completion if notification fails
    }

    return { error: null };
  } catch (err) {
    return { error: { error: 'Failed to complete trip', details: err } };
  }
}

/**
 * Cancel a trip
 */
export async function cancelTrip(
  tripId: number
): Promise<{ error: TripServiceError | null }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return { error: { error: 'Not authenticated' } };
    }

    const { error } = await supabase
      .from('trips')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', tripId)
      .eq('user_id', session.user.id);

    if (error) {
      return { error: { error: error.message, details: error } };
    }

    // Log event
    await supabase.from('events').insert({
      user_id: session.user.id,
      trip_id: tripId,
      event_type: 'trip_cancelled',
    });

    return { error: null };
  } catch (err) {
    return { error: { error: 'Failed to cancel trip', details: err } };
  }
}

/**
 * Get trip history for current user
 */
export async function getTripHistory(
  limit: number = 20
): Promise<{ data: Trip[] | null; error: TripServiceError | null }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return { data: null, error: { error: 'Not authenticated' } };
    }

    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('user_id', session.user.id)
      .in('status', ['completed', 'cancelled', 'escalated'])
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { data: null, error: { error: error.message, details: error } };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: { error: 'Failed to get trip history', details: err },
    };
  }
}

/**
 * Increment missed check-ins counter
 */
export async function incrementMissedCheckins(
  tripId: number
): Promise<{ missedCount: number; error: TripServiceError | null }> {
  try {
    // Get current count
    const { data: trip } = await supabase
      .from('trips')
      .select('missed_checkins_count')
      .eq('id', tripId)
      .single();

    const newCount = (trip?.missed_checkins_count || 0) + 1;

    const { error } = await supabase
      .from('trips')
      .update({
        missed_checkins_count: newCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tripId);

    if (error) {
      return { missedCount: 0, error: { error: error.message, details: error } };
    }

    return { missedCount: newCount, error: null };
  } catch (err) {
    return {
      missedCount: 0,
      error: { error: 'Failed to update missed check-ins', details: err },
    };
  }
}

/**
 * Escalate trip to emergency
 */
export async function escalateTrip(
  tripId: number
): Promise<{ error: TripServiceError | null }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return { error: { error: 'Not authenticated' } };
    }

    // Check if already escalated to prevent duplicate notifications
    const { data: existingTrip } = await supabase
      .from('trips')
      .select('status, escalation_notified, last_known_latitude, last_known_longitude, last_location_update_at')
      .eq('id', tripId)
      .single();

    if (existingTrip?.status === 'escalated' && existingTrip?.escalation_notified) {
      // Already escalated and notified, skip
      return { error: null };
    }

    // Get trip details for notification (before update)
    const trip = existingTrip;

    const { error } = await supabase
      .from('trips')
      .update({
        status: 'escalated',
        escalated_at: new Date().toISOString(),
        escalation_notified: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tripId);

    if (error) {
      return { error: { error: error.message, details: error } };
    }

    // Log event (non-blocking)
    try {
      await supabase.from('events').insert({
        user_id: session.user.id,
        trip_id: tripId,
        event_type: 'trip_escalated',
      });
    } catch (err) {
      console.error('Error logging trip_escalated event:', err);
      // Don't fail escalation if event logging fails
    }

    // Get user profile for notification messages (non-blocking)
    let userName = 'A Halo user';
    try {
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('full_name, username')
        .eq('id', user.id)
        .single();
      
      if (userProfile) {
        userName = userProfile.full_name || userProfile.username || 'A Halo user';
      }
    } catch (err) {
      console.warn('Could not fetch user profile for notifications:', err);
      // Continue anyway with default name
    }

    // Notify Emergency Contacts (non-blocking - don't fail escalation)
    try {
      const { data: emergencyContacts, error: contactsError } =
        await getActiveEmergencyContactsForEscalation();
      
      if (contactsError) {
        console.warn('Error fetching emergency contacts for notification:', contactsError);
        // Continue - escalation should still be marked
      } else if (emergencyContacts && emergencyContacts.length > 0) {
        let message = `🚨 EMERGENCY: ${userName} has missed multiple check-ins on Halo and may need help.`;
        
        if (trip?.last_known_latitude && trip?.last_known_longitude) {
          const locationUrl = `https://maps.google.com/?q=${trip.last_known_latitude},${trip.last_known_longitude}`;
          message += ` Last known location: ${locationUrl}`;
        }

        await notifyEmergencyContacts({
          contacts: emergencyContacts,
          message,
          type: 'escalation',
          tripId,
          location:
            trip?.last_known_latitude && trip?.last_known_longitude
              ? {
                  latitude: trip.last_known_latitude,
                  longitude: trip.last_known_longitude,
                }
              : undefined,
        }).catch((err) => {
          console.error('Error in notifyEmergencyContacts:', err);
          // Don't fail escalation
        });
      }
    } catch (err) {
      console.error('Error notifying emergency contacts on escalation:', err);
      // Don't fail escalation if notification fails
    }

    return { error: null };
  } catch (err) {
    return { error: { error: 'Failed to escalate trip', details: err } };
  }
}

/**
 * Get all active trips where current user is a Guardian
 * Returns trips with user profile information
 */
export async function getGuardianTrips(): Promise<{
  data: Array<Trip & { user_profile: { id: string; username: string | null; full_name: string | null; avatar_url: string | null } }> | null;
  error: TripServiceError | null;
}> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: { error: 'Not authenticated' } };
    }

    // Get all active trips where current user is a Guardian
    const { data, error } = await supabase
      .from('trip_guardians')
      .select(
        `
        trip_id,
        trips!inner (
          *,
          profiles!trips_user_id_fkey (
            id,
            username,
            full_name,
            avatar_url
          )
        )
      `
      )
      .eq('guardian_id', user.id);

    if (error) {
      return { data: null, error: { error: error.message, details: error } };
    }

    // Filter only active/escalated trips and transform data
    const guardianTrips =
      data
        ?.filter((tg: any) => {
          const trip = tg.trips;
          return trip && (trip.status === 'active' || trip.status === 'escalated');
        })
        .map((tg: any) => {
          const trip = tg.trips;
          return {
            ...trip,
            user_profile: trip.profiles,
          };
        }) || [];

    return { data: guardianTrips, error: null };
  } catch (err) {
    return {
      data: null,
      error: { error: 'Failed to get guardian trips', details: err },
    };
  }
}

/**
 * Get details of a specific trip where current user is a Guardian
 */
export async function getGuardianTripDetails(
  tripId: number
): Promise<{
  data: (Trip & { user_profile: { id: string; username: string | null; full_name: string | null; avatar_url: string | null } }) | null;
  error: TripServiceError | null;
}> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: { error: 'Not authenticated' } };
    }

    // Verify user is a Guardian for this trip
    const { data: tripGuardian, error: guardianError } = await supabase
      .from('trip_guardians')
      .select('trip_id')
      .eq('trip_id', tripId)
      .eq('guardian_id', user.id)
      .single();

    if (guardianError || !tripGuardian) {
      return { data: null, error: { error: 'You are not a Guardian for this trip' } };
    }

    // Get trip details with user profile
    const { data: trip, error } = await supabase
      .from('trips')
      .select(
        `
        *,
        profiles!trips_user_id_fkey (
          id,
          username,
          full_name,
          avatar_url
        )
      `
      )
      .eq('id', tripId)
      .single();

    if (error) {
      return { data: null, error: { error: error.message, details: error } };
    }

    if (!trip) {
      return { data: null, error: { error: 'Trip not found' } };
    }

    return {
      data: {
        ...trip,
        user_profile: trip.profiles,
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: { error: 'Failed to get guardian trip details', details: err },
    };
  }
}

