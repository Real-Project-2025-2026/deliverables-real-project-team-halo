-- Migration: Enable Realtime for route_points and add Guardian access
-- Purpose: Allow Guardians to see route points in real-time via Supabase Realtime
-- Affected tables: route_points (RLS policies, Realtime publication)

-- ============================================================================
-- PART 1: Add route_points to Realtime publication
-- ============================================================================

-- Add route_points table to the supabase_realtime publication
-- This enables Supabase Realtime to broadcast changes to route_points
ALTER PUBLICATION supabase_realtime ADD TABLE public.route_points;

-- ============================================================================
-- PART 2: RLS Policies for Guardians to access route_points
-- ============================================================================

-- Policy: Guardians can view route points for trips they are monitoring
-- This allows Guardians (via trip_guardians) to see the route points
-- of trips they are watching
CREATE POLICY "Guardians can view route points for monitored trips"
  ON public.route_points
  FOR SELECT
  TO authenticated
  USING (
    -- User is a Guardian for this trip (via trip_guardians table)
    EXISTS (
      SELECT 1
      FROM public.trip_guardians
      WHERE trip_guardians.trip_id = route_points.trip_id
        AND trip_guardians.guardian_id = auth.uid()
    )
    -- OR user owns the trip
    OR EXISTS (
      SELECT 1
      FROM public.trips
      WHERE trips.id = route_points.trip_id
        AND trips.user_id = auth.uid()
    )
  );

-- Note: Insert, Update, Delete policies remain user-only (from original migration)
-- Guardians can only read route points, not modify them

-- ============================================================================
-- PART 3: Realtime Channel Authorization (for private channels)
-- ============================================================================

-- Enable Realtime on route_points for postgres_changes
-- The postgres_changes subscription will work with the RLS policies above
-- Channels using format: route_points:trip:{trip_id} will be authorized
-- via RLS policies on the route_points table

-- Index for better performance on Guardian queries
CREATE INDEX IF NOT EXISTS route_points_trip_id_user_id_idx 
  ON public.route_points(trip_id, user_id);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON POLICY "Guardians can view route points for monitored trips" ON public.route_points IS 
  'Allows Guardians (via trip_guardians) to read route points for trips they are monitoring. 
   This enables live route tracking in the Guardian view.';

