-- Migration: Create trip_guardians table
-- Description: Creates a junction table to link trips with selected Guardians

-- Create trip_guardians table
CREATE TABLE IF NOT EXISTS trip_guardians (
  id BIGSERIAL PRIMARY KEY,
  trip_id BIGINT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  guardian_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique relationship (one entry per trip-guardian pair)
  UNIQUE(trip_id, guardian_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS trip_guardians_trip_id_idx ON trip_guardians(trip_id);
CREATE INDEX IF NOT EXISTS trip_guardians_guardian_id_idx ON trip_guardians(guardian_id);

-- Add RLS policies
ALTER TABLE trip_guardians ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view trip_guardians for their own trips
CREATE POLICY "Users can view trip_guardians for own trips"
ON trip_guardians
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM trips
    WHERE trips.id = trip_guardians.trip_id
    AND trips.user_id = auth.uid()
  )
);

-- Policy: Users can insert trip_guardians for their own trips (only with their Guardians)
CREATE POLICY "Users can create trip_guardians for own trips"
ON trip_guardians
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM trips
    WHERE trips.id = trip_guardians.trip_id
    AND trips.user_id = auth.uid()
  )
  AND (
    -- Guardian must be a Guardian of the trip owner
    EXISTS (
      SELECT 1 FROM guardians
      WHERE (
        (guardians.requester_id = auth.uid() AND guardians.recipient_id = trip_guardians.guardian_id)
        OR (guardians.recipient_id = auth.uid() AND guardians.requester_id = trip_guardians.guardian_id)
      )
      AND guardians.status = 'accepted'
    )
  )
);

-- Policy: Users can delete trip_guardians for their own trips
CREATE POLICY "Users can delete trip_guardians for own trips"
ON trip_guardians
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM trips
    WHERE trips.id = trip_guardians.trip_id
    AND trips.user_id = auth.uid()
  )
);

-- Add comments
COMMENT ON TABLE trip_guardians IS 'Junction table linking trips with selected Guardians';
COMMENT ON COLUMN trip_guardians.trip_id IS 'The trip that includes this Guardian';
COMMENT ON COLUMN trip_guardians.guardian_id IS 'The Guardian (user) added to this trip';

