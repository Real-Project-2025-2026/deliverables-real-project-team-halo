import { supabase } from '@/lib/supabase';

export interface UsernameValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates username format (client-side)
 * Rules: 3-20 characters, alphanumeric + underscore only
 */
export function validateUsernameFormat(username: string): UsernameValidationResult {
  if (!username || username.trim().length === 0) {
    return { isValid: false, error: 'Username is required' };
  }

  const trimmed = username.trim();

  if (trimmed.length < 3) {
    return { isValid: false, error: 'Username must be at least 3 characters' };
  }

  if (trimmed.length > 20) {
    return { isValid: false, error: 'Username must be at most 20 characters' };
  }

  // Only alphanumeric and underscore
  const usernameRegex = /^[a-zA-Z0-9_]+$/;
  if (!usernameRegex.test(trimmed)) {
    return {
      isValid: false,
      error: 'Username can only contain letters, numbers, and underscores',
    };
  }

  return { isValid: true };
}

/**
 * Checks if username is available (server-side)
 */
export async function checkUsernameAvailability(
  username: string
): Promise<{ available: boolean; error?: string }> {
  try {
    const validation = validateUsernameFormat(username);
    if (!validation.isValid) {
      return { available: false, error: validation.error };
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', username.trim())
      .limit(1)
      .single();

    if (error) {
      // If no rows found, username is available
      if (error.code === 'PGRST116') {
        return { available: true };
      }
      throw error;
    }

    // Username already exists
    return { available: false, error: 'Username is already taken' };
  } catch (error: any) {
    console.error('Error checking username availability:', error);
    return {
      available: false,
      error: error.message || 'Failed to check username availability',
    };
  }
}

/**
 * Updates user's username
 */
export async function updateUsername(
  userId: string,
  username: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const validation = validateUsernameFormat(username);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    const availability = await checkUsernameAvailability(username);
    if (!availability.available) {
      return { success: false, error: availability.error };
    }

    // First, check if profile exists, if not create it
    const { data: existingProfile, error: checkError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is fine - we'll create it
      console.error('[Username Service] Error checking profile:', checkError);
      throw checkError;
    }

    // Verify session before attempting update
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('[Username Service] Session check:', {
      hasSession: !!session,
      sessionUserId: session?.user?.id,
      userId,
      match: session?.user?.id === userId,
      sessionError,
    });

    if (!session || session.user.id !== userId) {
      const errorMsg = 'Session verification failed. Please try again.';
      console.error('[Username Service]', errorMsg);
      return { success: false, error: errorMsg };
    }

    // Use RPC function to safely upsert username
    // This bypasses RLS issues and handles profile creation automatically
    console.log('[Username Service] Attempting to upsert username via RPC');
    console.log('[Username Service] User ID:', userId);
    console.log('[Username Service] Username:', username.trim().toLowerCase());
    
    const { data: profileData, error: rpcError } = await supabase.rpc('upsert_profile', {
      p_user_id: userId,
      p_username: username.trim().toLowerCase(),
      p_full_name: null, // Don't update full_name
    });
    
    console.log('[Username Service] RPC result:', {
      data: profileData,
      error: rpcError ? {
        message: rpcError.message,
        code: rpcError.code,
        details: rpcError.details,
        hint: rpcError.hint,
      } : null,
    });
    
    if (rpcError) {
      // Check for unique constraint violation (username already taken)
      if (rpcError.code === '23505') {
        return { success: false, error: 'Username is already taken' };
      }
      console.error('[Username Service] ❌ Error saving username via RPC:', rpcError);
      throw rpcError;
    }
    
    if (profileData) {
      console.log('[Username Service] ✅ Username saved successfully via RPC!');
      return { success: true };
    } else {
      console.error('[Username Service] ❌ RPC returned no data');
      return { success: false, error: 'Failed to save username' };
    }
  } catch (error: any) {
    console.error('Error updating username:', error);
    return {
      success: false,
      error: error.message || 'Failed to update username',
    };
  }
}

