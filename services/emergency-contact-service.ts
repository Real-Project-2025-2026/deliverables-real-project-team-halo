import { supabase } from '@/lib/supabase';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/supabase';

export type EmergencyContact = Tables<'emergency_contacts'>;

export interface EmergencyContactServiceError {
  error: string;
  details?: unknown;
}

export interface CreateEmergencyContactParams {
  name: string;
  phoneNumber: string;
  email?: string;
  relationship?: string;
  priority?: number;
  notifyOnTripStart?: boolean;
  notifyOnTripEnd?: boolean;
  notifyOnEscalation?: boolean;
  notifyOnSafetogether?: boolean;
}

export interface UpdateEmergencyContactParams {
  name?: string;
  phoneNumber?: string;
  email?: string;
  relationship?: string;
  priority?: number;
  isActive?: boolean;
  notifyOnTripStart?: boolean;
  notifyOnTripEnd?: boolean;
  notifyOnEscalation?: boolean;
  notifyOnSafetogether?: boolean;
}

/**
 * Get all emergency contacts for the current user
 */
export async function getEmergencyContacts(): Promise<{
  data: EmergencyContact[] | null;
  error: EmergencyContactServiceError | null;
}> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return { data: null, error: { error: 'Not authenticated' } };
    }

    const { data, error } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('user_id', session.user.id)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error: { error: error.message, details: error } };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: { error: 'Failed to fetch emergency contacts', details: err },
    };
  }
}

/**
 * Get a single emergency contact by ID
 */
export async function getEmergencyContact(
  contactId: number
): Promise<{
  data: EmergencyContact | null;
  error: EmergencyContactServiceError | null;
}> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return { data: null, error: { error: 'Not authenticated' } };
    }

    const { data, error } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('id', contactId)
      .eq('user_id', session.user.id)
      .single();

    if (error) {
      return { data: null, error: { error: error.message, details: error } };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: { error: 'Failed to fetch emergency contact', details: err },
    };
  }
}

/**
 * Create a new emergency contact
 */
export async function createEmergencyContact(
  params: CreateEmergencyContactParams
): Promise<{
  data: EmergencyContact | null;
  error: EmergencyContactServiceError | null;
}> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return { data: null, error: { error: 'Not authenticated' } };
    }

    if (!params.name || !params.phoneNumber) {
      return {
        data: null,
        error: { error: 'Name and phone number are required' },
      };
    }

    const contactData: TablesInsert<'emergency_contacts'> = {
      user_id: session.user.id,
      name: params.name.trim(),
      phone_number: params.phoneNumber.trim(),
      email: params.email?.trim() || null,
      relationship: params.relationship?.trim() || null,
      priority: params.priority || 1,
      is_active: true,
      notify_on_trip_start: params.notifyOnTripStart ?? false,
      notify_on_trip_end: params.notifyOnTripEnd ?? false,
      notify_on_escalation: params.notifyOnEscalation ?? true,
      notify_on_safetogether: params.notifyOnSafetogether ?? true,
    };

    const { data, error } = await supabase
      .from('emergency_contacts')
      .insert(contactData)
      .select()
      .single();

    if (error) {
      return { data: null, error: { error: error.message, details: error } };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: { error: 'Failed to create emergency contact', details: err },
    };
  }
}

/**
 * Update an emergency contact
 */
export async function updateEmergencyContact(
  contactId: number,
  params: UpdateEmergencyContactParams
): Promise<{
  data: EmergencyContact | null;
  error: EmergencyContactServiceError | null;
}> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return { data: null, error: { error: 'Not authenticated' } };
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from('emergency_contacts')
      .select('id')
      .eq('id', contactId)
      .eq('user_id', session.user.id)
      .single();

    if (!existing) {
      return {
        data: null,
        error: { error: 'Emergency contact not found' },
      };
    }

    const updateData: TablesUpdate<'emergency_contacts'> = {
      updated_at: new Date().toISOString(),
    };

    if (params.name !== undefined) updateData.name = params.name.trim();
    if (params.phoneNumber !== undefined)
      updateData.phone_number = params.phoneNumber.trim();
    if (params.email !== undefined)
      updateData.email = params.email?.trim() || null;
    if (params.relationship !== undefined)
      updateData.relationship = params.relationship?.trim() || null;
    if (params.priority !== undefined) updateData.priority = params.priority;
    if (params.isActive !== undefined) updateData.is_active = params.isActive;
    if (params.notifyOnTripStart !== undefined)
      updateData.notify_on_trip_start = params.notifyOnTripStart;
    if (params.notifyOnTripEnd !== undefined)
      updateData.notify_on_trip_end = params.notifyOnTripEnd;
    if (params.notifyOnEscalation !== undefined)
      updateData.notify_on_escalation = params.notifyOnEscalation;
    if (params.notifyOnSafetogether !== undefined)
      updateData.notify_on_safetogether = params.notifyOnSafetogether;

    const { data, error } = await supabase
      .from('emergency_contacts')
      .update(updateData)
      .eq('id', contactId)
      .select()
      .single();

    if (error) {
      return { data: null, error: { error: error.message, details: error } };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: { error: 'Failed to update emergency contact', details: err },
    };
  }
}

/**
 * Delete an emergency contact
 */
export async function deleteEmergencyContact(
  contactId: number
): Promise<{ error: EmergencyContactServiceError | null }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return { error: { error: 'Not authenticated' } };
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from('emergency_contacts')
      .select('id')
      .eq('id', contactId)
      .eq('user_id', session.user.id)
      .single();

    if (!existing) {
      return { error: { error: 'Emergency contact not found' } };
    }

    const { error } = await supabase
      .from('emergency_contacts')
      .delete()
      .eq('id', contactId);

    if (error) {
      return { error: { error: error.message, details: error } };
    }

    return { error: null };
  } catch (err) {
    return {
      error: { error: 'Failed to delete emergency contact', details: err },
    };
  }
}

/**
 * Get active emergency contacts that should be notified on escalation
 */
export async function getActiveEmergencyContactsForEscalation(): Promise<{
  data: EmergencyContact[] | null;
  error: EmergencyContactServiceError | null;
}> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return { data: null, error: { error: 'Not authenticated' } };
    }

    const { data, error } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .eq('notify_on_escalation', true)
      .order('priority', { ascending: true });

    if (error) {
      return { data: null, error: { error: error.message, details: error } };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        error: 'Failed to fetch emergency contacts for escalation',
        details: err,
      },
    };
  }
}

/**
 * Get emergency contacts that should be notified on trip start
 */
export async function getEmergencyContactsForTripStart(): Promise<{
  data: EmergencyContact[] | null;
  error: EmergencyContactServiceError | null;
}> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return { data: null, error: { error: 'Not authenticated' } };
    }

    const { data, error } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .eq('notify_on_trip_start', true)
      .order('priority', { ascending: true });

    if (error) {
      return { data: null, error: { error: error.message, details: error } };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        error: 'Failed to fetch emergency contacts for trip start',
        details: err,
      },
    };
  }
}

/**
 * Get emergency contacts that should be notified on trip end
 */
export async function getEmergencyContactsForTripEnd(): Promise<{
  data: EmergencyContact[] | null;
  error: EmergencyContactServiceError | null;
}> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return { data: null, error: { error: 'Not authenticated' } };
    }

    const { data, error } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .eq('notify_on_trip_end', true)
      .order('priority', { ascending: true });

    if (error) {
      return { data: null, error: { error: error.message, details: error } };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        error: 'Failed to fetch emergency contacts for trip end',
        details: err,
      },
    };
  }
}

