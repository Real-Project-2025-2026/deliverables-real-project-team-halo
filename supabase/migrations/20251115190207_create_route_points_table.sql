-- Migration: Create route_points table for trip route recording
-- Purpose: Store location points along a trip route for visualization and analytics
-- Affected tables: route_points (new), trips (referenced)

-- Create route_points table
create table if not exists public.route_points (
  id bigint generated always as identity primary key,
  trip_id bigint not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision,
  altitude double precision,
  heading double precision,
  speed double precision,
  recorded_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now()
);

-- Create indexes for efficient queries
create index if not exists route_points_trip_id_idx on public.route_points(trip_id);
create index if not exists route_points_user_id_idx on public.route_points(user_id);
create index if not exists route_points_recorded_at_idx on public.route_points(recorded_at);
create index if not exists route_points_trip_recorded_idx on public.route_points(trip_id, recorded_at);

-- Enable row level security
alter table public.route_points enable row level security;

-- RLS Policies: Users can only access their own route points

-- Policy: Users can select their own route points
create policy "Users can select their own route points"
  on public.route_points
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Policy: Users can insert their own route points
create policy "Users can insert their own route points"
  on public.route_points
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Policy: Users can update their own route points
create policy "Users can update their own route points"
  on public.route_points
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Policy: Users can delete their own route points
create policy "Users can delete their own route points"
  on public.route_points
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Comment on table
comment on table public.route_points is 'Location points recorded during a trip for route visualization and analytics';

