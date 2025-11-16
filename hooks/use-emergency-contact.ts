import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/providers/auth-provider';
import * as emergencyContactService from '@/services/emergency-contact-service';
import type {
  EmergencyContact,
  CreateEmergencyContactParams,
  UpdateEmergencyContactParams,
} from '@/services/emergency-contact-service';

interface UseEmergencyContactReturn {
  contacts: EmergencyContact[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createContact: (params: CreateEmergencyContactParams) => Promise<boolean>;
  updateContact: (
    contactId: number,
    params: UpdateEmergencyContactParams
  ) => Promise<boolean>;
  deleteContact: (contactId: number) => Promise<boolean>;
}

export function useEmergencyContact(): UseEmergencyContactReturn {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setContacts([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } =
        await emergencyContactService.getEmergencyContacts();

      if (fetchError) {
        throw new Error(fetchError.error);
      }

      setContacts(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load emergency contacts');
      console.error('Error loading emergency contacts:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createContact = useCallback(
    async (params: CreateEmergencyContactParams): Promise<boolean> => {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error: createError } =
          await emergencyContactService.createEmergencyContact(params);

        if (createError) {
          throw new Error(createError.error);
        }

        if (data) {
          await refresh();
        }

        return !!data;
      } catch (err: any) {
        setError(err.message || 'Failed to create emergency contact');
        console.error('Error creating emergency contact:', err);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [refresh]
  );

  const updateContact = useCallback(
    async (
      contactId: number,
      params: UpdateEmergencyContactParams
    ): Promise<boolean> => {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error: updateError } =
          await emergencyContactService.updateEmergencyContact(
            contactId,
            params
          );

        if (updateError) {
          throw new Error(updateError.error);
        }

        if (data) {
          await refresh();
        }

        return !!data;
      } catch (err: any) {
        setError(err.message || 'Failed to update emergency contact');
        console.error('Error updating emergency contact:', err);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [refresh]
  );

  const deleteContact = useCallback(
    async (contactId: number): Promise<boolean> => {
      try {
        setIsLoading(true);
        setError(null);

        const { error: deleteError } =
          await emergencyContactService.deleteEmergencyContact(contactId);

        if (deleteError) {
          throw new Error(deleteError.error);
        }

        await refresh();
        return true;
      } catch (err: any) {
        setError(err.message || 'Failed to delete emergency contact');
        console.error('Error deleting emergency contact:', err);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [refresh]
  );

  return {
    contacts,
    isLoading,
    error,
    refresh,
    createContact,
    updateContact,
    deleteContact,
  };
}

