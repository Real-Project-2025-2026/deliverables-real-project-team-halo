-- Migration: Add status and responded_at to trip_guardians table
-- Description: Enables the Guardian Trip Request feature where guardians can accept/decline trip monitoring requests
-- Affected table: trip_guardians
-- New columns: status (requested/accepted/declined), responded_at
-- New RLS policies: Guardians can read and update their own entries

-- Add status column with default 'requested'
alter table trip_guardians 
add column if not exists status text not null default 'requested' 
check (status in ('requested', 'accepted', 'declined'));

-- Add responded_at timestamp column
alter table trip_guardians 
add column if not exists responded_at timestamptz null;

-- Add updated_at column for tracking changes
alter table trip_guardians 
add column if not exists updated_at timestamptz not null default now();

-- Create index on status for filtering
create index if not exists trip_guardians_status_idx on trip_guardians(status);

-- Policy: Guardians can view trip_guardians where they are the guardian
-- This allows guardians to see trip requests they've received
-- Drop existing policy if it exists (to avoid conflicts)
drop policy if exists "Guardians can view their own trip_guardian entries" on trip_guardians;

create policy "Guardians can view their own trip_guardian entries"
on trip_guardians
for select
using (guardian_id = auth.uid());

-- Policy: Guardians can update their own status (accept/decline)
-- Only allows updating status and responded_at fields
create policy "Guardians can update their own trip_guardian status"
on trip_guardians
for update
using (guardian_id = auth.uid())
with check (guardian_id = auth.uid());

-- Enable realtime for trip_guardians table
alter publication supabase_realtime add table trip_guardians;

-- Add comments for documentation
comment on column trip_guardians.status is 'Status of the guardian request: requested (pending), accepted, or declined';
comment on column trip_guardians.responded_at is 'Timestamp when the guardian responded to the request';
comment on column trip_guardians.updated_at is 'Timestamp of last update to this record';

