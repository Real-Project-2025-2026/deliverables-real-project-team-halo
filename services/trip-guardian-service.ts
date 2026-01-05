import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type TripGuardianStatus = 'requested' | 'accepted' | 'declined';

export interface TripGuardianWithDetails {
  id: number;
  trip_id: number;
  guardian_id: string;
  status: TripGuardianStatus;
  created_at: string;
  responded_at: string | null;
  updated_at: string;
  // Trip details
  trip?: {
    id: number;
    user_id: string;
    destination_address: string | null;
    origin_address: string | null;
    started_at: string | null;
    checkin_interval_minutes: number;
    mode: string;
    status: string;
  };
  // Trip owner profile
  trip_owner?: {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
  // Guardian profile (for trip owner's view)
  guardian?: {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface TripGuardianServiceError {
  error: string;
  details?: unknown;
}

/**
 * Get all trip guardian requests for the current user (as guardian)
 * These are trips where someone wants the current user to watch over them
 */
export async function getTripGuardianRequests(): Promise<{
  data: TripGuardianWithDetails[] | null;
  error: TripGuardianServiceError | null;
}> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: { error: 'Not authenticated' } };
    }

    // Get all trip_guardians where current user is the guardian
    // Include trip details and trip owner profile
    // Note: RLS policy on trips allows Guardians to see trips they're guarding
    console.log('[TripGuardianService] Fetching requests for guardian:', user.id);
    
    const { data, error } = await supabase
      .from('trip_guardians')
      .select(`
        *,
        trip:trips!inner (
          id,
          user_id,
          destination_address,
          origin_address,
          started_at,
          checkin_interval_minutes,
          mode,
          status
        )
      `)
      .eq('guardian_id', user.id)
      .in('status', ['requested']) // Only pending requests
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[TripGuardianService] Error fetching requests:', error);
      return { data: null, error: { error: error.message, details: error } };
    }

    console.log('[TripGuardianService] Raw data from query:', data?.length || 0, 'entries');

    // Filter only active/escalated trips and fetch trip owner profiles
    const activeRequests = (data || []).filter(
      (tg: any) => tg.trip && ['active', 'escalated'].includes(tg.trip.status)
    );

    console.log('[TripGuardianService] Active requests after filtering:', activeRequests.length);

    // Fetch trip owner profiles
    const tripOwnerIds = [...new Set(activeRequests.map((tg: any) => tg.trip.user_id))];
    
    let profilesMap: Record<string, any> = {};
    if (tripOwnerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', tripOwnerIds);
      
      if (profiles) {
        profilesMap = profiles.reduce((acc, p) => {
          acc[p.id] = p;
          return acc;
        }, {} as Record<string, any>);
      }
    }

    // Map to include trip_owner
    const result = activeRequests.map((tg: any) => ({
      ...tg,
      trip_owner: profilesMap[tg.trip.user_id] || null,
    }));

    console.log('[TripGuardianService] Final result:', result.length, 'requests');

    return { data: result, error: null };
  } catch (err) {
    return {
      data: null,
      error: { error: 'Failed to get trip guardian requests', details: err },
    };
  }
}

/**
 * Get all guardians for a specific trip (for trip owner's view)
 * Returns guardians with their status (requested/accepted/declined)
 */
export async function getTripGuardians(tripId: number): Promise<{
  data: TripGuardianWithDetails[] | null;
  error: TripGuardianServiceError | null;
}> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: { error: 'Not authenticated' } };
    }

    // Get all trip_guardians for this trip
    const { data, error } = await supabase
      .from('trip_guardians')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: true });

    if (error) {
      return { data: null, error: { error: error.message, details: error } };
    }

    // Fetch guardian profiles
    const guardianIds = (data || []).map((tg) => tg.guardian_id);
    
    let profilesMap: Record<string, any> = {};
    if (guardianIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', guardianIds);
      
      if (profiles) {
        profilesMap = profiles.reduce((acc, p) => {
          acc[p.id] = p;
          return acc;
        }, {} as Record<string, any>);
      }
    }

    // Map to include guardian profile
    const result = (data || []).map((tg) => ({
      ...tg,
      guardian: profilesMap[tg.guardian_id] || null,
    }));

    return { data: result, error: null };
  } catch (err) {
    return {
      data: null,
      error: { error: 'Failed to get trip guardians', details: err },
    };
  }
}

/**
 * Accept a trip guardian request
 */
export async function acceptTripGuardianRequest(tripGuardianId: number): Promise<{
  data: TripGuardianWithDetails | null;
  error: TripGuardianServiceError | null;
}> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: { error: 'Not authenticated' } };
    }

    // Verify this is a request for the current user
    const { data: existing, error: existingError } = await supabase
      .from('trip_guardians')
      .select('*, trip:trips!inner(user_id, status)')
      .eq('id', tripGuardianId)
      .eq('guardian_id', user.id)
      .eq('status', 'requested')
      .single();

    if (existingError || !existing) {
      return { data: null, error: { error: 'Request not found or already processed' } };
    }

    // Check trip is still active
    if (!['active', 'escalated'].includes(existing.trip.status)) {
      return { data: null, error: { error: 'Trip is no longer active' } };
    }

    // Update status to accepted
    const { data, error } = await supabase
      .from('trip_guardians')
      .update({
        status: 'accepted',
        responded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', tripGuardianId)
      .select()
      .single();

    if (error) {
      return { data: null, error: { error: error.message, details: error } };
    }

    // Send notification to trip owner (non-blocking)
    notifyTripOwnerOfResponse(existing.trip.user_id, user.id, 'accepted').catch(console.error);

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: { error: 'Failed to accept request', details: err },
    };
  }
}

/**
 * Decline a trip guardian request
 */
export async function declineTripGuardianRequest(tripGuardianId: number): Promise<{
  data: TripGuardianWithDetails | null;
  error: TripGuardianServiceError | null;
}> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: { error: 'Not authenticated' } };
    }

    // Verify this is a request for the current user
    const { data: existing, error: existingError } = await supabase
      .from('trip_guardians')
      .select('*, trip:trips!inner(user_id, status)')
      .eq('id', tripGuardianId)
      .eq('guardian_id', user.id)
      .eq('status', 'requested')
      .single();

    if (existingError || !existing) {
      return { data: null, error: { error: 'Request not found or already processed' } };
    }

    // Update status to declined
    const { data, error } = await supabase
      .from('trip_guardians')
      .update({
        status: 'declined',
        responded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', tripGuardianId)
      .select()
      .single();

    if (error) {
      return { data: null, error: { error: error.message, details: error } };
    }

    // Send notification to trip owner (non-blocking)
    notifyTripOwnerOfResponse(existing.trip.user_id, user.id, 'declined').catch(console.error);

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: { error: 'Failed to decline request', details: err },
    };
  }
}

/**
 * Subscribe to realtime updates for trip guardians of a specific trip
 * Used by trip owner to see when guardians accept/decline
 */
export function subscribeToTripGuardians(
  tripId: number,
  onUpdate: (payload: any) => void
): RealtimeChannel {
  const channel = supabase
    .channel(`trip_guardians:${tripId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'trip_guardians',
        filter: `trip_id=eq.${tripId}`,
      },
      (payload) => {
        console.log('[TripGuardianService] Realtime update:', payload);
        onUpdate(payload);
      }
    )
    .subscribe();

  return channel;
}

/**
 * Subscribe to realtime updates for trip guardian requests (as guardian)
 * Used to receive new trip requests in real-time
 */
export function subscribeToTripGuardianRequests(
  guardianId: string,
  onUpdate: (payload: any) => void
): RealtimeChannel {
  const channel = supabase
    .channel(`trip_guardian_requests:${guardianId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'trip_guardians',
        filter: `guardian_id=eq.${guardianId}`,
      },
      (payload) => {
        console.log('[TripGuardianService] New request:', payload);
        onUpdate(payload);
      }
    )
    .subscribe();

  return channel;
}

/**
 * Unsubscribe from a realtime channel
 */
export async function unsubscribeFromChannel(channel: RealtimeChannel): Promise<void> {
  await supabase.removeChannel(channel);
}

/**
 * Helper: Notify trip owner when a guardian responds
 */
async function notifyTripOwnerOfResponse(
  tripOwnerId: string,
  guardianId: string,
  response: 'accepted' | 'declined'
): Promise<void> {
  try {
    // Get guardian profile
    const { data: guardianProfile } = await supabase
      .from('profiles')
      .select('username, full_name')
      .eq('id', guardianId)
      .single();

    if (!guardianProfile) return;

    const guardianName = guardianProfile.full_name || guardianProfile.username || 'Someone';

    // Import notification service dynamically to avoid circular deps
    const { getPushTokenForUser, sendPushNotification } = await import('@/services/notification-service');

    const pushToken = await getPushTokenForUser(tripOwnerId);
    if (!pushToken) return;

    if (response === 'accepted') {
      await sendPushNotification(
        pushToken,
        '👀 Guardian is watching!',
        `${guardianName} is now watching your trip`,
        { type: 'trip_guardian_accepted', guardianId }
      );
    } else {
      await sendPushNotification(
        pushToken,
        'Guardian declined',
        `${guardianName} can't watch your trip right now`,
        { type: 'trip_guardian_declined', guardianId }
      );
    }
  } catch (error) {
    console.error('[TripGuardianService] Error notifying trip owner:', error);
  }
}

/**
 * Get trips where current user is a guardian (for Trips tab)
 * Includes trips with any status (requested, accepted, declined)
 */
export async function getTripsAsGuardian(): Promise<{
  data: TripGuardianWithDetails[] | null;
  error: TripGuardianServiceError | null;
}> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: { error: 'Not authenticated' } };
    }

    // Get all trip_guardians where current user is the guardian
    const { data, error } = await supabase
      .from('trip_guardians')
      .select(`
        *,
        trip:trips!inner (
          id,
          user_id,
          destination_address,
          origin_address,
          started_at,
          checkin_interval_minutes,
          mode,
          status
        )
      `)
      .eq('guardian_id', user.id)
      .in('status', ['requested', 'accepted']) // Not declined
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error: { error: error.message, details: error } };
    }

    // Filter only active/escalated trips
    const activeTrips = (data || []).filter(
      (tg: any) => tg.trip && ['active', 'escalated'].includes(tg.trip.status)
    );

    // Fetch trip owner profiles
    const tripOwnerIds = [...new Set(activeTrips.map((tg: any) => tg.trip.user_id))];
    
    let profilesMap: Record<string, any> = {};
    if (tripOwnerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', tripOwnerIds);
      
      if (profiles) {
        profilesMap = profiles.reduce((acc, p) => {
          acc[p.id] = p;
          return acc;
        }, {} as Record<string, any>);
      }
    }

    // Map to include trip_owner
    const result = activeTrips.map((tg: any) => ({
      ...tg,
      trip_owner: profilesMap[tg.trip.user_id] || null,
    }));

    return { data: result, error: null };
  } catch (err) {
    return {
      data: null,
      error: { error: 'Failed to get trips as guardian', details: err },
    };
  }
}

/**
 * Get escalated trips where current user is a guardian
 * These are trips where the user being guarded has missed check-ins or pressed emergency button
 */
export async function getEscalatedGuardianTrips(): Promise<{
  data: TripGuardianWithDetails[] | null;
  error: TripGuardianServiceError | null;
}> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: { error: 'Not authenticated' } };
    }

    // Get trip_guardians where current user is the guardian
    // Only include trips with 'escalated' status
    const { data, error } = await supabase
      .from('trip_guardians')
      .select(`
        *,
        trip:trips!inner (
          id,
          user_id,
          destination_address,
          origin_address,
          started_at,
          checkin_interval_minutes,
          mode,
          status,
          missed_checkins_count,
          last_known_latitude,
          last_known_longitude,
          last_known_location_at
        )
      `)
      .eq('guardian_id', user.id)
      .in('status', ['accepted', 'requested']) // Guardian must have accepted or be requested
      .eq('trip.status', 'escalated') // Only escalated trips
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error: { error: error.message, details: error } };
    }

    // Fetch trip owner profiles
    const tripOwnerIds = [...new Set((data || []).map((tg: any) => tg.trip.user_id))];
    
    let profilesMap: Record<string, any> = {};
    if (tripOwnerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', tripOwnerIds);
      
      if (profiles) {
        profilesMap = profiles.reduce((acc, p) => {
          acc[p.id] = p;
          return acc;
        }, {} as Record<string, any>);
      }
    }

    // Map to include trip_owner
    const result = (data || []).map((tg: any) => ({
      ...tg,
      trip_owner: profilesMap[tg.trip.user_id] || null,
    }));

    return { data: result, error: null };
  } catch (err) {
    return {
      data: null,
      error: { error: 'Failed to get escalated guardian trips', details: err },
    };
  }
}

