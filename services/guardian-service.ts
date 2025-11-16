import { supabase } from '@/lib/supabase';
import type { Tables, TablesInsert } from '@/types/supabase';
import {
  getRecipientPushToken,
  sendGuardianRequestNotification,
  sendGuardianAcceptedNotification,
} from '@/services/notification-service';

export type Guardian = Tables<'guardians'>;
export type GuardianStatus = 'pending' | 'accepted' | 'blocked';

export interface GuardianWithProfile extends Guardian {
  requester_profile: {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
  recipient_profile: {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface PublicUserProfile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export interface GuardianServiceError {
  error: string;
  details?: unknown;
}

/**
 * Search for users by username or email (for Guardian requests)
 * Returns users with public profile info (id, username, full_name, avatar_url)
 */
export async function searchUsers(
  query: string
): Promise<{ data: PublicUserProfile[] | null; error: GuardianServiceError | null }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return { data: null, error: { error: 'Not authenticated' } };
    }

    if (!query || query.trim().length < 3) {
      return { data: [], error: null };
    }

    const searchQuery = query.trim();
    console.log('[Guardian Search] Searching for username or email:', searchQuery);

    // Use the database function to search by username or email
    const { data, error } = await supabase.rpc('search_users_by_username_or_email', {
      search_query: searchQuery,
    });

    if (error) {
      console.error('[Guardian Search] Error searching users:', error);
      return { data: null, error: { error: error.message, details: error } };
    }

    console.log('[Guardian Search] Found users:', data?.length || 0, data?.map(u => u.username || 'no-username') || []);
    return { data: data || [], error: null };
  } catch (err) {
    return {
      data: null,
      error: { error: 'Failed to search users', details: err },
    };
  }
}

/**
 * Send a Guardian request to another user
 */
export async function sendGuardianRequest(
  recipientId: string
): Promise<{ data: Guardian | null; error: GuardianServiceError | null }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return { data: null, error: { error: 'Not authenticated' } };
    }

    if (session.user.id === recipientId) {
      return { data: null, error: { error: 'Cannot send request to yourself' } };
    }

    // Check if recipient exists and has username
    const { data: recipient, error: recipientError } = await supabase
      .from('profiles')
      .select('id, username, full_name')
      .eq('id', recipientId)
      .not('username', 'is', null)
      .single();

    if (recipientError || !recipient) {
      return { data: null, error: { error: 'User not found' } };
    }

    // Get requester profile data for notification
    const { data: requester } = await supabase
      .from('profiles')
      .select('username, full_name')
      .eq('id', session.user.id)
      .single();

    // Check if relationship already exists
    const { data: existing, error: existingError } = await supabase
      .from('guardians')
      .select('id, status')
      .or(
        `and(requester_id.eq.${session.user.id},recipient_id.eq.${recipientId}),and(requester_id.eq.${recipientId},recipient_id.eq.${session.user.id})`
      )
      .maybeSingle();

    if (existingError && existingError.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is fine
      return { data: null, error: { error: existingError.message, details: existingError } };
    }

    if (existing) {
      if (existing.status === 'accepted') {
        return { data: null, error: { error: 'User is already your Guardian' } };
      }
      if (existing.status === 'pending') {
        // Check who sent the request
        const isRecipient = existing.requester_id === recipientId;
        if (isRecipient) {
          // They sent us a request, we should accept it instead
          return { data: null, error: { error: 'This user already sent you a request' } };
        }
        return { data: null, error: { error: 'Request already sent' } };
      }
      if (existing.status === 'blocked') {
        return { data: null, error: { error: 'Cannot send request to this user' } };
      }
    }

    // Create Guardian request
    const guardianData: TablesInsert<'guardians'> = {
      requester_id: session.user.id,
      recipient_id: recipientId,
      status: 'pending',
    };

    const { data, error } = await supabase
      .from('guardians')
      .insert(guardianData)
      .select()
      .single();

    if (error) {
      // Check for unique constraint violation
      if (error.code === '23505') {
        return { data: null, error: { error: 'Request already exists' } };
      }
      return { data: null, error: { error: error.message, details: error } };
    }

    // Send push notification to recipient (non-blocking)
    if (data) {
      const recipientPushToken = await getRecipientPushToken(recipientId);
      if (recipientPushToken && requester) {
        sendGuardianRequestNotification(
          recipientPushToken,
          requester.full_name || requester.username || 'Someone',
          requester.username || 'unknown'
        ).catch((err) => {
          console.error('Error sending Guardian request notification:', err);
          // Don't fail the request if notification fails
        });
      }
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: { error: 'Failed to send Guardian request', details: err },
    };
  }
}

/**
 * Accept a Guardian request (where current user is the recipient)
 */
export async function acceptGuardianRequest(
  requestId: number
): Promise<{ data: Guardian | null; error: GuardianServiceError | null }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return { data: null, error: { error: 'Not authenticated' } };
    }

    // Verify that this request is for the current user
    const { data: request, error: requestError } = await supabase
      .from('guardians')
      .select('*')
      .eq('id', requestId)
      .eq('recipient_id', session.user.id)
      .eq('status', 'pending')
      .single();

    if (requestError || !request) {
      return { data: null, error: { error: 'Request not found or already processed' } };
    }

    // Get requester and acceptor profile data for notification
    const [requesterResult, acceptorResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('username, full_name')
        .eq('id', request.requester_id)
        .single(),
      supabase
        .from('profiles')
        .select('username, full_name')
        .eq('id', session.user.id)
        .single(),
    ]);

    // Update status to accepted
    const { data, error } = await supabase
      .from('guardians')
      .update({
        status: 'accepted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .select()
      .single();

    if (error) {
      return { data: null, error: { error: error.message, details: error } };
    }

    // Send push notification to requester (non-blocking)
    if (data && requesterResult.data && acceptorResult.data) {
      const requesterPushToken = await getRecipientPushToken(request.requester_id);
      if (requesterPushToken) {
        sendGuardianAcceptedNotification(
          requesterPushToken,
          acceptorResult.data.full_name || acceptorResult.data.username || 'Someone',
          acceptorResult.data.username || 'unknown'
        ).catch((err) => {
          console.error('Error sending Guardian accepted notification:', err);
          // Don't fail the accept if notification fails
        });
      }
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: { error: 'Failed to accept Guardian request', details: err },
    };
  }
}

/**
 * Decline/Delete a Guardian request (where current user is the recipient)
 */
export async function declineGuardianRequest(
  requestId: number
): Promise<{ error: GuardianServiceError | null }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return { error: { error: 'Not authenticated' } };
    }

    // Verify that this request is for the current user
    const { data: request, error: requestError } = await supabase
      .from('guardians')
      .select('id')
      .eq('id', requestId)
      .eq('recipient_id', session.user.id)
      .eq('status', 'pending')
      .single();

    if (requestError || !request) {
      return { error: { error: 'Request not found or already processed' } };
    }

    // Delete the request (decline = delete)
    const { error } = await supabase.from('guardians').delete().eq('id', requestId);

    if (error) {
      return { error: { error: error.message, details: error } };
    }

    return { error: null };
  } catch (err) {
    return {
      error: { error: 'Failed to decline Guardian request', details: err },
    };
  }
}

/**
 * Get all accepted Guardians for the current user
 */
export async function getMyGuardians(): Promise<{
  data: GuardianWithProfile[] | null;
  error: GuardianServiceError | null;
}> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return { data: null, error: { error: 'Not authenticated' } };
    }

    // Get all accepted Guardian relationships where user is requester or recipient
    const { data, error } = await supabase
      .from('guardians')
      .select(
        `
        *,
        requester_profile:profiles!requester_id(id, username, full_name, avatar_url),
        recipient_profile:profiles!recipient_id(id, username, full_name, avatar_url)
      `
      )
      .eq('status', 'accepted')
      .or(`requester_id.eq.${session.user.id},recipient_id.eq.${session.user.id}`)
      .order('accepted_at', { ascending: false });

    if (error) {
      return { data: null, error: { error: error.message, details: error } };
    }

    return { data: data || [], error: null };
  } catch (err) {
    return {
      data: null,
      error: { error: 'Failed to get Guardians', details: err },
    };
  }
}

/**
 * Get pending Guardian requests (where current user is the recipient)
 */
export async function getPendingRequests(): Promise<{
  data: GuardianWithProfile[] | null;
  error: GuardianServiceError | null;
}> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return { data: null, error: { error: 'Not authenticated' } };
    }

    // Get pending requests where user is recipient
    const { data, error } = await supabase
      .from('guardians')
      .select(
        `
        *,
        requester_profile:profiles!requester_id(id, username, full_name, avatar_url),
        recipient_profile:profiles!recipient_id(id, username, full_name, avatar_url)
      `
      )
      .eq('recipient_id', session.user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error: { error: error.message, details: error } };
    }

    return { data: data || [], error: null };
  } catch (err) {
    return {
      data: null,
      error: { error: 'Failed to get pending requests', details: err },
    };
  }
}

/**
 * Get sent Guardian requests (where current user is the requester)
 */
export async function getSentRequests(): Promise<{
  data: GuardianWithProfile[] | null;
  error: GuardianServiceError | null;
}> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return { data: null, error: { error: 'Not authenticated' } };
    }

    // Get sent requests where user is requester
    const { data, error } = await supabase
      .from('guardians')
      .select(
        `
        *,
        requester_profile:profiles!requester_id(id, username, full_name, avatar_url),
        recipient_profile:profiles!recipient_id(id, username, full_name, avatar_url)
      `
      )
      .eq('requester_id', session.user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error: { error: error.message, details: error } };
    }

    return { data: data || [], error: null };
  } catch (err) {
    return {
      data: null,
      error: { error: 'Failed to get sent requests', details: err },
    };
  }
}

/**
 * Remove a Guardian (cancel request or remove accepted Guardian)
 */
export async function removeGuardian(
  guardianId: number
): Promise<{ error: GuardianServiceError | null }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return { error: { error: 'Not authenticated' } };
    }

    // Verify that this Guardian relationship involves the current user
    const { data: guardian, error: guardianError } = await supabase
      .from('guardians')
      .select('id')
      .eq('id', guardianId)
      .or(`requester_id.eq.${session.user.id},recipient_id.eq.${session.user.id}`)
      .single();

    if (guardianError || !guardian) {
      return { error: { error: 'Guardian relationship not found' } };
    }

    // Delete the Guardian relationship
    const { error } = await supabase.from('guardians').delete().eq('id', guardianId);

    if (error) {
      return { error: { error: error.message, details: error } };
    }

    return { error: null };
  } catch (err) {
    return {
      error: { error: 'Failed to remove Guardian', details: err },
    };
  }
}

/**
 * Get Guardian relationship status between current user and another user
 */
export async function getGuardianRelationship(
  otherUserId: string
): Promise<{ data: Guardian | null; error: GuardianServiceError | null }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return { data: null, error: { error: 'Not authenticated' } };
    }

    // Get relationship where either user is requester or recipient
    const { data, error } = await supabase
      .from('guardians')
      .select('*')
      .or(
        `and(requester_id.eq.${session.user.id},recipient_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},recipient_id.eq.${session.user.id})`
      )
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is fine
      return { data: null, error: { error: error.message, details: error } };
    }

    return { data: data || null, error: null };
  } catch (err) {
    return {
      data: null,
      error: { error: 'Failed to get Guardian relationship', details: err },
    };
  }
}

