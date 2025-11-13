/*
 * Migration: Initial Halo App Schema
 * Created: 2025-11-07
 * Description: Creates the complete database schema for the Halo safety app MVP
 * 
 * Tables:
 * - profiles: Extended user profile information
 * - emergency_contacts: Trusted contacts for emergency notifications
 * - trips: User safety trips with tracking and check-in configuration
 * - checkins: Periodic check-in responses during trips
 * - nearby_presences: Real-time location presence for SafeTogether feature
 * - events: Audit log for system events and user actions
 * 
 * Features:
 * - Row Level Security (RLS) enabled on all tables
 * - Auto-updating timestamps via triggers
 * - Auto-deletion of old data (30 days) via triggers
 * - Performance indexes for common queries
 * - Storage bucket for profile avatars
 */

-- =====================================================
-- EXTENSIONS
-- =====================================================

-- Enable PostGIS for location-based queries (nearby users)
create extension if not exists postgis;

-- Enable pg_cron for scheduled cleanup tasks
create extension if not exists pg_cron;

-- =====================================================
-- ENUMS
-- =====================================================

-- Trip safety mode determines location tracking behavior
create type public.trip_mode as enum (
  'silent',      -- No location tracking, only check-ins
  'interval',    -- Location shared only at check-in intervals
  'continuous'   -- Continuous background location tracking
);
comment on type public.trip_mode is 'Defines the location tracking behavior during a trip';

-- Trip lifecycle status
create type public.trip_status as enum (
  'active',      -- Trip is currently ongoing
  'completed',   -- User reached destination safely
  'escalated',   -- Emergency escalation triggered
  'cancelled'    -- User cancelled the trip
);
comment on type public.trip_status is 'Current status of a safety trip';

-- Check-in response status
create type public.checkin_status as enum (
  'pending',         -- Check-in sent, awaiting response
  'responded_ok',    -- User responded "I'm okay"
  'responded_help',  -- User requested help
  'missed'          -- User did not respond in time
);
comment on type public.checkin_status is 'Status of a check-in request';

-- Event types for audit logging
create type public.event_type as enum (
  'trip_started',
  'trip_completed',
  'trip_cancelled',
  'trip_escalated',
  'checkin_sent',
  'checkin_responded',
  'checkin_missed',
  'emergency_contact_notified',
  'safetogether_paired',
  'safetogether_unpaired',
  'location_shared',
  'panic_button_pressed'
);
comment on type public.event_type is 'Types of system events for audit logging';

-- =====================================================
-- TABLES
-- =====================================================

-- -----------------------------------------------------
-- profiles: Extended user profile
-- -----------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone_number text,
  avatar_url text,
  -- Settings
  default_checkin_interval_minutes integer default 5 check (default_checkin_interval_minutes between 3 and 10),
  default_trip_mode public.trip_mode default 'interval',
  safetogether_enabled boolean default true,
  panic_button_enabled boolean default true,
  -- Privacy settings
  share_approximate_location boolean default true,
  data_retention_days integer default 30 check (data_retention_days between 7 and 90),
  -- Timestamps
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
comment on table public.profiles is 'Extended user profile information with safety preferences and settings';

create index profiles_phone_number_idx on public.profiles(phone_number);

-- -----------------------------------------------------
-- emergency_contacts: Trusted contacts
-- -----------------------------------------------------
create table public.emergency_contacts (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  phone_number text not null,
  email text,
  relationship text,
  priority integer default 1 check (priority >= 1),
  is_active boolean default true,
  -- Notification preferences
  notify_on_trip_start boolean default false,
  notify_on_trip_end boolean default false,
  notify_on_escalation boolean default true,
  notify_on_safetogether boolean default true,
  -- Timestamps
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
comment on table public.emergency_contacts is 'Trusted emergency contacts for safety notifications';

create index emergency_contacts_user_id_idx on public.emergency_contacts(user_id);
create index emergency_contacts_user_active_idx on public.emergency_contacts(user_id, is_active) where is_active = true;

-- -----------------------------------------------------
-- trips: Safety trips with check-in configuration
-- -----------------------------------------------------
create table public.trips (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  -- Trip configuration
  mode public.trip_mode not null default 'interval',
  status public.trip_status not null default 'active',
  checkin_interval_minutes integer not null default 5 check (checkin_interval_minutes between 3 and 10),
  -- Location data
  origin_latitude double precision,
  origin_longitude double precision,
  origin_address text,
  destination_latitude double precision,
  destination_longitude double precision,
  destination_address text,
  last_known_latitude double precision,
  last_known_longitude double precision,
  last_location_update_at timestamptz,
  -- SafeTogether
  safetogether_enabled boolean default false,
  paired_with_user_id uuid references public.profiles(id) on delete set null,
  paired_at timestamptz,
  -- Escalation tracking
  missed_checkins_count integer default 0,
  escalated_at timestamptz,
  escalation_notified boolean default false,
  -- Timestamps
  started_at timestamptz default now() not null,
  completed_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
comment on table public.trips is 'User safety trips with tracking, check-ins, and escalation logic';

-- Indexes for performance
create index trips_user_id_idx on public.trips(user_id);
create index trips_status_idx on public.trips(status);
create index trips_user_status_idx on public.trips(user_id, status);
create index trips_active_idx on public.trips(status, started_at) where status = 'active';
create index trips_paired_user_idx on public.trips(paired_with_user_id) where paired_with_user_id is not null;

-- -----------------------------------------------------
-- checkins: Periodic check-in events
-- -----------------------------------------------------
create table public.checkins (
  id bigint generated always as identity primary key,
  trip_id bigint references public.trips(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  status public.checkin_status not null default 'pending',
  -- Location at check-in time
  latitude double precision,
  longitude double precision,
  -- Timing
  sent_at timestamptz default now() not null,
  responded_at timestamptz,
  due_at timestamptz not null,
  -- Response tracking
  response_message text,
  vibration_sent boolean default false,
  -- Timestamps
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
comment on table public.checkins is 'Check-in requests and responses during active trips';

create index checkins_trip_id_idx on public.checkins(trip_id);
create index checkins_user_id_idx on public.checkins(user_id);
create index checkins_status_idx on public.checkins(status);
create index checkins_due_at_idx on public.checkins(due_at) where status = 'pending';

-- -----------------------------------------------------
-- nearby_presences: Real-time presence for SafeTogether
-- -----------------------------------------------------
create table public.nearby_presences (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  trip_id bigint references public.trips(id) on delete cascade not null,
  -- Location (using PostGIS geography type for accurate distance calculations)
  location geography(point, 4326) not null,
  latitude double precision not null,
  longitude double precision not null,
  -- Visibility settings
  is_visible boolean default true,
  visible_radius_meters integer default 500 check (visible_radius_meters between 100 and 1000),
  -- Destination for route matching
  destination_latitude double precision,
  destination_longitude double precision,
  -- Timestamps
  last_seen_at timestamptz default now() not null,
  expires_at timestamptz not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  -- Constraint: One active presence per user
  constraint unique_active_presence_per_user unique(user_id)
);
comment on table public.nearby_presences is 'Real-time location presence for SafeTogether feature (auto-expires)';

-- Spatial index for nearby user queries (critical for performance)
create index nearby_presences_location_idx on public.nearby_presences using gist(location);
create index nearby_presences_user_id_idx on public.nearby_presences(user_id);
create index nearby_presences_trip_id_idx on public.nearby_presences(trip_id);
create index nearby_presences_visible_idx on public.nearby_presences(is_visible, expires_at) where is_visible = true;

-- -----------------------------------------------------
-- events: Audit log for system events
-- -----------------------------------------------------
create table public.events (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  trip_id bigint references public.trips(id) on delete cascade,
  event_type public.event_type not null,
  -- Event details
  metadata jsonb default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  -- Timestamps
  created_at timestamptz default now() not null
);
comment on table public.events is 'Audit log of important system events and user actions';

create index events_user_id_idx on public.events(user_id);
create index events_trip_id_idx on public.events(trip_id);
create index events_event_type_idx on public.events(event_type);
create index events_created_at_idx on public.events(created_at desc);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- -----------------------------------------------------
-- Function: update_updated_at_column
-- Purpose: Automatically update updated_at timestamp
-- -----------------------------------------------------
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
comment on function public.update_updated_at_column is 'Trigger function to automatically update updated_at timestamps';

-- -----------------------------------------------------
-- Function: handle_new_user
-- Purpose: Automatically create profile when user signs up
-- -----------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone_number)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.phone
  );
  return new;
end;
$$;
comment on function public.handle_new_user is 'Automatically creates a profile entry when a new user signs up via Supabase Auth';

-- -----------------------------------------------------
-- Function: cleanup_old_data
-- Purpose: Delete data older than retention period
-- -----------------------------------------------------
create or replace function public.cleanup_old_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  retention_cutoff timestamptz;
begin
  -- Use default 30 days retention for cleanup
  retention_cutoff := now() - interval '30 days';
  
  -- Delete old completed/cancelled trips and their related data
  delete from public.trips
  where status in ('completed', 'cancelled')
    and completed_at < retention_cutoff;
  
  -- Delete old events (keeps escalated events longer)
  delete from public.events
  where created_at < retention_cutoff
    and event_type not in ('trip_escalated', 'panic_button_pressed');
  
  -- Delete expired nearby presences
  delete from public.nearby_presences
  where expires_at < now();
end;
$$;
comment on function public.cleanup_old_data is 'Scheduled cleanup function that deletes data older than retention period';

-- -----------------------------------------------------
-- Function: find_nearby_users
-- Purpose: Find users within specified radius for SafeTogether
-- -----------------------------------------------------
create or replace function public.find_nearby_users(
  current_user_lat double precision,
  current_user_lng double precision,
  radius_meters integer default 500
)
returns table (
  user_id uuid,
  trip_id bigint,
  distance_meters double precision,
  latitude double precision,
  longitude double precision,
  destination_latitude double precision,
  destination_longitude double precision
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return query
  select
    nearby_presences.user_id,
    nearby_presences.trip_id,
    st_distance(
      nearby_presences.location,
      st_makepoint(current_user_lng, current_user_lat)::geography
    ) as distance_meters,
    nearby_presences.latitude,
    nearby_presences.longitude,
    nearby_presences.destination_latitude,
    nearby_presences.destination_longitude
  from public.nearby_presences
  where
    nearby_presences.is_visible = true
    and nearby_presences.expires_at > now()
    and nearby_presences.user_id != auth.uid()
    and st_dwithin(
      nearby_presences.location,
      st_makepoint(current_user_lng, current_user_lat)::geography,
      radius_meters
    )
  order by distance_meters asc
  limit 20;
end;
$$;
comment on function public.find_nearby_users is 'Finds nearby Halo users within specified radius for SafeTogether feature';

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamps
create trigger update_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.update_updated_at_column();

create trigger update_emergency_contacts_updated_at
  before update on public.emergency_contacts
  for each row
  execute function public.update_updated_at_column();

create trigger update_trips_updated_at
  before update on public.trips
  for each row
  execute function public.update_updated_at_column();

create trigger update_checkins_updated_at
  before update on public.checkins
  for each row
  execute function public.update_updated_at_column();

create trigger update_nearby_presences_updated_at
  before update on public.nearby_presences
  for each row
  execute function public.update_updated_at_column();

-- Auto-create profile on user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.trips enable row level security;
alter table public.checkins enable row level security;
alter table public.nearby_presences enable row level security;
alter table public.events enable row level security;

-- -----------------------------------------------------
-- RLS Policies: profiles
-- -----------------------------------------------------

-- Users can view their own profile
create policy "Users can view own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- Users can update their own profile
create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Users can insert their own profile (handled by trigger, but allow manual insert)
create policy "Users can insert own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

-- Public can view minimal profile info of nearby users (for SafeTogether)
create policy "Public can view minimal profile info for SafeTogether"
  on public.profiles
  for select
  to authenticated
  using (
    id in (
      select user_id
      from public.nearby_presences
      where is_visible = true
        and expires_at > now()
    )
  );

-- -----------------------------------------------------
-- RLS Policies: emergency_contacts
-- -----------------------------------------------------

-- Users can view their own emergency contacts
create policy "Users can view own emergency contacts"
  on public.emergency_contacts
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Users can insert their own emergency contacts
create policy "Users can insert own emergency contacts"
  on public.emergency_contacts
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Users can update their own emergency contacts
create policy "Users can update own emergency contacts"
  on public.emergency_contacts
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can delete their own emergency contacts
create policy "Users can delete own emergency contacts"
  on public.emergency_contacts
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- -----------------------------------------------------
-- RLS Policies: trips
-- -----------------------------------------------------

-- Users can view their own trips
create policy "Users can view own trips"
  on public.trips
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Users can insert their own trips
create policy "Users can insert own trips"
  on public.trips
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Users can update their own trips
create policy "Users can update own trips"
  on public.trips
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can view trips they are paired with (SafeTogether)
create policy "Users can view paired trips"
  on public.trips
  for select
  to authenticated
  using (auth.uid() = paired_with_user_id);

-- -----------------------------------------------------
-- RLS Policies: checkins
-- -----------------------------------------------------

-- Users can view their own checkins
create policy "Users can view own checkins"
  on public.checkins
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Users can insert their own checkins
create policy "Users can insert own checkins"
  on public.checkins
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Users can update their own checkins
create policy "Users can update own checkins"
  on public.checkins
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- -----------------------------------------------------
-- RLS Policies: nearby_presences
-- -----------------------------------------------------

-- Users can view their own presence
create policy "Users can view own presence"
  on public.nearby_presences
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Users can view visible nearby presences
create policy "Users can view nearby presences"
  on public.nearby_presences
  for select
  to authenticated
  using (
    is_visible = true
    and expires_at > now()
  );

-- Users can insert their own presence
create policy "Users can insert own presence"
  on public.nearby_presences
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Users can update their own presence
create policy "Users can update own presence"
  on public.nearby_presences
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can delete their own presence
create policy "Users can delete own presence"
  on public.nearby_presences
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- -----------------------------------------------------
-- RLS Policies: events
-- -----------------------------------------------------

-- Users can view their own events
create policy "Users can view own events"
  on public.events
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Users can insert their own events
create policy "Users can insert own events"
  on public.events
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- =====================================================
-- STORAGE BUCKETS
-- =====================================================

-- Create storage bucket for profile avatars
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880, -- 5MB limit
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Storage policies for avatars bucket
create policy "Users can view all avatars"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'avatars');

create policy "Users can upload own avatar"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update own avatar"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete own avatar"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- =====================================================
-- SCHEDULED JOBS (pg_cron)
-- =====================================================

-- Schedule daily cleanup at 3 AM UTC
select cron.schedule(
  'cleanup-old-data',
  '0 3 * * *', -- Every day at 3 AM
  'select public.cleanup_old_data();'
);

-- =====================================================
-- INITIAL DATA / SEED (Optional)
-- =====================================================

-- No initial seed data required for MVP

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

