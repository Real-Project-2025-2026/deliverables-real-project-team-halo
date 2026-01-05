-- Migration: Add RLS Policy for trips table to allow Guardians to view trips
-- Description: Allows Guardians to see trips where they are assigned as a guardian
-- This fixes the issue where Guardians cannot see trip details in trip_guardians queries
-- Uses SECURITY DEFINER function to avoid infinite recursion

-- Drop existing policy if it exists
drop policy if exists "Guardians can view trips they are guarding" on trips;

-- Drop existing function if it exists
drop function if exists is_guardian_for_trip(bigint, uuid);

-- Create a function that checks if user is a guardian for a trip
-- SECURITY DEFINER allows it to bypass RLS on trip_guardians to avoid recursion
create or replace function is_guardian_for_trip(trip_id_param bigint, user_id_param uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from trip_guardians
    where trip_guardians.trip_id = trip_id_param
    and trip_guardians.guardian_id = user_id_param
  );
$$;

-- Policy: Guardians can view trips where they are assigned as a guardian
-- Uses the function to avoid recursion
create policy "Guardians can view trips they are guarding"
on trips
for select
using (
  is_guardian_for_trip(trips.id, auth.uid())
);

-- Verify RLS is enabled on trips
alter table trips enable row level security;


