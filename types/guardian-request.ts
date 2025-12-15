/**
 * Guardian Request Types
 * 
 * When a user plans a trip and selects guardians, those guardians
 * receive a request they can accept or decline.
 */

export type GuardianRequestStatus = 'requested' | 'accepted' | 'declined';

export interface GuardianRequest {
  id: string;
  trip_id: string;
  requester_id: string;
  guardian_id: string;
  status: GuardianRequestStatus;
  created_at: string;
  responded_at: string | null;
  // Populated fields
  requester?: {
    id: string;
    full_name: string;
    username: string;
    avatar_url: string | null;
  };
  trip?: {
    id: string;
    destination_address: string;
    origin_address: string;
    started_at: string | null;
    checkin_interval_minutes: number;
  };
}

export interface TripGuardian {
  id: string;
  trip_id: string;
  guardian_id: string;
  status: GuardianRequestStatus;
  created_at: string;
  responded_at: string | null;
  // Populated fields
  guardian?: {
    id: string;
    full_name: string;
    username: string;
    avatar_url: string | null;
  };
}

/**
 * Dummy data for testing Guardian Requests
 */
export const DUMMY_GUARDIAN_REQUESTS: GuardianRequest[] = [
  {
    id: 'req-1',
    trip_id: 'trip-123',
    requester_id: 'user-456',
    guardian_id: 'current-user',
    status: 'requested',
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 min ago
    responded_at: null,
    requester: {
      id: 'user-456',
      full_name: 'Sarah Mueller',
      username: 'sarah_m',
      avatar_url: null,
    },
    trip: {
      id: 'trip-123',
      destination_address: 'Alexanderplatz, Berlin',
      origin_address: 'Hauptbahnhof, Berlin',
      started_at: null,
      checkin_interval_minutes: 5,
    },
  },
];

/**
 * Dummy data for Trip Guardians (for Active Trip screen)
 */
export const DUMMY_TRIP_GUARDIANS: TripGuardian[] = [
  {
    id: 'tg-1',
    trip_id: 'active-trip',
    guardian_id: 'guardian-1',
    status: 'accepted',
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    responded_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    guardian: {
      id: 'guardian-1',
      full_name: 'Max Mustermann',
      username: 'max_m',
      avatar_url: null,
    },
  },
  {
    id: 'tg-2',
    trip_id: 'active-trip',
    guardian_id: 'guardian-2',
    status: 'requested',
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    responded_at: null,
    guardian: {
      id: 'guardian-2',
      full_name: 'Anna Schmidt',
      username: 'anna_s',
      avatar_url: null,
    },
  },
  {
    id: 'tg-3',
    trip_id: 'active-trip',
    guardian_id: 'guardian-3',
    status: 'declined',
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    responded_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    guardian: {
      id: 'guardian-3',
      full_name: 'Lisa Weber',
      username: 'lisa_w',
      avatar_url: null,
    },
  },
];

