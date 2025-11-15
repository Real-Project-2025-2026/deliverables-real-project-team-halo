import { supabase } from '@/lib/supabase';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/supabase';

export type Checkin = Tables<'checkins'>;
export type CheckinInsert = TablesInsert<'checkins'>;
export type CheckinUpdate = TablesUpdate<'checkins'>;
export type CheckinStatus = 'pending' | 'responded_ok' | 'responded_help' | 'missed';

export interface CheckinServiceError {
  error: string;
  details?: unknown;
}

/**
 * Create a new check-in for a trip
 */
export async function createCheckin(
  tripId: number,
  dueAt: Date,
  latitude?: number,
  longitude?: number
): Promise<{ data: Checkin | null; error: CheckinServiceError | null }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return { data: null, error: { error: 'Not authenticated' } };
    }

    const checkinData: CheckinInsert = {
      trip_id: tripId,
      user_id: session.user.id,
      due_at: dueAt.toISOString(),
      sent_at: new Date().toISOString(),
      status: 'pending',
      latitude: latitude || null,
      longitude: longitude || null,
      vibration_sent: false,
    };

    const { data, error } = await supabase
      .from('checkins')
      .insert(checkinData)
      .select()
      .single();

    if (error) {
      return { data: null, error: { error: error.message, details: error } };
    }

    // Log event
    await supabase.from('events').insert({
      user_id: session.user.id,
      trip_id: tripId,
      event_type: 'checkin_sent',
      metadata: {
        checkin_id: data.id,
        due_at: dueAt.toISOString(),
      },
    });

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: { error: 'Failed to create check-in', details: err },
    };
  }
}

/**
 * Get pending check-ins for a trip
 */
export async function getPendingCheckins(
  tripId: number
): Promise<{ data: Checkin[] | null; error: CheckinServiceError | null }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return { data: null, error: { error: 'Not authenticated' } };
    }

    const { data, error } = await supabase
      .from('checkins')
      .select('*')
      .eq('trip_id', tripId)
      .eq('user_id', session.user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error: { error: error.message, details: error } };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: { error: 'Failed to get pending check-ins', details: err },
    };
  }
}

/**
 * Respond to a check-in
 */
export async function respondToCheckin(
  checkinId: number,
  response: 'ok' | 'help',
  responseMessage?: string
): Promise<{ error: CheckinServiceError | null }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return { error: { error: 'Not authenticated' } };
    }

    // Get check-in to verify ownership
    const { data: checkin, error: fetchError } = await supabase
      .from('checkins')
      .select('trip_id, status')
      .eq('id', checkinId)
      .eq('user_id', session.user.id)
      .single();

    if (fetchError || !checkin) {
      return { error: { error: 'Check-in not found' } };
    }

    if (checkin.status !== 'pending') {
      return { error: { error: 'Check-in already responded to' } };
    }

    const status: CheckinStatus = response === 'ok' ? 'responded_ok' : 'responded_help';

    const { error } = await supabase
      .from('checkins')
      .update({
        status,
        responded_at: new Date().toISOString(),
        response_message: responseMessage || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', checkinId)
      .eq('user_id', session.user.id);

    if (error) {
      return { error: { error: error.message, details: error } };
    }

    // Log event
    await supabase.from('events').insert({
      user_id: session.user.id,
      trip_id: checkin.trip_id,
      event_type: 'checkin_responded',
      metadata: {
        checkin_id: checkinId,
        response,
        response_message: responseMessage,
      },
    });

    return { error: null };
  } catch (err) {
    return { error: { error: 'Failed to respond to check-in', details: err } };
  }
}

/**
 * Mark a check-in as missed
 */
export async function markCheckinMissed(
  checkinId: number
): Promise<{ error: CheckinServiceError | null }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return { error: { error: 'Not authenticated' } };
    }

    // Get check-in to verify ownership and get trip_id
    const { data: checkin, error: fetchError } = await supabase
      .from('checkins')
      .select('trip_id, status')
      .eq('id', checkinId)
      .eq('user_id', session.user.id)
      .single();

    if (fetchError || !checkin) {
      return { error: { error: 'Check-in not found' } };
    }

    if (checkin.status !== 'pending') {
      return { error: { error: 'Check-in already processed' } };
    }

    const { error } = await supabase
      .from('checkins')
      .update({
        status: 'missed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', checkinId)
      .eq('user_id', session.user.id);

    if (error) {
      return { error: { error: error.message, details: error } };
    }

    // Log event
    await supabase.from('events').insert({
      user_id: session.user.id,
      trip_id: checkin.trip_id,
      event_type: 'checkin_missed',
      metadata: {
        checkin_id: checkinId,
      },
    });

    // Increment missed check-ins count
    const { incrementMissedCheckins } = await import('./trip-service');
    await incrementMissedCheckins(checkin.trip_id);

    return { error: null };
  } catch (err) {
    return { error: { error: 'Failed to mark check-in as missed', details: err } };
  }
}

/**
 * Get check-in history for a trip
 */
export async function getCheckinHistory(
  tripId: number,
  limit: number = 20
): Promise<{ data: Checkin[] | null; error: CheckinServiceError | null }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return { data: null, error: { error: 'Not authenticated' } };
    }

    const { data, error } = await supabase
      .from('checkins')
      .select('*')
      .eq('trip_id', tripId)
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { data: null, error: { error: error.message, details: error } };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: { error: 'Failed to get check-in history', details: err },
    };
  }
}

/**
 * Mark vibration as sent for a check-in
 */
export async function markVibrationSent(
  checkinId: number
): Promise<{ error: CheckinServiceError | null }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return { error: { error: 'Not authenticated' } };
    }

    const { error } = await supabase
      .from('checkins')
      .update({
        vibration_sent: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', checkinId)
      .eq('user_id', session.user.id);

    if (error) {
      return { error: { error: error.message, details: error } };
    }

    return { error: null };
  } catch (err) {
    return { error: { error: 'Failed to mark vibration as sent', details: err } };
  }
}

/**
 * Get the latest check-in for a trip
 */
export async function getLatestCheckin(
  tripId: number
): Promise<{ data: Checkin | null; error: CheckinServiceError | null }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return { data: null, error: { error: 'Not authenticated' } };
    }

    const { data, error } = await supabase
      .from('checkins')
      .select('*')
      .eq('trip_id', tripId)
      .eq('user_id', session.user.id)
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
      error: { error: 'Failed to get latest check-in', details: err },
    };
  }
}


