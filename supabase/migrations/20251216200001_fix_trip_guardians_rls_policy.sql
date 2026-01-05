-- Migration: Fix RLS Policy for trip_guardians
-- Description: Ensures Guardians can view their own trip_guardian entries
-- This fixes the issue where Guardians cannot see trip requests

-- Drop existing policy if it exists (to avoid conflicts)
drop policy if exists "Guardians can view their own trip_guardian entries" on trip_guardians;

-- Create policy: Guardians can view trip_guardians where they are the guardian
-- This allows guardians to see trip requests they've received
create policy "Guardians can view their own trip_guardian entries"
on trip_guardians
for select
using (guardian_id = auth.uid());

-- Verify RLS is enabled
alter table trip_guardians enable row level security;

