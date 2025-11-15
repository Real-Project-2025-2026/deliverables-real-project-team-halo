import { supabase } from '@/lib/supabase';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/supabase';

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
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return { data: null, error: { error: 'Not authenticated' } };
    }

    // Check if user already has an active trip
    const { data: existingTrips } = await supabase
      .from('trips')
      .select('id')
      .eq('user_id', session.user.id)
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
      user_id: session.user.id,
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
      const { data: validGuardians, error: guardiansError } = await supabase
        .from('guardians')
        .select('requester_id, recipient_id')
        .eq('status', 'accepted')
        .or(
          `and(requester_id.eq.${session.user.id},recipient_id.in.(${params.guardianIds.join(',')})),and(recipient_id.eq.${session.user.id},requester_id.in.(${params.guardianIds.join(',')}))`
        );

      if (guardiansError) {
        console.error('Error validating Guardians:', guardiansError);
      } else if (validGuardians) {
        // Create trip_guardians entries
        const tripGuardianInserts = params.guardianIds
          .filter((guardianId) =>
            validGuardians.some(
              (g) =>
                (g.requester_id === session.user.id && g.recipient_id === guardianId) ||
                (g.recipient_id === session.user.id && g.requester_id === guardianId)
            )
          )
          .map((guardianId) => ({
            trip_id: data.id,
            guardian_id: guardianId,
          }));

        if (tripGuardianInserts.length > 0) {
          const { error: tripGuardiansError } = await supabase
            .from('trip_guardians')
            .insert(tripGuardianInserts);

          if (tripGuardiansError) {
            console.error('Error adding Guardians to trip:', tripGuardiansError);
          }
        }
      }
    }

    // Log event
    await supabase.from('events').insert({
      user_id: session.user.id,
      trip_id: data.id,
      event_type: 'trip_started',
      metadata: {
        mode: params.mode,
        safetogether: params.safetogetherEnabled,
        guardians: params.guardianIds?.length || 0,
      },
    });

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: { error: 'Failed to start trip', details: err },
    };
  }
}

/**
 * Get active trip for current user
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

    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('status', 'active')
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
 * Update trip location
 */
export async function updateTripLocation(
  tripId: number,
  latitude: number,
  longitude: number
): Promise<{ error: TripServiceError | null }> {
  try {
    const { error } = await supabase
      .from('trips')
      .update({
        last_known_latitude: latitude,
        last_known_longitude: longitude,
        last_location_update_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', tripId);

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

    // Log event
    await supabase.from('events').insert({
      user_id: session.user.id,
      trip_id: tripId,
      event_type: 'trip_completed',
    });

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

    // Log event
    await supabase.from('events').insert({
      user_id: session.user.id,
      trip_id: tripId,
      event_type: 'trip_escalated',
    });

    return { error: null };
  } catch (err) {
    return { error: { error: 'Failed to escalate trip', details: err } };
  }
}

