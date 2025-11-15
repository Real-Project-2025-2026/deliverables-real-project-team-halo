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

    const { error } = await supabase
      .from('profiles')
      .update({
        username: username.trim().toLowerCase(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      // Check for unique constraint violation
      if (error.code === '23505') {
        return { success: false, error: 'Username is already taken' };
      }
      throw error;
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error updating username:', error);
    return {
      success: false,
      error: error.message || 'Failed to update username',
    };
  }
}

